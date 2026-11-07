USE bus_registration_db;
CREATE TABLE IF NOT EXISTS bookings (
  booking_id     INT AUTO_INCREMENT PRIMARY KEY,
  bus_id         INT NOT NULL,
  passenger_name VARCHAR(100) NOT NULL,
  phone          VARCHAR(15)  NOT NULL,
  email          VARCHAR(100),
  seats_booked   INT NOT NULL CHECK (seats_booked > 0),
  booking_time   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (bus_id) REFERENCES buses(bus_id) ON DELETE CASCADE
);
