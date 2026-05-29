-- TN 15 MySQL schema
-- Create database first: CREATE DATABASE tn15 CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS users (
  id VARCHAR(40) PRIMARY KEY,
  phone VARCHAR(20) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  role ENUM('passenger','driver','admin') NOT NULL DEFAULT 'passenger',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS drivers (
  id VARCHAR(40) PRIMARY KEY,
  user_id VARCHAR(40) NOT NULL,
  name VARCHAR(120) NOT NULL,
  vehicle_type ENUM('bike','auto') NOT NULL,
  vehicle_number VARCHAR(40) NULL,
  active TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_drivers_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS fares (
  vehicle_type ENUM('bike','auto') PRIMARY KEY,
  base_fare INT NOT NULL,
  per_km INT NOT NULL,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS rides (
  id VARCHAR(40) PRIMARY KEY,
  passenger_user_id VARCHAR(40) NOT NULL,
  driver_id VARCHAR(40) NULL,
  pickup VARCHAR(255) NOT NULL,
  dropoff VARCHAR(255) NOT NULL,
  vehicle_type ENUM('bike','auto') NOT NULL,
  km DECIMAL(10,2) NULL,
  fare_total INT NULL,
  status ENUM('requested','accepted','completed','cancelled') NOT NULL DEFAULT 'requested',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_rides_passenger FOREIGN KEY (passenger_user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_rides_driver FOREIGN KEY (driver_id) REFERENCES drivers(id) ON DELETE SET NULL
);

