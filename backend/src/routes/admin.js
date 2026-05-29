const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { asyncHandler } = require("../utils/asyncHandler");
const { memory } = require("../store/memory");
const { authRequired, requireRole } = require("../middleware/auth");
const { env } = require("../config/env");
const repo = require("../db/repo");

const router = express.Router();

// Admin login
router.post(
  "/admin/login",
  asyncHandler(async (req, res) => {
    const { phone, password } = req.body ?? {};
    if (!phone || !password)
      return res.status(400).json({ error: "phone and password required" });

    const user = await repo.getUserByPhone(phone);
    if (!user || user.role !== "admin")
      return res.status(401).json({ error: "Invalid credentials" });

    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok)
      return res.status(401).json({ error: "Invalid credentials" });

    const token = jwt.sign(
      { sub: user.id, role: user.role, phone: user.phone },
      env.jwtSecret,
      { expiresIn: "7d" }
    );
    return res.json({ token });
  })
);

// Get all rides with passenger and driver phone
router.get(
  "/admin/rides",
  authRequired,
  requireRole("admin"),
  asyncHandler(async (req, res) => {
    if (await repo.isDbUp()) {
      const rides = await repo.listAllRides();
      // Get all users to map phone numbers
      const pool = require("../db/pool").getPool();
      const [users] = await pool.query("SELECT id, phone FROM users");
      const [drivers] = await pool.query(
        "SELECT d.id, u.phone FROM drivers d JOIN users u ON d.user_id = u.id"
      );
      const userMap = Object.fromEntries(users.map(u => [u.id, u.phone]));
      const driverMap = Object.fromEntries(drivers.map(d => [d.id, d.phone]));

      const enriched = rides.map(r => ({
        id: r.id,
        pickup: r.pickup,
        drop: r.dropoff ?? r.drop,
        vehicleType: r.vehicleType,
        status: r.status,
        fare: r.fareTotal ? { total: Number(r.fareTotal) } : null,
        createdAt: r.createdAt,
        passengerPhone: userMap[r.passengerUserId] ?? null,
        driverPhone: r.driverId ? driverMap[r.driverId] ?? null : null,
      }));
      return res.json({ rides: enriched });
    }
    res.json({ rides: [...memory.rides.values()] });
  })
);

// Get all drivers
router.get(
  "/admin/drivers",
  authRequired,
  requireRole("admin"),
  asyncHandler(async (req, res) => {
    if (await repo.isDbUp()) {
      const drivers = await repo.listDrivers();
      const pool = require("../db/pool").getPool();
      const [users] = await pool.query("SELECT id, phone FROM users");
      const userMap = Object.fromEntries(users.map(u => [u.id, u.phone]));
      const enriched = drivers.map(d => ({
        id: d.id,
        name: d.name,
        phone: userMap[d.userId] ?? '-',
        vehicleType: d.vehicleType,
        vehicleNumber: d.vehicleNumber,
        isActive: !!d.active,
        totalRides: 0,
        rating: 4.5,
      }));
      return res.json({ drivers: enriched });
    }
    res.json({ drivers: [...memory.drivers.values()] });
  })
);

// Get all passengers
router.get(
  "/admin/passengers",
  authRequired,
  requireRole("admin"),
  asyncHandler(async (req, res) => {
    if (await repo.isDbUp()) {
      const pool = require("../db/pool").getPool();
      const [users] = await pool.query(
        "SELECT id, phone, created_at AS createdAt FROM users WHERE role = 'passenger'"
      );
      const [rideCounts] = await pool.query(
        "SELECT passenger_user_id, COUNT(*) as total FROM rides GROUP BY passenger_user_id"
      );
      const rideMap = Object.fromEntries(
        rideCounts.map(r => [r.passenger_user_id, Number(r.total)])
      );
      const passengers = users.map(u => ({
        id: u.id,
        phone: u.phone,
        totalRides: rideMap[u.id] ?? 0,
        createdAt: u.createdAt,
      }));
      return res.json({ passengers });
    }
    res.json({ passengers: [] });
  })
);

// Update ride status
router.patch(
  "/admin/rides/:id/status",
  authRequired,
  requireRole("admin"),
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { status } = req.body ?? {};
    if (await repo.isDbUp()) {
      const pool = require("../db/pool").getPool();
      await pool.query("UPDATE rides SET status = ? WHERE id = ?", [status, id]);
      return res.json({ ok: true });
    }
    res.json({ ok: true });
  })
);

module.exports = { adminRouter: router };