const WebSocket = require("ws");
const config = require("../config");
const { ingestPrice } = require("./signalEngine");
const candleStore = require("./candleStore");
const db = require("../db");

const BINANCE_WS_BASE = "wss://stream.binance.com:9443/stream?streams=";

function symbolLookup() {
  const map = {};
  [...config.assets.crypto, ...config.assets.meme].forEach((a) => {
    map[a.binance] = a.symbol; // "btcusdt" -> "BTC/USDT"
  });
  return map;
}

function start() {
  const lookup = symbolLookup();
  const streams = Object.keys(lookup)
    .map((b) => `${b}@kline_1m`)
    .join("/");
  const url = BINANCE_WS_BASE + streams;

  let ws;
  let reconnectDelay = 2000;

  function connect() {
    ws = new WebSocket(url);

    ws.on("open", () => {
      console.log("[binanceFeed] connected —", Object.keys(lookup).length, "symbols");
      reconnectDelay = 2000;
    });

    ws.on("message", (raw) => {
      try {
        const msg = JSON.parse(raw);
        const binanceSym = msg?.stream?.split("@")[0];
        const k = msg?.data?.k;
        if (!binanceSym || !k || !lookup[binanceSym]) return;

        const symbol = lookup[binanceSym];

        // Always keep the live displayed price fresh, every tick.
        db.setPrice(symbol, parseFloat(k.c));

        // Only feed the signal engine + candle store a CLOSED candle
        // (k.x === true) — using every partial tick was firing too many
        // noisy signals with razor-thin targets/stops.
        if (k.x === true) {
          ingestPrice(symbol, parseFloat(k.c));
          candleStore.addCandle(symbol, {
            t: Math.floor(k.t / 1000), // candle open time, seconds (for chart libs)
            o: parseFloat(k.o),
            h: parseFloat(k.h),
            l: parseFloat(k.l),
            c: parseFloat(k.c),
          });
        }
      } catch (e) {
        console.error("[binanceFeed] parse error:", e.message);
      }
    });

    ws.on("close", () => {
      console.warn(`[binanceFeed] disconnected — retrying in ${reconnectDelay}ms`);
      setTimeout(connect, reconnectDelay);
      reconnectDelay = Math.min(reconnectDelay * 1.5, 30000);
    });

    ws.on("error", (err) => {
      console.error("[binanceFeed] error:", err.message);
      ws.close();
    });
  }

  connect();
}

module.exports = { start };
