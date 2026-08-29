const express = require("express");
const router = express.Router();
const axios = require("axios");
const config = require("../config");

const INTERVAL_MAP_BINANCE = {
  "1m": "1m", "5m": "5m", "15m": "15m", "1h": "1h", "4h": "4h",
  "1D": "1d", "1w": "1w", "1M": "1M",
};

const INTERVAL_MAP_TWELVEDATA = {
  "1m": "1min", "5m": "5min", "15m": "15min", "1h": "1h", "4h": "4h",
  "1D": "1day", "1w": "1week", "1M": "1month",
};

function binanceSymbolFor(symbol) {
  const all = [...config.assets.crypto, ...config.assets.meme];
  const match = all.find((a) => a.symbol === symbol);
  return match ? match.binance.toUpperCase() : null;
}

function twelveDataSymbolFor(symbol) {
  const all = [...config.assets.forex, ...config.assets.commodities];
  const match = all.find((a) => a.symbol === symbol);
  return match ? match.twelveData : null;
}

const cache = new Map();
const CACHE_MS = 20000;

async function fetchBinance(binSymbol, binInterval, limit) {
  const resp = await axios.get("https://data-api.binance.vision/api/v3/klines", {
    params: { symbol: binSymbol, interval: binInterval, limit },
    timeout: 10000,
  });
  return resp.data.map((k) => ({
    t: Math.floor(k[0] / 1000),
    o: parseFloat(k[1]),
    h: parseFloat(k[2]),
    l: parseFloat(k[3]),
    c: parseFloat(k[4]),
  }));
}

async function fetchTwelveData(tdSymbol, tdInterval, limit) {
  if (!config.twelveDataKey) throw new Error("Twelve Data key not set");
  const resp = await axios.get("https://api.twelvedata.com/time_series", {
    params: {
      symbol: tdSymbol,
      interval: tdInterval,
      outputsize: limit,
      timezone: "UTC",
      apikey: config.twelveDataKey,
    },
    timeout: 10000,
  });
  if (resp.data?.status === "error") throw new Error(resp.data.message);
  const values = resp.data?.values || [];
  return values
    .map((v) => ({
      t: Math.floor(Date.parse(v.datetime + " UTC") / 1000),
      o: parseFloat(v.open),
      h: parseFloat(v.high),
      l: parseFloat(v.low),
      c: parseFloat(v.close),
    }))
    .reverse();
}

router.get("/", async (req, res) => {
  const { symbol, interval = "1m", limit = 200 } = req.query;
  if (!symbol) return res.status(400).json({ error: "symbol is required" });

  const binSymbol = binanceSymbolFor(symbol);
  const tdSymbol = twelveDataSymbolFor(symbol);

  const cacheKey = `${symbol}-${interval}-${limit}`;
  const cached = cache.get(cacheKey);
  if (cached && Date.now() - cached.ts < CACHE_MS) {
    return res.json({ symbol, interval, candles: cached.data });
  }

  try {
    let candles;
    if (binSymbol && INTERVAL_MAP_BINANCE[interval]) {
      candles = await fetchBinance(binSymbol, INTERVAL_MAP_BINANCE[interval], limit);
    } else if (tdSymbol && INTERVAL_MAP_TWELVEDATA[interval]) {
      candles = await fetchTwelveData(tdSymbol, INTERVAL_MAP_TWELVEDATA[interval], limit);
    } else {
      return res.json({ symbol, interval, candles: [] });
    }

    cache.set(cacheKey, { data: candles, ts: Date.now() });
    res.json({ symbol, interval, candles });
  } catch (e) {
    console.error("[candles] fetch failed:", e.message);
    if (cached) return res.json({ symbol, interval, candles: cached.data });
    res.status(502).json({ error: "Could not fetch candle data" });
  }
});

module.exports = router;
