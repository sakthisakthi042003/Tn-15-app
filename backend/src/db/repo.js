const { getPool } = require("./pool");
const { id: makeId } = require("../store/memory");

async function isDbUp() {
  try {
    const pool = getPool();
    await pool.query("SELECT 1");
    return true;
  } catch {
    return false;
  }
}

async function getUserByPhone(phone) {
  const pool = getPool();
  const [rows] = await pool.query(
    "SELECT id, phone, password_hash AS passwordHash, role FROM users WHERE phone = ? LIMIT 1",
    [phone]
  );
  return rows[0] ?? null;
}

async function createUser({ phone, passwordHash, role }) {
  const pool = getPool();
  const user = { id: makeId("usr"), phone, passwordHash, role };
  await pool.query(
    "INSERT INTO users (id, phone, password_hash, role) VALUES (?, ?, ?, ?)",
    [user.id, user.phone, user.passwordHash, user.role]
  );
  return user;
}

async function createDriver({ userId, name, vehicleType, vehicleNumber }) {
  const pool = getPool();
  const driver = {
    id: makeId("drv"),
    userId,
    name,
    vehicleType,
    vehicleNumber: vehicleNumber ?? "",
    active: 1,
  };
  await pool.query(
    "INSERT INTO drivers (id, user_id, name, vehicle_type, vehicle_number, active) VALUES (?, ?, ?, ?, ?, ?)",
    [driver.id, driver.userId, driver.name, driver.vehicleType, driver.vehicleNumber, driver.active]
  );
  return driver;
}

async function getDriverByUserId(userId) {
  const pool = getPool();
  const [rows] = await pool.query(
    "SELECT id, user_id AS userId, name, vehicle_type AS vehicleType, vehicle_number AS vehicleNumber, active FROM drivers WHERE user_id = ? LIMIT 1",
    [userId]
  );
  return rows[0] ?? null;
}

async function listDrivers() {
  const pool = getPool();
  const [rows] = await pool.query(
    "SELECT id, user_id AS userId, name, vehicle_type AS vehicleType, vehicle_number AS vehicleNumber, active FROM drivers ORDER BY created_at DESC"
  );
  return rows;
}

async function getFares() {
  const pool = getPool();
  const [rows] = await pool.query("SELECT vehicle_type AS vehicleType, base_fare AS baseFare, per_km AS perKm FROM fares");
  const fares = {};
  for (const r of rows) fares[r.vehicleType] = { baseFare: Number(r.baseFare), perKm: Number(r.perKm) };
  return fares;
}

async function upsertFares({ bike, auto }) {
  const pool = getPool();
  const updates = [];
  if (bike) updates.push({ vehicleType: "bike", ...bike });
  if (auto) updates.push({ vehicleType: "auto", ...auto });
  for (const u of updates) {
    const baseFare = Number(u.baseFare);
    const perKm = Number(u.perKm);
    await pool.query(
      "INSERT INTO fares (vehicle_type, base_fare, per_km) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE base_fare = VALUES(base_fare), per_km = VALUES(per_km)",
      [u.vehicleType, baseFare, perKm]
    );
  }
}

async function createRide({ passengerUserId, pickup, dropoff, vehicleType, km, fareTotal }) {
  const pool = getPool();
  const ride = {
    id: makeId("ride"),
    passengerUserId,
    pickup,
    dropoff,
    vehicleType,
    km: km ?? null,
    fareTotal: fareTotal ?? null,
    status: "requested",
    driverId: null,
    createdAt: new Date().toISOString(),
  };
  await pool.query(
    "INSERT INTO rides (id, passenger_user_id, pickup, dropoff, vehicle_type, km, fare_total, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
    [ride.id, ride.passengerUserId, ride.pickup, ride.dropoff, ride.vehicleType, ride.km, ride.fareTotal, ride.status]
  );
  return ride;
}

async function listOpenRides() {
  const pool = getPool();
  const [rows] = await pool.query(
    "SELECT id, passenger_user_id AS passengerUserId, driver_id AS driverId, pickup, dropoff, vehicle_type AS vehicleType, km, fare_total AS fareTotal, status, created_at AS createdAt FROM rides WHERE status = 'requested' ORDER BY created_at DESC"
  );
  return rows.map((r) => ({
    ...r,
    km: r.km === null ? null : Number(r.km),
    fareTotal: r.fareTotal === null ? null : Number(r.fareTotal),
  }));
}

async function listRidesForPassenger(userId) {
  const pool = getPool();
  const [rows] = await pool.query(
    "SELECT id, passenger_user_id AS passengerUserId, driver_id AS driverId, pickup, dropoff, vehicle_type AS vehicleType, km, fare_total AS fareTotal, status, created_at AS createdAt FROM rides WHERE passenger_user_id = ? ORDER BY created_at DESC",
    [userId]
  );
  return rows.map((r) => ({
    ...r,
    km: r.km === null ? null : Number(r.km),
    fareTotal: r.fareTotal === null ? null : Number(r.fareTotal),
  }));
}

async function listRidesForDriver(driverId) {
  const pool = getPool();
  const [rows] = await pool.query(
    "SELECT id, passenger_user_id AS passengerUserId, driver_id AS driverId, pickup, dropoff, vehicle_type AS vehicleType, km, fare_total AS fareTotal, status, created_at AS createdAt FROM rides WHERE driver_id = ? ORDER BY created_at DESC",
    [driverId]
  );
  return rows.map((r) => ({
    ...r,
    km: r.km === null ? null : Number(r.km),
    fareTotal: r.fareTotal === null ? null : Number(r.fareTotal),
  }));
}

async function acceptRide({ rideId, driverId }) {
  const pool = getPool();
  const [result] = await pool.query(
    "UPDATE rides SET status = 'accepted', driver_id = ? WHERE id = ? AND status = 'requested'",
    [driverId, rideId]
  );
  return result.affectedRows === 1;
}

async function listAllRides() {
  const pool = getPool();
  const [rows] = await pool.query(
    "SELECT id, passenger_user_id AS passengerUserId, driver_id AS driverId, pickup, dropoff, vehicle_type AS vehicleType, km, fare_total AS fareTotal, status, created_at AS createdAt FROM rides ORDER BY created_at DESC"
  );
  return rows.map((r) => ({
    ...r,
    km: r.km === null ? null : Number(r.km),
    fareTotal: r.fareTotal === null ? null : Number(r.fareTotal),
  }));
}

module.exports = {
  isDbUp,
  getUserByPhone,
  createUser,
  createDriver,
  getDriverByUserId,
  listDrivers,
  getFares,
  upsertFares,
  createRide,
  listOpenRides,
  listRidesForPassenger,
  listRidesForDriver,
  acceptRide,
  listAllRides,
};

