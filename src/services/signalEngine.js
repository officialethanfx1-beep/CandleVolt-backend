const db = require("../db");
const config = require("../config");

const HISTORY_LEN = 60;
const history = new Map(); // symbol -> array of prices
const listeners = []; // functions called with every new signal

function onSignal(fn) {
  listeners.push(fn);
}

function sma(arr, len) {
  if (arr.length < len) return null;
  const slice = arr.slice(arr.length - len);
  return slice.reduce((a, b) => a + b, 0) / len;
}

function rsi(arr, len = 14) {
  if (arr.length < len + 1) return 50;
  const slice = arr.slice(arr.length - len - 1);
  let gains = 0,
    losses = 0;
  for (let i = 1; i < slice.length; i++) {
    const diff = slice[i] - slice[i - 1];
    if (diff >= 0) gains += diff;
    else losses -= diff;
  }
  if (losses === 0) return 100;
  const rs = gains / losses;
  return 100 - 100 / (1 + rs);
}

function marketKeyFor(symbol) {
  return Object.keys(config.assets).find((k) =>
    config.assets[k].some((a) => a.symbol === symbol)
  );
}

// Call this every time a fresh price tick arrives, from either feed.
function ingestPrice(symbol, price) {
  if (!price || Number.isNaN(price)) return;

  db.setPrice(symbol, price);

  const arr = history.get(symbol) || [];
  arr.push(price);
  if (arr.length > HISTORY_LEN) arr.shift();
  history.set(symbol, arr);

  if (arr.length < 13) return; // need enough candles for SMA12 + RSI

  const shortNow = sma(arr, 5);
  const longNow = sma(arr, 12);
  const shortPrev = sma(arr.slice(0, -1), 5);
  const longPrev = sma(arr.slice(0, -1), 12);
  const r = rsi(arr);
  if (!shortNow || !longNow || !shortPrev || !longPrev) return;

  const crossedUp = shortPrev <= longPrev && shortNow > longNow;
  const crossedDown = shortPrev >= longPrev && shortNow < longNow;
  if (!((crossedUp && r < 68) || (crossedDown && r > 32))) return;

  const direction = crossedUp ? "BUY" : "SELL";
  // volatility estimate from recent range, used to size target/stop
  const recentRange =
    Math.max(...arr.slice(-10)) - Math.min(...arr.slice(-10)) || price * 0.002;
  const risk = recentRange * 0.9;

  const signal = {
    id: `${symbol}-${Date.now()}`,
    symbol,
    marketKey: marketKeyFor(symbol),
    direction,
    entry: price,
    target: direction === "BUY" ? price + risk * 1.8 : price - risk * 1.8,
    stop: direction === "BUY" ? price - risk : price + risk,
    confidence: Math.min(96, Math.round(55 + Math.abs(50 - r) * 0.8)),
    reason:
      direction === "BUY"
        ? "SMA5 crossed above SMA12, RSI cooling from oversold"
        : "SMA5 crossed below SMA12, RSI turning down from overbought",
    ts: Date.now(),
  };

  db.addSignal(signal);
  listeners.forEach((fn) => {
    try {
      fn(signal);
    } catch (e) {
      console.error("[signalEngine] listener error:", e.message);
    }
  });
}

module.exports = { ingestPrice, onSignal };
