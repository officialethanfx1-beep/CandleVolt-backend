const axios = require("axios");
const cron = require("node-cron");
const config = require("../config");
const db = require("../db");

async function generateOnce() {
  if (!config.anthropicApiKey) {
    console.warn("[dailyAnalysis] ANTHROPIC_API_KEY not set — skipping");
    return;
  }

  try {
    const prices = [
      ...config.assets.crypto,
      ...config.assets.meme,
      ...config.assets.forex,
      ...config.assets.commodities,
    ]
      .map((a) => `${a.symbol}: ${db.getPrice(a.symbol) || "n/a"}`)
      .join("\n");

    const news = db
      .getNews(null, 10)
      .map((n) => `- [${n.source}] ${n.title}`)
      .join("\n");

    const signals = db
      .recentSignals(null, 10)
      .map((s) => `- ${s.direction} ${s.symbol} @ ${s.entry} (target ${s.target}, stop ${s.stop})`)
      .join("\n");

    const calendar = db
      .getCalendarEvents()
      .slice(0, 10)
      .map((e) => `- [${e.impact}] ${e.country} ${e.title} — forecast ${e.forecast || "n/a"}, previous ${e.previous || "n/a"}`)
      .join("\n");

    const prompt = `You are a market analyst writing a short daily briefing for a trading signals app.
Use the real data below to write a concise, professional market summary (under 300 words). Cover: overall sentiment across crypto/forex, any notable news driving markets, and upcoming high-impact economic events to watch. Do NOT make guaranteed predictions — describe current conditions and what to watch for, with appropriate hedging language.

CURRENT PRICES:
${prices}

RECENT NEWS:
${news || "No recent news available."}

RECENT SIGNALS FIRED:
${signals || "No signals fired recently."}

UPCOMING ECONOMIC EVENTS:
${calendar || "No calendar events available."}

Write the briefing now, in plain prose, no markdown headers.`;

    const res = await axios.post(
      "https://api.anthropic.com/v1/messages",
      {
        model: "claude-3-5-haiku-20241022",
        max_tokens: 500,
        messages: [{ role: "user", content: prompt }],
      },
      {
        headers: {
          "x-api-key": config.anthropicApiKey,
          "anthropic-version": "2023-06-01",
          "content-type": "application/json",
        },
        timeout: 30000,
      }
    );

    const text = res.data?.content?.[0]?.text || "";
    db.setAnalysis({ text, generatedAt: Date.now() });
    console.log("[dailyAnalysis] generated new briefing");
  } catch (e) {
    console.error("[dailyAnalysis] generation failed:", e.response?.data || e.message);
  }
}

function start() {
  generateOnce();
  cron.schedule("0 */6 * * *", generateOnce); // every 6 hours
  console.log("[dailyAnalysis] scheduled every 6 hours");
}

module.exports = { start };
