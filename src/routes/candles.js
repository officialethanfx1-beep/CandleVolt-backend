const express = require("express");
const router = express.Router();
const axios = require("axios");
const config = require("../config");

const INTERVAL_MAP = {
  "1m": "1m",
  "5m": "5m",
  "15m": "15m",
  "1h": "1h",
  "4h": "4h",
  "1D": "1d",
  "1w": "1w",
  "1M": "1M",
};

function binanceSymbolFor(symbol) {
  const all = [...config.assets.crypto, ...config.assets.meme];
  const match = all.find((a) => a.symbol === symbol);
  return match ? match.binance.toUpperCase() : null;
}

const cache = new Map();
const CACHE_MS = 15000;

router.get("/", async (req, res) => {
  const { symbol, interval = "1m", limit = 200 } = req.query;
  if (!symbol) return res.status(400).json({ error: "symbol is required" });

  const binSymbol = binanceSymbolFor(symbol);
  const binInterval = INTERVAL_MAP[interval];
  if (!binSymbol || !binInterval) {
    return res.json({ symbol, interval, candles: [] });
  }

  const cacheKey = `${binSymbol}-${binInterval}-${limit}`;
  const cached = cache.get(cacheKey);
  if (cached && Date.now() - cached.ts < CACHE_MS) {
    return res.json({ symbol, interval, candles: cached.data });
  }

  try {
    const resp = await axios.get("https://data-api.binance.vision/api/v3/klines", {
      params: { symbol: binSymbol, interval: binInterval, limit },
      timeout: 10000,
    });

    const candles = resp.data.map((k) => ({
      t: Math.floor(k[0] / 1000),
      o: parseFloat(k[1]),
      h: parseFloat(k[2]),
      l: parseFloat(k[3]),
      c: parseFloat(k[4]),
    }));

    cache.set(cacheKey, { data: candles, ts: Date.now() });
    res.json({ symbol, interval, candles });
  } catch (e) {
    console.error("[candles] Binance fetch failed:", e.message);
    if (cached) return res.json({ symbol, interval, candles: cached.data });
    res.status(502).json({ error: "Could not fetch candle data" });
  }
});

module.exports = router;
