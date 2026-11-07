const $ = (s) => document.querySelector(s);
const params = new URLSearchParams(location.search);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fmtTime = (t) => t.slice(0, 5);

async function api(url, opts) {
  const res = await fetch(url, opts);
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Something went wrong.');
  return data;
}

function busCard(b) {
  const low = b.seats_left <= 5 ? ' low' : '';
  const action = b.seats_left > 0
    ? `<a class="btn" href="register.html?bus_id=${b.bus_id}">Book seats</a>`
    : `<span class="btn off">Sold out</span>`;
  return `<article class="ticket"><div class="info">
    <span class="tag">${esc(b.service_no)}</span>
    <div class="route">${esc(b.source)} to ${esc(b.destination)}</div>
    <div class="meta">${esc(b.departure_date)} at ${fmtTime(b.departure_time)}</div></div>
    <div class="stub"><span class="seats${low}">${b.seats_left} of ${b.total_seats} seats left</span>${action}</div></article>`;
}

function bookingCard(k) {
  return `<article class="ticket"><div class="info">
    <span class="tag">Booking #${k.booking_id}</span>
    <div class="route">${esc(k.source)} to ${esc(k.destination)}</div>
    <div class="meta">${esc(k.service_no)} | ${esc(k.departure_date)} at ${fmtTime(k.departure_time)}</div>
    <div class="meta">${esc(k.passenger_name)}</div></div>
    <div class="stub"><strong>${k.seats_booked} seat(s)</strong></div></article>`;
}

const pages = {
  home() {
    $('#searchForm').addEventListener('submit', (e) => {
      e.preventDefault();
      location.href = 'buses.html?' + new URLSearchParams(new FormData(e.target));
    });
  },

  async buses() {
    const list = $('#busList');
    try {
      const buses = await api('/api/buses?' + params);
      list.innerHTML = buses.length ? buses.map(busCard).join('') : '<p class="msg">No buses found. Try different cities or another date.</p>';
    } catch (e) { list.innerHTML = `<p class="msg error">${esc(e.message)}</p>`; }
  },

  async register() {
    const form = $('#regForm'), info = $('#busInfo'), msg = $('#formMsg');
    const busId = params.get('bus_id');
    try {
      const b = await api('/api/buses/' + encodeURIComponent(busId));
      info.innerHTML = `<strong>${esc(b.service_no)}</strong>: ${esc(b.source)} to ${esc(b.destination)}, ${esc(b.departure_date)} at ${fmtTime(b.departure_time)}. <span class="seats">${b.seats_left} seats left.</span>`;
      $('#seats').max = b.seats_left;
    } catch (e) {
      info.innerHTML = `<span class="msg error">${esc(e.message)}</span> <a href="buses.html">Choose a bus</a>`;
      form.hidden = true;
      return;
    }
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const body = Object.fromEntries(new FormData(form));
      body.bus_id = busId;
      try {
        const r = await api('/api/bookings', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
        location.href = 'confirmation.html?id=' + r.booking_id;
      } catch (err) { msg.textContent = err.message; msg.className = 'msg error'; }
    });
  },

  async confirmation() {
    const box = $('#summary');
    try {
      const k = await api('/api/bookings/' + encodeURIComponent(params.get('id')));
      box.innerHTML = `<p class="msg success">Your seats are booked.</p><dl class="summary">
        <dt>Booking ID</dt><dd>${k.booking_id}</dd><dt>Passenger</dt><dd>${esc(k.passenger_name)}</dd>
        <dt>Phone</dt><dd>${esc(k.phone)}</dd><dt>Bus</dt><dd>${esc(k.service_no)}</dd>
        <dt>Route</dt><dd>${esc(k.source)} to ${esc(k.destination)}</dd>
        <dt>Departure</dt><dd>${esc(k.departure_date)} at ${fmtTime(k.departure_time)}</dd>
        <dt>Seats</dt><dd>${k.seats_booked}</dd></dl>`;
    } catch (e) { box.innerHTML = `<p class="msg error">${esc(e.message)}</p>`; }
  },

  bookings() {
    $('#lookupForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      const out = $('#bookingList');
      try {
        const rows = await api('/api/bookings?phone=' + encodeURIComponent($('#phone').value));
        out.innerHTML = rows.length ? rows.map(bookingCard).join('') : '<p class="msg">No bookings found for this number.</p>';
      } catch (err) { out.innerHTML = `<p class="msg error">${esc(err.message)}</p>`; }
    });
  }
};

const run = pages[document.body.dataset.page];
if (run) run();
