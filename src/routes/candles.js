const express = require("express");
const router = express.Router();
const candleStore = require("../services/candleStore");

// GET /api/candles?symbol=BTC/USDT&limit=100
router.get("/", (req, res) => {
  const { symbol, limit } = req.query;
  if (!symbol) return res.status(400).json({ error: "symbol is required" });
  const candles = candleStore.getCandles(symbol, limit ? parseInt(limit, 10) : 100);
  res.json({ symbol, candles });
});

module.exports = router;
