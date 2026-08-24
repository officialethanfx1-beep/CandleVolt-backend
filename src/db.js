// Lightweight JSON-file DB for the MVP.
const low = require("lowdb");
const FileSync = require("lowdb/adapters/FileSync");
const path = require("path");

const adapter = new FileSync(path.join(__dirname, "..", "data.json"));
const db = low(adapter);

db.defaults({
  users: [],
  signals: [],
  prices: {},
  cryptoOrders: [],
  processedTx: [],
  news: [],
  calendarEvents: [],
  analysis: null,
}).write();

function upsertUser({ id, telegramChatId, plan }) {
  const existing = db.get("users").find({ id }).value();
  if (existing) {
    db.get("users")
      .find({ id })
      .assign({
        telegramChatId: telegramChatId ?? existing.telegramChatId,
        plan: plan ?? existing.plan,
      })
      .write();
  } else {
    db.get("users")
      .push({
        id,
        telegramChatId: telegramChatId || null,
        plan: plan || "Free",
        createdAt: Date.now(),
      })
      .write();
  }
  return db.get("users").find({ id }).value();
}

function getUser(id) {
  return db.get("users").find({ id }).value();
}

function getUserByTelegramChat(chatId) {
  return db.get("users").find({ telegramChatId: chatId }).value();
}

function setUserPlan(id, plan) {
  return db.get("users").find({ id }).assign({ plan }).write();
}

function allUsers() {
  return db.get("users").value();
}

function getUserByEmail(email) {
  return db.get("users").find({ email: email.toLowerCase() }).value();
}

function createAccount({ id, email, passwordHash }) {
  const user = {
    id,
    email: email.toLowerCase(),
    passwordHash,
    telegramChatId: null,
    plan: "Free",
    createdAt: Date.now(),
  };
  db.get("users").push(user).write();
  return user;
}

function addSignal(signal) {
  db.get("signals").push(signal).write();
  const all = db.get("signals").value();
  if (all.length > 500) {
    db.set("signals", all.slice(all.length - 500)).write();
  }
  return signal;
}

function recentSignals(marketKey, limit = 30) {
  let q = db.get("signals");
  if (marketKey) q = q.filter({ marketKey });
  return q.takeRight(200).sortBy("ts").reverse().take(limit).value();
}

function setPrice(symbol, price) {
  db.set(`prices.${symbol.replace(/\//g, "_")}`, price).write();
}

function getPrice(symbol) {
  return db.get(`prices.${symbol.replace(/\//g, "_")}`).value();
}

function addCryptoOrder(order) {
  db.get("cryptoOrders").push(order).write();
  return order;
}

function getCryptoOrder(id) {
  return db.get("cryptoOrders").find({ id }).value();
}

function getPendingCryptoOrders() {
  return db.get("cryptoOrders").filter({ status: "pending" }).value();
}

function markCryptoOrderPaid(id, txid) {
  return db
    .get("cryptoOrders")
    .find({ id })
    .assign({ status: "paid", txid, paidAt: Date.now() })
    .write();
}

function expireOldCryptoOrders() {
  const now = Date.now();
  db.get("cryptoOrders")
    .filter((o) => o.status === "pending" && now > o.expiresAt)
    .forEach((o) => {
      db.get("cryptoOrders").find({ id: o.id }).assign({ status: "expired" }).write();
    })
    .value();
}

function isTxProcessed(txid) {
  return db.get("processedTx").includes(txid).value();
}

function markTxProcessed(txid) {
  const arr = db.get("processedTx").value();
  arr.push(txid);
  if (arr.length > 1000) arr.shift();
  db.set("processedTx", arr).write();
}

function upsertNewsItems(items) {
  const existingIds = new Set(db.get("news").map((n) => n.id).value());
  const fresh = items.filter((i) => i.id && !existingIds.has(i.id));
  if (fresh.length === 0) return;
  const all = [...db.get("news").value(), ...fresh]
    .sort((a, b) => b.publishedAt - a.publishedAt)
    .slice(0, 150);
  db.set("news", all).write();
}

function getNews(category, limit = 30) {
  let items = db.get("news").value();
  if (category) items = items.filter((n) => n.category === category);
  return items.slice(0, limit);
}

function setCalendarEvents(events) {
  db.set("calendarEvents", events).write();
}

function getCalendarEvents(impact) {
  let events = db.get("calendarEvents").value();
  if (impact) events = events.filter((e) => e.impact === impact);
  return events;
}

function setAnalysis(analysis) {
  db.set("analysis", analysis).write();
}

function getAnalysis() {
  return db.get("analysis").value();
}

module.exports = {
  upsertUser,
  getUser,
  getUserByTelegramChat,
  setUserPlan,
  allUsers,
  getUserByEmail,
  createAccount,
  addSignal,
  recentSignals,
  setPrice,
  getPrice,
  addCryptoOrder,
  getCryptoOrder,
  getPendingCryptoOrders,
  markCryptoOrderPaid,
  expireOldCryptoOrders,
  isTxProcessed,
  markTxProcessed,
  upsertNewsItems,
  getNews,
  setCalendarEvents,
  getCalendarEvents,
  setAnalysis,
  getAnalysis,
};
