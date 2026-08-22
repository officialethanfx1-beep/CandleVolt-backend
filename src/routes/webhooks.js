const express = require("express");
const router = express.Router();
const razorpay = require("../services/razorpay");
const db = require("../db");
const telegramBot = require("../services/telegramBot");

// Razorpay dashboard → Settings → Webhooks → point this at
// https://yourdomain.com/api/webhooks/razorpay
// Subscribe to the "payment.captured" event.
//
// IMPORTANT: this route needs the RAW request body to verify the signature,
// so it's mounted with express.raw() in server.js — do not JSON-parse it
// upstream of this handler.
router.post("/razorpay", (req, res) => {
  const signature = req.headers["x-razorpay-signature"];
  const rawBody = req.body; // Buffer, thanks to express.raw()

  const valid = razorpay.verifyWebhookSignature(rawBody, signature);
  if (!valid) {
    console.warn("[webhook] invalid signature — rejecting");
    return res.status(400).send("invalid signature");
  }

  const event = JSON.parse(rawBody.toString("utf8"));

  if (event.event === "payment.captured") {
    const payment = event.payload.payment.entity;
    const notes = payment.notes || {};
    const { userId, planName } = notes;

    if (userId && planName) {
      db.setUserPlan(userId, planName);
      const user = db.getUser(userId);
      if (user) telegramBot.notifyPaymentConfirmed(user, planName);
      console.log(`[webhook] activated ${planName} for user ${userId}`);
    } else {
      console.warn("[webhook] payment.captured missing userId/planName in notes");
    }
  }

  res.json({ received: true });
});

module.exports = router;
