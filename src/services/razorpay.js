const Razorpay = require("razorpay");
const crypto = require("crypto");
const config = require("../config");

let instance;
function client() {
  if (!instance) {
    if (!config.razorpay.keyId || !config.razorpay.keySecret) {
      throw new Error("Razorpay keys not configured — check your .env");
    }
    instance = new Razorpay({
      key_id: config.razorpay.keyId,
      key_secret: config.razorpay.keySecret,
    });
  }
  return instance;
}

// Creates a one-time order for a plan (Pro / Elite). The frontend opens
// Razorpay Checkout with this order_id; on success, Razorpay calls our
// webhook (see routes/webhooks.js) which activates the plan.
async function createOrder(userId, planName) {
  const plan = config.plans[planName];
  if (!plan) throw new Error(`Unknown plan: ${planName}`);

  const order = await client().orders.create({
    amount: plan.amount, // in paise
    currency: "INR",
    receipt: `${userId}-${planName}-${Date.now()}`,
    notes: { userId, planName },
  });
  return order;
}

// Verifies the signature Razorpay sends on the checkout success callback
// (client-side handshake) — belt-and-suspenders alongside the webhook.
function verifyPaymentSignature({ orderId, paymentId, signature }) {
  const body = `${orderId}|${paymentId}`;
  const expected = crypto
    .createHmac("sha256", config.razorpay.keySecret)
    .update(body)
    .digest("hex");
  return expected === signature;
}

// Verifies the webhook payload signature (the source of truth — always
// trust this over the client-side callback, which a user could forge).
function verifyWebhookSignature(rawBody, signatureHeader) {
  const expected = crypto
    .createHmac("sha256", config.razorpay.webhookSecret)
    .update(rawBody)
    .digest("hex");
  return expected === signatureHeader;
}

module.exports = { createOrder, verifyPaymentSignature, verifyWebhookSignature };
