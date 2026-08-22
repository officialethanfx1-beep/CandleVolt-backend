const Parser = require("rss-parser");
const cron = require("node-cron");
const db = require("../db");

const parser = new Parser({ timeout: 8000 });

// Free, no-API-key RSS feeds. These publish within minutes of a story
// going live — there's no artificial embargo like free news APIs impose.
const FEEDS = [
  { url: "https://www.coindesk.com/arc/outboundfeeds/rss/", source: "CoinDesk", category: "crypto" },
  { url: "https://cointelegraph.com/rss", source: "Cointelegraph", category: "crypto" },
  { url: "https://www.investing.com/rss/news_301.rss", source: "Investing.com", category: "forex" },
  { url: "https://www.fxstreet.com/rss/news", source: "FXStreet", category: "forex" },
];

async function pollFeed(feed) {
  try {
    const parsed = await parser.parseURL(feed.url);
    const items = (parsed.items || []).slice(0, 15).map((item) => ({
      id: item.guid || item.link,
      title: item.title,
      link: item.link,
      source: feed.source,
      category: feed.category,
      publishedAt: item.isoDate ? new Date(item.isoDate).getTime() : Date.now(),
    }));
    db.upsertNewsItems(items);
  } catch (e) {
    console.error(`[newsFeed] ${feed.source} failed:`, e.message);
  }
}

async function pollAll() {
  for (const feed of FEEDS) {
    await pollFeed(feed);
  }
}

function start() {
  pollAll();
  cron.schedule("*/2 * * * *", pollAll); // every 2 minutes
  console.log("[newsFeed] polling", FEEDS.map((f) => f.source).join(", "), "every 2 min");
}

module.exports = { start };
