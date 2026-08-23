const express = require("express");
const router = express.Router();
const crypto = require("crypto");
const db = require("../db");
const auth = require("../services/auth");

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

// POST /api/auth/signup  { email, password }
router.post("/signup", async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: "Email and password are required" });
  }
  if (!isValidEmail(email)) {
    return res.status(400).json({ error: "Enter a valid email address" });
  }
  if (password.length < 6) {
    return res.status(400).json({ error: "Password must be at least 6 characters" });
  }
  if (db.getUserByEmail(email)) {
    return res.status(409).json({ error: "An account with this email already exists" });
  }

  const passwordHash = await auth.hashPassword(password);
  const id = `user-${crypto.randomBytes(8).toString("hex")}`;
  const user = db.createAccount({ id, email, passwordHash });
  const token = auth.signToken(user.id);

  res.json({ token, userId: user.id, email: user.email, plan: user.plan });
});

// POST /api/auth/login  { email, password }
router.post("/login", async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: "Email and password are required" });
  }
  const user = db.getUserByEmail(email);
  if (!user || !user.passwordHash) {
    return res.status(401).json({ error: "Invalid email or password" });
  }
  const ok = await auth.verifyPassword(password, user.passwordHash);
  if (!ok) {
    return res.status(401).json({ error: "Invalid email or password" });
  }
  const token = auth.signToken(user.id);
  res.json({ token, userId: user.id, email: user.email, plan: user.plan });
});

// GET /api/auth/me — validates a stored token on app load
router.get("/me", (req, res) => {
  const authHeader = req.headers.authorization || "";
  const token = authHeader.replace("Bearer ", "");
  const payload = auth.verifyToken(token);
  if (!payload) return res.status(401).json({ error: "Invalid or expired session" });
  const user = db.getUser(payload.userId);
  if (!user) return res.status(404).json({ error: "Account not found" });
  res.json({ userId: user.id, email: user.email, plan: user.plan });
});

module.exports = router;
