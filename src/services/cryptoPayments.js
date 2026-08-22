const axios = require("axios");
const config = require("../config");
const db = require("../db");
const telegramBot = require("./telegramBot");

const USDT_CONTRACT_TRON = "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t";
const POLL_MS = 30000; // 30s — TronGrid's free tier handles this comfortably

async function pollOnce() {
  const wallet = config.cryptoWalletTrc20;
  if (!wallet) return;

  db.expireOldCryptoOrders();

  const pending = db.getPendingCryptoOrders();
  if (pending.length === 0) return;

  try {
    const res = await axios.get(
      `https://api.trongrid.io/v1/accounts/${wallet}/transactions/trc20`,
      {
        params: { limit: 30, contract_address: USDT_CONTRACT_TRON, only_to: true },
        timeout: 10000,
      }
    );

    const transfers = res.data?.data || [];

    for (const t of transfers) {
      const txid = t.transaction_id;
      if (!txid || db.isTxProcessed(txid)) continue;
      if (t.to !== wallet) continue;

      const valueUnits = parseInt(t.value, 10); // USDT has 6 decimals on Tron
      const match = pending.find(
        (o) => o.status === "pending" && o.amountUnits === valueUnits
      );

      if (match) {
        db.markCryptoOrderPaid(match.id, txid);
        db.setUserPlan(match.userId, match.planName);
        const user = db.getUser(match.userId);
        if (user) telegramBot.notifyPaymentConfirmed(user, match.planName);
        console.log(
          `[cryptoPayments] matched order ${match.id} -> ${match.planName} for ${match.userId} (tx ${txid})`
        );
      }
      db.markTxProcessed(txid);
    }
  } catch (e) {
    console.error("[cryptoPayments] poll failed:", e.message);
  }
}

function start() {
  pollOnce();
  setInterval(pollOnce, POLL_MS);
  console.log("[cryptoPayments] watching wallet", config.cryptoWalletTrc20, "every 30s");
}

module.exports = { start };
