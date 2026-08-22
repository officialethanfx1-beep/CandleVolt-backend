const axios = require("axios");
const cron = require("node-cron");
const config = require("../config");
const { ingestPrice } = require("./signalEngine");

// Twelve Data free tier: 8 requests/min, 800/day.
// We batch every symbol into ONE request (comma-separated) so this polls
// well within the limit even at a 1-minute cadence.
const symbols = [...config.assets.forex, ...config.assets.commodities].map(
  (a) => a.twelveData
);

async function pollOnce() {
  if (!config.twelveDataKey) {
    console.warn("[forexFeed] TWELVE_DATA_API_KEY not set — skipping poll");
    return;
  }
  try {
    const res = await axios.get("https://api.twelvedata.com/price", {
      params: {
        symbol: symbols.join(","),
        apikey: config.twelveDataKey,
      },
      timeout: 8000,
    });

    // Twelve Data returns a flat object { price: "1.234" } for a single symbol,
    // or { "EUR/USD": { price: "1.234" }, ... } for multiple.
    const data = res.data;
    if (symbols.length === 1) {
      ingestPrice(symbols[0], parseFloat(data.price));
      return;
    }
    symbols.forEach((sym) => {
      const entry = data[sym];
      if (entry?.price) {
        ingestPrice(sym, parseFloat(entry.price));
      } else if (entry?.code) {
        console.warn(`[forexFeed] ${sym} error:`, entry.message);
      }
    });
  } catch (e) {
    console.error("[forexFeed] poll failed:", e.message);
  }
}

function start() {
  pollOnce(); // fire once immediately on boot
  // every minute — stays well under the free-tier rate limit
  cron.schedule("*/1 * * * *", pollOnce);
  console.log("[forexFeed] polling", symbols.join(", "), "every 60s");
}

module.exports = { start, pollOnce };
