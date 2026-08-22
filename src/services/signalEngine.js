const db = require("../db");
const config = require("../config");

const HISTORY_LEN = 60;
const history = new Map(); // symbol -> array of closed-candle prices
const lastSignalAt = new Map(); // symbol -> timestamp of last signal fired
const listeners = [];

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
  let gains = 0, losses = 0;
  for (let i = 1; i < slice.length; i++) {
    const diff = slice[i] - slice[i - 1];
    if (diff >= 0) gains += diff;
    else losses -= diff;
  }
  if (losses === 0) return 100;
  const rs = gains / losses;
  return 100 - 100 / (1 + rs);
}

// ATR-style average movement, approximated from closes only (we don't
// track full OHLC per candle) — average absolute move over the lookback.
function avgMove(arr, len = 14) {
  if (arr.length < len + 1) return null;
  const slice = arr.slice(arr.length - len - 1);
  let total = 0;
  for (let i = 1; i < slice.length; i++) total += Math.abs(slice[i] - slice[i - 1]);
  return total / len;
}

function marketKeyFor(symbol) {
  return Object.keys(config.assets).find((k) =>
    config.assets[k].some((a) => a.symbol === symbol)
  );
}

// Call this once per CLOSED candle (not every raw tick) — see binanceFeed.js.
function ingestPrice(symbol, price) {
  if (!price || Number.isNaN(price)) return;
  db.setPrice(symbol, price);

  const arr = history.get(symbol) || [];
  arr.push(price);
  if (arr.length > HISTORY_LEN) arr.shift();
  history.set(symbol, arr);

  if (arr.length < 32) return; // need enough candles for SMA21 + trend SMA30

  const shortNow = sma(arr, 8);
  const longNow = sma(arr, 21);
  const shortPrev = sma(arr.slice(0, -1), 8);
  const longPrev = sma(arr.slice(0, -1), 21);
  const trendNow = sma(arr, 30);
  const r = rsi(arr);
  if (!shortNow || !longNow || !shortPrev || !longPrev || !trendNow) return;

  const crossedUp = shortPrev <= longPrev && shortNow > longNow;
  const crossedDown = shortPrev >= longPrev && shortNow < longNow;

  // Only signal in the direction of the broader trend — filters out a lot
  // of the noisy counter-trend flips that were firing too frequently.
  const upOk = crossedUp && r < 68 && price > trendNow;
  const downOk = crossedDown && r > 32 && price < trendNow;
  if (!upOk && !downOk) return;

  // Per-symbol cooldown so the same instrument can't re-signal every
  // couple of minutes even if the indicators keep flickering.
  const last = lastSignalAt.get(symbol) || 0;
  if (Date.now() - last < config.signalCooldownMs) return;

  const direction = upOk ? "BUY" : "SELL";

  const move = avgMove(arr, 14) || price * 0.003;
  const risk = Math.max(move * 1.2, price * 0.0015); // floor avoids razor-thin stops
  const rr = config.riskRewardRatio;

  const signal = {
    id: `${symbol}-${Date.now()}`,
    symbol,
    marketKey: marketKeyFor(symbol),
    direction,
    entry: price,
    target: direction === "BUY" ? price + risk * rr : price - risk * rr,
    stop: direction === "BUY" ? price - risk : price + risk,
    confidence: Math.min(96, Math.round(55 + Math.abs(50 - r) * 0.8)),
    reason:
      direction === "BUY"
        ? `SMA8 crossed above SMA21 with trend, RSI ${r.toFixed(0)}`
        : `SMA8 crossed below SMA21 with trend, RSI ${r.toFixed(0)}`,
    ts: Date.now(),
  };

  lastSignalAt.set(symbol, Date.now());
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
