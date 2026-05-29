const express = require("express");
const { asyncHandler } = require("../utils/asyncHandler");
const { memory } = require("../store/memory");
const { authRequired, requireRole } = require("../middleware/auth");
const repo = require("../db/repo");

const router = express.Router();

router.get(
  "/fares",
  asyncHandler(async (req, res) => {
    if (await repo.isDbUp()) {
      const fares = await repo.getFares();
      if (fares.bike && fares.auto) {
        memory.fares = fares;
      }
    }
    res.json({ fares: memory.fares });
  })
);

router.post(
  "/admin/fares",
  authRequired,
  requireRole("admin"),
  asyncHandler(async (req, res) => {
    const { bike, auto } = req.body ?? {};
    if (bike) memory.fares.bike = { ...memory.fares.bike, ...bike };
    if (auto) memory.fares.auto = { ...memory.fares.auto, ...auto };
    if (await repo.isDbUp()) {
      await repo.upsertFares({
        bike: memory.fares.bike,
        auto: memory.fares.auto,
      });
    }
    res.json({ ok: true, fares: memory.fares });
  })
);

module.exports = { faresRouter: router };

