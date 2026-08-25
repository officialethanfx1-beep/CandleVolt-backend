const axios = require("axios");
const config = require("../config");

// Uses Resend (free tier, no domain verification needed for the sandbox
// sender). Get a key at resend.com and set RESEND_API_KEY in Render.
async function sendOtpEmail(email, code) {
  if (!config.resendApiKey) {
    console.warn("[email] RESEND_API_KEY not set — cannot send OTP");
    return false;
  }
  try {
    await axios.post(
      "https://api.resend.com/emails",
      {
        from: "CandleVolt <onboarding@resend.dev>",
        to: [email],
        subject: "Your CandleVolt login code",
        text: `Your CandleVolt login code is ${code}. It expires in 10 minutes.`,
      },
      {
        headers: {
          Authorization: `Bearer ${config.resendApiKey}`,
          "Content-Type": "application/json",
        },
        timeout: 10000,
      }
    );
    return true;
  } catch (e) {
    console.error("[email] send failed:", e.response?.data || e.message);
    return false;
  }
}

module.exports = { sendOtpEmail };
