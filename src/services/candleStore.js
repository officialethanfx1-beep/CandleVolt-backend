// In-memory rolling OHLC candle store — separate from the SMA/RSI signal
// math in signalEngine.js, since a candlestick chart needs full open/high/
// low/close per bar, not just the closing price.

const MAX_CANDLES = 150;
const store = new Map(); // symbol -> array of { t, o, h, l, c }

function addCandle(symbol, candle) {
  const arr = store.get(symbol) || [];
  arr.push(candle);
  if (arr.length > MAX_CANDLES) arr.shift();
  store.set(symbol, arr);
}

function getCandles(symbol, limit = 100) {
  const arr = store.get(symbol) || [];
  return arr.slice(-limit);
}

module.exports = { addCandle, getCandles };
