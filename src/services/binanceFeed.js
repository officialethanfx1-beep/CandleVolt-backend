const WebSocket = require("ws");
const config = require("../config");
const { ingestPrice } = require("./signalEngine");

const BINANCE_WS_BASE = "wss://stream.binance.com:9443/stream?streams=";

function symbolLookup() {
  const map = {};
  [...config.assets.crypto, ...config.assets.meme].forEach((a) => {
    map[a.binance] = a.symbol;
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
        // Only feed the signal engine a CLOSED candle (k.x === true), not
        // every partial tick — this is what was causing overly frequent,
        // noisy signals with razor-thin targets/stops.
        if (binanceSym && k && k.x === true && lookup[binanceSym]) {
          ingestPrice(lookup[binanceSym], parseFloat(k.c));
        }
        // Still update the live displayed price on every tick, just don't
        // feed it into the signal math.
        if (binanceSym && k && lookup[binanceSym]) {
          require("../db").setPrice(lookup[binanceSym], parseFloat(k.c));
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
