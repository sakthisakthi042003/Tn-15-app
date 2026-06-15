const express = require("express");
const { asyncHandler } = require("../utils/asyncHandler");
const { memory, id } = require("../store/memory");
const repo = require("../db/repo");
const { authRequired, requireRole } = require("../middleware/auth");

const router = express.Router();

// Generate 4 digit OTP
function generateOTP() {
  return Math.floor(1000 + Math.random() * 9000).toString();
}

function estimateFare(vehicleType, km) {
  const vt = vehicleType === "auto" ? "auto" : "bike";
  const fare = memory.fares[vt];
  const distance = Number(km);
  // Rapido style: base fare covers first 2km, then per km after
  const chargeableKm = Math.max(0, distance - 2)
  const total = fare.baseFare + fare.perKm * chargeableKm;
  return { vehicleType: vt, km: distance, ...fare, total: Math.round(total) };
}

router.post(
  "/fare/estimate",
  asyncHandler(async (req, res) => {
    const { vehicleType, km } = req.body ?? {};
    if (km === undefined) return res.status(400).json({ error: "km required" });
    if (await repo.isDbUp()) {
      const fares = await repo.getFares();
      if (fares.bike && fares.auto) memory.fares = fares;
    }
    res.json({ estimate: estimateFare(vehicleType, km) });
  })
);

// Passenger creates a ride request — OTP generated here
router.post(
  "/rides",
  authRequired,
  requireRole("passenger"),
  asyncHandler(async (req, res) => {
    const { pickup, drop, vehicleType, km } = req.body ?? {};
    if (!pickup || !drop) return res.status(400).json({ error: "pickup and drop required" });
    const vt = vehicleType === "auto" ? "auto" : "bike";
    const distance = km ? Number(km) : null;
    const fare = distance !== null ? estimateFare(vt, distance) : null;
    const otp = generateOTP();

    if (await repo.isDbUp()) {
      const fares = await repo.getFares();
      if (fares.bike && fares.auto) memory.fares = fares;
      const dbRide = await repo.createRide({
        passengerUserId: req.user.sub,
        pickup,
        dropoff: drop,
        vehicleType: vt,
        km: distance,
        fareTotal: fare?.total ?? null,
        otp,
      });
      return res.json({
        ride: {
          id: dbRide.id,
          passengerUserId: dbRide.passengerUserId,
          pickup: dbRide.pickup,
          drop,
          vehicleType: vt,
          km: distance,
          fare: fare ? { total: fare.total } : null,
          status: "requested",
          driverId: null,
          otp: otp,
          createdAt: dbRide.createdAt,
        },
      });
    }

    const ride = {
      id: id("ride"),
      passengerUserId: req.user.sub,
      pickup,
      drop,
      vehicleType: vt,
      km: distance,
      fare: fare ? { total: fare.total } : null,
      status: "requested",
      driverId: null,
      otp: otp,
      createdAt: new Date().toISOString(),
    };
    memory.rides.set(ride.id, ride);
    return res.json({ ride });
  })
);

router.get(
  "/rides/mine",
  authRequired,
  asyncHandler(async (req, res) => {
    const role = req.user.role;
    if (await repo.isDbUp()) {
      if (role === "passenger") {
        const rows = await repo.listRidesForPassenger(req.user.sub);
        const rides = rows.map((r) => ({
          id: r.id,
          pickup: r.pickup,
          drop: r.dropoff,
          vehicleType: r.vehicleType,
          km: r.km,
          status: r.status,
          driverId: r.driverId,
          otp: r.otp,
          otpVerified: r.otp_verified,
          createdAt: new Date(r.createdAt).toISOString(),
          fare: r.fareTotal === null ? null : { total: r.fareTotal },
        }));
        return res.json({ rides });
      }
      if (role === "driver") {
        const driver = await repo.getDriverByUserId(req.user.sub);
        const rows = driver ? await repo.listRidesForDriver(driver.id) : [];
        const rides = rows.map((r) => ({
          id: r.id,
          pickup: r.pickup,
          drop: r.dropoff,
          vehicleType: r.vehicleType,
          km: r.km,
          status: r.status,
          driverId: r.driverId,
          createdAt: new Date(r.createdAt).toISOString(),
          fare: r.fareTotal === null ? null : { total: r.fareTotal },
        }));
        return res.json({ rides });
      }
    }

    let rides = [...memory.rides.values()];
    if (role === "passenger") rides = rides.filter((r) => r.passengerUserId === req.user.sub);
    if (role === "driver") {
      const driver = [...memory.drivers.values()].find((d) => d.userId === req.user.sub);
      rides = rides.filter((r) => r.driverId === driver?.id);
    }
    return res.json({ rides });
  })
);

// Driver sees open rides
router.get(
  "/driver/rides/open",
  authRequired,
  requireRole("driver"),
  asyncHandler(async (req, res) => {
    if (await repo.isDbUp()) {
      const rows = await repo.listOpenRides();
      const rides = rows.map((r) => ({
        id: r.id,
        pickup: r.pickup,
        drop: r.dropoff,
        vehicleType: r.vehicleType,
        km: r.km,
        status: r.status,
        driverId: r.driverId,
        createdAt: new Date(r.createdAt).toISOString(),
        fare: r.fareTotal === null ? null : { total: r.fareTotal },
      }));
      return res.json({ rides });
    }
    const rides = [...memory.rides.values()].filter((r) => r.status === "requested");
    return res.json({ rides });
  })
);

// Driver accepts a ride
router.post(
  "/driver/rides/:rideId/accept",
  authRequired,
  requireRole("driver"),
  asyncHandler(async (req, res) => {
    if (await repo.isDbUp()) {
      const driver = await repo.getDriverByUserId(req.user.sub);
      if (!driver) return res.status(400).json({ error: "driver profile missing" });
      const ok = await repo.acceptRide({ rideId: req.params.rideId, driverId: driver.id });
      if (!ok) return res.status(409).json({ error: "ride not available" });
      return res.json({
        ride: {
          id: req.params.rideId,
          status: "accepted",
          driverId: driver.id,
        },
      });
    }

    const ride = memory.rides.get(req.params.rideId);
    if (!ride) return res.status(404).json({ error: "ride not found" });
    if (ride.status !== "requested") return res.status(409).json({ error: "ride not available" });
    const driver = [...memory.drivers.values()].find((d) => d.userId === req.user.sub);
    if (!driver) return res.status(400).json({ error: "driver profile missing" });
    ride.status = "accepted";
    ride.driverId = driver.id;
    memory.rides.set(ride.id, ride);
    return res.json({ ride });
  })
);

// Driver verifies OTP to complete ride
router.post(
  "/driver/rides/:rideId/verify-otp",
  authRequired,
  requireRole("driver"),
  asyncHandler(async (req, res) => {
    const { otp } = req.body ?? {};
    if (!otp) return res.status(400).json({ error: "OTP required" });

    if (await repo.isDbUp()) {
      const pool = require("../db/pool").getPool();
      const [rows] = await pool.query(
        "SELECT otp FROM rides WHERE id = ?",
        [req.params.rideId]
      );
      if (!rows[0]) return res.status(404).json({ error: "ride not found" });
      if (rows[0].otp !== otp) return res.status(400).json({ error: "Invalid OTP! Try again." });
      await pool.query(
        "UPDATE rides SET otp_verified = 1, status = 'completed' WHERE id = ?",
        [req.params.rideId]
      );
      return res.json({ ok: true, message: "OTP verified! Ride completed! 🎉" });
    }
    return res.json({ ok: true });
  })
);
// Driver confirms cash collected
router.post(
  "/driver/rides/:rideId/cash-collected",
  authRequired,
  requireRole("driver"),
  asyncHandler(async (req, res) => {
    if (await repo.isDbUp()) {
      const pool = require("../db/pool").getPool();
      const [rows] = await pool.query(
        "SELECT status, fare_total FROM rides WHERE id = ?",
        [req.params.rideId]
      );
      if (!rows[0]) return res.status(404).json({ error: "Ride not found" });
      if (rows[0].status !== "completed") return res.status(400).json({ error: "Ride not completed yet" });
      await pool.query(
        "UPDATE rides SET cash_collected = 1 WHERE id = ?",
        [req.params.rideId]
      );
      return res.json({ ok: true, message: "Cash collected confirmed!" });
    }
    return res.json({ ok: true });
  })
);

module.exports = { ridesRouter: router };
// Passenger cancels a ride
router.post(
  "/rides/:rideId/cancel",
  authRequired,
  requireRole("passenger"),
  asyncHandler(async (req, res) => {
    if (await repo.isDbUp()) {
      const pool = require("../db/pool").getPool();
      const [rows] = await pool.query(
        "SELECT status FROM rides WHERE id = ? AND passenger_user_id = ?",
        [req.params.rideId, req.user.sub]
      );
      if (!rows[0]) return res.status(404).json({ error: "Ride not found" });
      if (rows[0].status !== "requested") return res.status(400).json({ error: "Cannot cancel accepted ride" });
      await pool.query(
        "UPDATE rides SET status = 'cancelled' WHERE id = ?",
        [req.params.rideId]
      );
      return res.json({ ok: true, message: "Ride cancelled!" });
    }
    return res.json({ ok: true });
  })
);