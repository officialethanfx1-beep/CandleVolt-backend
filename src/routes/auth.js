const express = require("express");
const router = express.Router();
const crypto = require("crypto");
const db = require("../db");
const auth = require("../services/auth");
const email = require("../services/email");

function isValidEmail(addr) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(addr);
}

// POST /api/auth/request-otp  { email }
router.post("/request-otp", async (req, res) => {
  const { email: addr } = req.body;
  if (!addr || !isValidEmail(addr)) {
    return res.status(400).json({ error: "Enter a valid email address" });
  }
  const code = auth.generateOtp();
  db.setOtp(addr, code, Date.now() + 10 * 60000);
  const sent = await email.sendOtpEmail(addr, code);
  if (!sent) {
    return res.status(500).json({ error: "Could not send the code — try again shortly" });
  }
  res.json({ ok: true });
});

// POST /api/auth/verify-otp  { email, code }
router.post("/verify-otp", (req, res) => {
  const { email: addr, code } = req.body;
  if (!addr || !code) {
    return res.status(400).json({ error: "Email and code are required" });
  }
  const record = db.getOtp(addr);
  if (!record || record.code !== code || Date.now() > record.expiresAt) {
    return res.status(401).json({ error: "Invalid or expired code" });
  }
  db.clearOtp(addr);

  let user = db.getUserByEmail(addr);
  if (!user) {
    const id = `user-${crypto.randomBytes(8).toString("hex")}`;
    user = db.createAccount({ id, email: addr });
  }
  const token = auth.signToken(user.id);
  res.json({
    token,
    userId: user.id,
    email: user.email,
    plan: user.plan,
    profile: user.profile || {},
  });
});

// GET /api/auth/me
router.get("/me", (req, res) => {
  const header = req.headers.authorization || "";
  const token = header.replace("Bearer ", "");
  const payload = auth.verifyToken(token);
  if (!payload) return res.status(401).json({ error: "Invalid or expired session" });
  const user = db.getUser(payload.userId);
  if (!user) return res.status(404).json({ error: "Account not found" });
  res.json({
    userId: user.id,
    email: user.email,
    plan: user.plan,
    profile: user.profile || {},
  });
});

// PUT /api/auth/profile  { username, firstName, lastName, country, bio, avatar }
router.put("/profile", (req, res) => {
  const header = req.headers.authorization || "";
  const token = header.replace("Bearer ", "");
  const payload = auth.verifyToken(token);
  if (!payload) return res.status(401).json({ error: "Invalid or expired session" });

  const { username, firstName, lastName, country, bio, avatar } = req.body;
  const profile = db.updateProfile(payload.userId, {
    username,
    firstName,
    lastName,
    country,
    bio,
    avatar,
  });
  res.json({ profile });
});

module.exports = router;
