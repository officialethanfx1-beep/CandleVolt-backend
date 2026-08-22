const TelegramBot = require("node-telegram-bot-api");
const config = require("../config");
const db = require("../db");
const { onSignal } = require("./signalEngine");

let bot;

function formatSignal(sig) {
  const dirEmoji = sig.direction === "BUY" ? "🟢 BUY" : "🔴 SELL";
  return (
    `${dirEmoji}  *${sig.symbol}*\n` +
    `Entry: \`${sig.entry.toFixed(6)}\`\n` +
    `Target: \`${sig.target.toFixed(6)}\`\n` +
    `Stop: \`${sig.stop.toFixed(6)}\`\n` +
    `Confidence: ${sig.confidence}%\n` +
    `_${sig.reason}_`
  );
}

function start() {
  if (!config.telegramToken) {
    console.warn("[telegramBot] TELEGRAM_BOT_TOKEN not set — bot disabled");
    return;
  }

  bot = new TelegramBot(config.telegramToken, { polling: true });

  bot.onText(/\/start(?:\s+(.+))?/, (msg, match) => {
    const chatId = msg.chat.id;
    // Optional referral/user-id passed as /start <userId> (deep link from the app)
    const userId = match[1] || `tg-${chatId}`;
    db.upsertUser({ id: userId, telegramChatId: chatId, plan: undefined });
    bot.sendMessage(
      chatId,
      "Welcome to *CandleVolt* 📊\n\n" +
        "You'll get live trading signals here as soon as they fire.\n" +
        "Free plan = signals arrive 2–3 min delayed.\n" +
        "Upgrade any time with /upgrade to get real-time alerts.",
      { parse_mode: "Markdown" }
    );
  });

  bot.onText(/\/upgrade/, (msg) => {
    bot.sendMessage(
      msg.chat.id,
      "Open the CandleVolt app → Subscription Plans → Pay with crypto or card, " +
        "and your Telegram alerts switch to real-time automatically once payment confirms."
    );
  });

  bot.onText(/\/status/, (msg) => {
    const user = db.getUserByTelegramChat(msg.chat.id);
    bot.sendMessage(
      msg.chat.id,
      user
        ? `Plan: *${user.plan}*`
        : "You're not registered yet — send /start first.",
      { parse_mode: "Markdown" }
    );
  });

  onSignal((signal) => {
    broadcast(signal);
  });

  console.log("[telegramBot] running (polling mode)");
}

function broadcast(signal) {
  const users = db.allUsers().filter((u) => u.telegramChatId);
  users.forEach((user) => {
    const isFree = (user.plan || "Free") === "Free";
    // Free plan only gets crypto signals, and delayed
    if (isFree && signal.marketKey !== "crypto") return;

    const delay = isFree
      ? config.freeDelayMin + Math.random() * (config.freeDelayMax - config.freeDelayMin)
      : 0;

    setTimeout(() => {
      bot
        .sendMessage(user.telegramChatId, formatSignal(signal), {
          parse_mode: "Markdown",
        })
        .catch((e) => console.error("[telegramBot] send failed:", e.message));
    }, delay);
  });
}

function notifyPaymentConfirmed(user, planName) {
  if (!bot || !user.telegramChatId) return;
  bot
    .sendMessage(
      user.telegramChatId,
      `✅ Payment confirmed — *${planName}* is now active. Real-time signals start now.`,
      { parse_mode: "Markdown" }
    )
    .catch(() => {});
}

module.exports = { start, notifyPaymentConfirmed };
