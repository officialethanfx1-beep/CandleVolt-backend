const express = require("express");
const router = express.Router();
const razorpay = require("../services/razorpay");
const db = require("../db");
const config = require("../config");

// POST /api/subscribe/create-order  { userId, planName }
// Frontend calls this, then opens Razorpay Checkout with the returned order.
router.post("/create-order", async (req, res) => {
  const { userId, planName } = req.body;
  if (!userId || !planName) {
    return res.status(400).json({ error: "userId and planName are required" });
  }
  if (!config.plans[planName]) {
    return res.status(400).json({ error: `Unknown plan: ${planName}` });
  }

  try {
    db.upsertUser({ id: userId });
    const order = await razorpay.createOrder(userId, planName);
    res.json({
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      keyId: config.razorpay.keyId,
    });
  } catch (e) {
    console.error("[subscribe] order creation failed:", e.message);
    res.status(500).json({ error: "Could not create order" });
  }
});

router.post("/verify", (req, res) => {
  const { orderId, paymentId, signature, userId, planName } = req.body;
  const ok = razorpay.verifyPaymentSignature({ orderId, paymentId, signature });
  if (!ok) return res.status(400).json({ error: "Signature mismatch" });

  db.setUserPlan(userId, planName);
  res.json({ status: "activated", plan: planName });
});

// POST /api/subscribe/create-crypto-order  { userId, planName }
// Generates a unique-to-the-cent USDT amount so this single shared wallet
// can tell which pending order a given on-chain payment belongs to.
router.post("/create-crypto-order", (req, res) => {
  const { userId, planName } = req.body;
  if (!userId || !planName) {
    return res.status(400).json({ error: "userId and planName are required" });
  }
  if (!config.plans[planName]) {
    return res.status(400).json({ error: `Unknown plan: ${planName}` });
  }

  db.upsertUser({ id: userId });

  const baseUsdt = config.plans[planName].amount / 100 / config.usdtInrRate;

  const pending = db.getPendingCryptoOrders();
  const usedOffsets = new Set(pending.map((o) => o.offset));
  let offset = 1;
  while (usedOffsets.has(offset) && offset < 9800) offset++;

  const expectedAmount = Math.round((baseUsdt + offset / 10000) * 1e6) / 1e6;
  const amountUnits = Math.round(expectedAmount * 1e6);

  const order = {
    id: `crypto-${userId}-${Date.now()}`,
    userId,
    planName,
    offset,
    expectedAmount,
    amountUnits,
    status: "pending",
    createdAt: Date.now(),
    expiresAt: Date.now() + 30 * 60 * 1000, // 30 min to pay
  };
  db.addCryptoOrder(order);

  res.json({
    orderId: order.id,
    walletAddress: config.cryptoWalletTrc20,
    network: "USDT-TRC20",
    amount: expectedAmount,
    expiresAt: order.expiresAt,
  });
});

// GET /api/subscribe/crypto-status?orderId=...
// Frontend polls this after showing the QR — flips to "paid" automatically
// once cryptoPayments.js spots the matching on-chain transfer.
router.get("/crypto-status", (req, res) => {
  const { orderId } = req.query;
  const order = db.getCryptoOrder(orderId);
  if (!order) return res.status(404).json({ error: "not found" });
  res.json({ status: order.status, planName: order.planName });
});

module.exports = router;
