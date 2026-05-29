const express = require("express");
const { asyncHandler } = require("../utils/asyncHandler");
const { checkDb } = require("../db/pool");

const router = express.Router();

router.get(
  "/health",
  asyncHandler(async (req, res) => {
    let db = "unknown";
    try {
      await checkDb();
      db = "ok";
    } catch {
      db = "down";
    }
    res.json({ ok: true, db });
  })
);

module.exports = { healthRouter: router };

