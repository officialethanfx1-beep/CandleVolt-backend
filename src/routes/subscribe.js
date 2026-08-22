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
    db.upsertUser({ id: userId }); // ensure the user row exists
    const order = await razorpay.createOrder(userId, planName);
    res.json({
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      keyId: config.razorpay.keyId, // safe to expose — it's the public key
    });
  } catch (e) {
    console.error("[subscribe] order creation failed:", e.message);
    res.status(500).json({ error: "Could not create order" });
  }
});

// POST /api/subscribe/verify  — client-side callback after checkout closes.
// This is a fast-path UX update only; the webhook below is the real source
// of truth in case this call never reaches us (closed tab, network drop).
router.post("/verify", (req, res) => {
  const { orderId, paymentId, signature, userId, planName } = req.body;
  const ok = razorpay.verifyPaymentSignature({ orderId, paymentId, signature });
  if (!ok) return res.status(400).json({ error: "Signature mismatch" });

  db.setUserPlan(userId, planName);
  res.json({ status: "activated", plan: planName });
});

module.exports = router;
