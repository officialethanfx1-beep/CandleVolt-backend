const express = require("express");
const router = express.Router();
const db = require("../db");
const config = require("../config");

// GET /api/signals?market=crypto&userId=abc
// Returns recent signals, applying the free-plan delay server-side so the
// frontend never even receives a signal before it's supposed to unlock.
router.get("/", (req, res) => {
  const { market, userId } = req.query;
  const user = userId ? db.getUser(userId) : null;
  const isFree = !user || user.plan === "Free";

  let signals = db.recentSignals(market, 40);

  if (isFree) {
    const now = Date.now();
    signals = signals
      .filter((s) => s.marketKey === "crypto") // free plan = crypto only
      .filter((s) => now - s.ts >= config.freeDelayMin); // hide until delay elapses
  }

  res.json({ signals, plan: user?.plan || "Free" });
});

module.exports = router;
