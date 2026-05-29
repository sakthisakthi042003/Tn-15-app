const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { env } = require("../config/env");
const { memory, id } = require("../store/memory");
const repo = require("../db/repo");
const { asyncHandler } = require("../utils/asyncHandler");

const router = express.Router();

router.post(
  "/register",
  asyncHandler(async (req, res) => {
    const { phone, password, role } = req.body ?? {};
    if (!phone || !password) {
      return res.status(400).json({ error: "phone and password required" });
    }
    const userRole = role === "driver" ? "driver" : "passenger";
    const passwordHash = await bcrypt.hash(password, 10);

    if (await repo.isDbUp()) {
      const existing = await repo.getUserByPhone(phone);
      if (existing) return res.status(409).json({ error: "phone already exists" });
      const user = await repo.createUser({ phone, passwordHash, role: userRole });
      if (userRole === "driver") {
        await repo.createDriver({
          userId: user.id,
          name: req.body?.name ?? "Driver",
          vehicleType: req.body?.vehicleType === "auto" ? "auto" : "bike",
          vehicleNumber: req.body?.vehicleNumber ?? "",
        });
      }
    } else {
      const existing = [...memory.users.values()].find((u) => u.phone === phone);
      if (existing) return res.status(409).json({ error: "phone already exists" });

      const user = {
        id: id("usr"),
        phone,
        passwordHash,
        role: userRole,
      };
      memory.users.set(user.id, user);

      if (userRole === "driver") {
        const driver = {
          id: id("drv"),
          userId: user.id,
          name: req.body?.name ?? "Driver",
          vehicleType: req.body?.vehicleType === "auto" ? "auto" : "bike",
          vehicleNumber: req.body?.vehicleNumber ?? "",
          active: true,
        };
        memory.drivers.set(driver.id, driver);
      }
    }

    return res.json({ ok: true });
  })
);

router.post(
  "/login",
  asyncHandler(async (req, res) => {
    const { phone, password } = req.body ?? {};
    if (!phone || !password) {
      return res.status(400).json({ error: "phone and password required" });
    }
    const user = (await repo.isDbUp())
      ? await repo.getUserByPhone(phone)
      : [...memory.users.values()].find((u) => u.phone === phone);
    if (!user) return res.status(401).json({ error: "invalid credentials" });
    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) return res.status(401).json({ error: "invalid credentials" });

    const token = jwt.sign(
      { sub: user.id, role: user.role, phone: user.phone },
      env.jwtSecret,
      { expiresIn: "7d" }
    );
    return res.json({ token, role: user.role });
  })
);

module.exports = { authRouter: router };

