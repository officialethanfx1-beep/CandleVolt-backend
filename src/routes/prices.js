const express = require("express");
const router = express.Router();
const db = require("../db");
const config = require("../config");

// GET /api/prices?market=crypto — latest known price for tracked symbols
router.get("/", (req, res) => {
  const { market } = req.query;
  const groups = market ? { [market]: config.assets[market] } : config.assets;

  const out = {};
  Object.entries(groups).forEach(([key, list]) => {
    if (!list) return;
    out[key] = list.map((a) => ({
      symbol: a.symbol,
      price: db.getPrice(a.symbol) || null,
    }));
  });

  res.json(out);
});

module.exports = router;
