const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { env } = require("../config/env");
const { memory, id } = require("../store/memory");
const repo = require("../db/repo");
const { asyncHandler } = require("../utils/asyncHandler");
const { sendOTP } = require("../utils/sms");

const router = express.Router();

// Store OTPs temporarily in memory
const otpStore = new Map();

// Send registration OTP
router.post(
  "/send-otp",
  asyncHandler(async (req, res) => {
    const { phone } = req.body ?? {};
    if (!phone) return res.status(400).json({ error: "phone required" });

    if (await repo.isDbUp()) {
      const existing = await repo.getUserByPhone(phone);
      if (existing) return res.status(409).json({ error: "phone already exists" });
    }

    const otp = Math.floor(1000 + Math.random() * 9000).toString();
    otpStore.set(phone, { otp, expires: Date.now() + 5 * 60 * 1000 })

    await sendOTP(phone, otp)
    console.log(`OTP for ${phone}: ${otp}`)

    return res.json({ ok: true, message: "OTP sent to your phone!" })
  })
);

// Verify OTP
router.post(
  "/verify-otp",
  asyncHandler(async (req, res) => {
    const { phone, otp } = req.body ?? {};
    if (!phone || !otp) return res.status(400).json({ error: "phone and otp required" });

    const stored = otpStore.get(phone);
    if (!stored) return res.status(400).json({ error: "OTP not found. Request a new one." });
    if (Date.now() > stored.expires) {
      otpStore.delete(phone);
      return res.status(400).json({ error: "OTP expired. Request a new one." });
    }
    if (stored.otp !== otp) return res.status(400).json({ error: "Invalid OTP!" });

    otpStore.delete(phone);
    return res.json({ ok: true, message: "OTP verified!" });
  })
);

// Register
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
      const user = { id: id("usr"), phone, passwordHash, role: userRole };
      memory.users.set(user.id, user);
      if (userRole === "driver") {
        const driver = {
          id: id("drv"), userId: user.id,
          name: req.body?.name ?? "Driver",
          vehicleType: req.body?.vehicleType === "auto" ? "auto" : "bike",
          vehicleNumber: req.body?.vehicleNumber ?? "", active: true,
        };
        memory.drivers.set(driver.id, driver);
      }
    }

    return res.json({ ok: true });
  })
);

// Login
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

// Forgot password - send OTP
router.post(
  "/forgot-password",
  asyncHandler(async (req, res) => {
    const { phone } = req.body ?? {};
    if (!phone) return res.status(400).json({ error: "phone required" });

    const user = await repo.getUserByPhone(phone);
    if (!user) return res.status(404).json({ error: "Phone not registered" });

    const otp = Math.floor(1000 + Math.random() * 9000).toString();
    otpStore.set(`reset_${phone}`, { otp, expires: Date.now() + 5 * 60 * 1000 });

    await sendOTP(phone, otp);
    console.log(`Reset OTP for ${phone}: ${otp}`);

    return res.json({ ok: true, message: "OTP sent to your phone!" });
  })
);

// Reset password
router.post(
  "/reset-password",
  asyncHandler(async (req, res) => {
    const { phone, otp, newPassword } = req.body ?? {};
    if (!phone || !otp || !newPassword) {
      return res.status(400).json({ error: "phone, otp and newPassword required" });
    }

    const stored = otpStore.get(`reset_${phone}`);
    if (!stored) return res.status(400).json({ error: "OTP not found. Request a new one." });
    if (Date.now() > stored.expires) {
      otpStore.delete(`reset_${phone}`);
      return res.status(400).json({ error: "OTP expired. Request a new one." });
    }
    if (stored.otp !== otp) return res.status(400).json({ error: "Invalid OTP!" });

    otpStore.delete(`reset_${phone}`);

    const passwordHash = await bcrypt.hash(newPassword, 10);
    if (await repo.isDbUp()) {
      const pool = require("../db/pool").getPool();
      await pool.query("UPDATE users SET password_hash = ? WHERE phone = ?", [passwordHash, phone]);
    }

    return res.json({ ok: true, message: "Password reset successfully!" });
  })
);

module.exports = { authRouter: router };