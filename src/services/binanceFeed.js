const WebSocket = require("ws");
const config = require("../config");
const { ingestPrice } = require("./signalEngine");
const db = require("../db");

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
        if (!binanceSym || !k || !lookup[binanceSym]) return;

        const symbol = lookup[binanceSym];
        db.setPrice(symbol, parseFloat(k.c));

        if (k.x === true) {
          ingestPrice(symbol, parseFloat(k.c));
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
