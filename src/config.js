require("dotenv").config();

module.exports = {
  port: process.env.PORT || 4000,
  freeDelayMin: parseInt(process.env.FREE_DELAY_MS_MIN || "120000", 10),
  freeDelayMax: parseInt(process.env.FREE_DELAY_MS_MAX || "180000", 10),

  // Signal strategy tuning
  signalCooldownMs: parseInt(process.env.SIGNAL_COOLDOWN_MS || "1200000", 10), // 20 min default
  riskRewardRatio: parseFloat(process.env.RISK_REWARD_RATIO || "2"), // 1:2 default — set to 3 for 1:3

  twelveDataKey: process.env.TWELVE_DATA_API_KEY,

  telegramToken: process.env.TELEGRAM_BOT_TOKEN,

  razorpay: {
    keyId: process.env.RAZORPAY_KEY_ID,
    keySecret: process.env.RAZORPAY_KEY_SECRET,
    webhookSecret: process.env.RAZORPAY_WEBHOOK_SECRET,
  },

  plans: {
    Pro: { amount: parseInt(process.env.PLAN_PRO_AMOUNT || "99900", 10), label: "Pro" },
    Elite: { amount: parseInt(process.env.PLAN_ELITE_AMOUNT || "249900", 10), label: "Elite" },
  },

  assets: {
    crypto: [
      { symbol: "BTC/USDT", binance: "btcusdt" },
      { symbol: "ETH/USDT", binance: "ethusdt" },
      { symbol: "SOL/USDT", binance: "solusdt" },
      { symbol: "BNB/USDT", binance: "bnbusdt" },
    ],
    meme: [
      { symbol: "DOGE/USDT", binance: "dogeusdt" },
      { symbol: "SHIB/USDT", binance: "shibusdt" },
      { symbol: "PEPE/USDT", binance: "pepeusdt" },
      { symbol: "WIF/USDT", binance: "wifusdt" },
    ],
    forex: [
      { symbol: "EUR/USD", twelveData: "EUR/USD" },
      { symbol: "GBP/USD", twelveData: "GBP/USD" },
      { symbol: "USD/JPY", twelveData: "USD/JPY" },
      { symbol: "USD/INR", twelveData: "USD/INR" },
    ],
    commodities: [
      { symbol: "XAU/USD", twelveData: "XAU/USD" },
    ],
  },
};
