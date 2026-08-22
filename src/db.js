// Lightweight JSON-file DB for the MVP.
// Fine for a few thousand users; once you have real scale, swap this for
// Postgres (Prisma/Knex) or MongoDB — the function signatures below are
// written so that swap doesn't touch the rest of the codebase.

const low = require("lowdb");
const FileSync = require("lowdb/adapters/FileSync");
const path = require("path");

const adapter = new FileSync(path.join(__dirname, "..", "data.json"));
const db = low(adapter);

db.defaults({
  users: [],        // { id, telegramChatId, plan, createdAt }
  signals: [],       // generated signals (real, from live data)
  prices: {},        // latest known price per symbol
  cryptoOrders: [],  // pending/paid/expired crypto payment orders
  processedTx: [],   // blockchain tx ids already matched, to prevent double-credit
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

// ---- Crypto payment orders ----

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

module.exports = {
  upsertUser,
  getUser,
  getUserByTelegramChat,
  setUserPlan,
  allUsers,
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
};
