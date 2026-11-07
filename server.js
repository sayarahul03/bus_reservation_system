const express = require('express');
const mysql = require('mysql2/promise');
const path = require('path');

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const pool = mysql.createPool({
  host: 'localhost',
  user: 'root',
  password: 'root', // <- put your MySQL root password here
  database: 'bus_registration_db',
  dateStrings: true,
  connectionLimit: 10
});

const SEATS_LEFT = `b.total_seats - COALESCE((SELECT SUM(seats_booked) FROM bookings WHERE bus_id = b.bus_id), 0)`;

// Search / list buses
app.get('/api/buses', async (req, res) => {
  const { source = '', destination = '', date = '' } = req.query;
  let sql = `SELECT b.*, ${SEATS_LEFT} AS seats_left FROM buses b WHERE b.source LIKE ? AND b.destination LIKE ?`;
  const params = [`%${source}%`, `%${destination}%`];
  if (date) { sql += ' AND b.departure_date = ?'; params.push(date); }
  sql += ' ORDER BY b.departure_date, b.departure_time';
  try {
    const [rows] = await pool.query(sql, params);
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// One bus
app.get('/api/buses/:id', async (req, res) => {
  try {
    const [rows] = await pool.query(`SELECT b.*, ${SEATS_LEFT} AS seats_left FROM buses b WHERE b.bus_id = ?`, [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'Bus not found.' });
    res.json(rows[0]);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Create booking (checks seats inside a transaction)
app.post('/api/bookings', async (req, res) => {
  const { bus_id, passenger_name, phone, email, seats_booked } = req.body;
  const seats = parseInt(seats_booked, 10);
  if (!bus_id || !passenger_name || !/^\d{10}$/.test(phone || '') || !(seats > 0)) {
    return res.status(400).json({ error: 'Enter a name, a 10-digit phone number and at least 1 seat.' });
  }
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [bus] = await conn.query('SELECT bus_id FROM buses WHERE bus_id = ? FOR UPDATE', [bus_id]);
    if (!bus.length) { await conn.rollback(); return res.status(404).json({ error: 'Bus not found.' }); }
    const [[row]] = await conn.query(`SELECT ${SEATS_LEFT} AS seats_left FROM buses b WHERE b.bus_id = ?`, [bus_id]);
    if (seats > row.seats_left) {
      await conn.rollback();
      return res.status(400).json({ error: `Only ${row.seats_left} seat(s) left on this bus.` });
    }
    const [result] = await conn.query(
      'INSERT INTO bookings (bus_id, passenger_name, phone, email, seats_booked) VALUES (?, ?, ?, ?, ?)',
      [bus_id, passenger_name.trim(), phone, email || null, seats]
    );
    await conn.commit();
    res.status(201).json({ booking_id: result.insertId });
  } catch (e) {
    await conn.rollback();
    res.status(500).json({ error: e.message });
  } finally { conn.release(); }
});

const BOOKING_SQL = `SELECT k.*, b.service_no, b.source, b.destination, b.departure_date, b.departure_time
                     FROM bookings k JOIN buses b ON b.bus_id = k.bus_id`;

// One booking
app.get('/api/bookings/:id', async (req, res) => {
  try {
    const [rows] = await pool.query(`${BOOKING_SQL} WHERE k.booking_id = ?`, [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'Booking not found.' });
    res.json(rows[0]);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Bookings by phone
app.get('/api/bookings', async (req, res) => {
  try {
    const [rows] = await pool.query(`${BOOKING_SQL} WHERE k.phone = ? ORDER BY k.booking_time DESC`, [req.query.phone || '']);
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.listen(3000, () => console.log('Server running at http://localhost:3000'));
