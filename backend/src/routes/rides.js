const express = require("express");
const { asyncHandler } = require("../utils/asyncHandler");
const { memory, id } = require("../store/memory");
const repo = require("../db/repo");
const { authRequired, requireRole } = require("../middleware/auth");

const router = express.Router();

function estimateFare(vehicleType, km) {
  const vt = vehicleType === "auto" ? "auto" : "bike";
  const fare = memory.fares[vt];
  const distance = Number(km);
  const total = fare.baseFare + fare.perKm * Math.max(0, distance);
  return { vehicleType: vt, km: distance, ...fare, total: Math.round(total) };
}

router.post(
  "/fare/estimate",
  asyncHandler(async (req, res) => {
    const { vehicleType, km } = req.body ?? {};
    if (km === undefined) return res.status(400).json({ error: "km required" });
    // If DB is up, load fares from DB (but keep memory fallback)
    if (await repo.isDbUp()) {
      const fares = await repo.getFares();
      if (fares.bike && fares.auto) memory.fares = fares;
    }
    res.json({ estimate: estimateFare(vehicleType, km) });
  })
);

// Passenger creates a ride request
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
      status: "requested", // requested | accepted | completed | cancelled
      driverId: null,
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

module.exports = { ridesRouter: router };

