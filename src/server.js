const express = require("express");
const cors = require("cors");
const config = require("./config");

const binanceFeed = require("./services/binanceFeed");
const forexFeed = require("./services/forexFeed");
const telegramBot = require("./services/telegramBot");

const signalsRoute = require("./routes/signals");
const pricesRoute = require("./routes/prices");
const subscribeRoute = require("./routes/subscribe");
const webhooksRoute = require("./routes/webhooks");

const app = express();

app.use(cors());

// Razorpay webhook needs the RAW body for signature verification, so it's
// mounted BEFORE the JSON body parser, with its own raw parser.
app.use("/api/webhooks", express.raw({ type: "application/json" }), webhooksRoute);

// everything else gets normal JSON parsing
app.use(express.json());

app.use("/api/signals", signalsRoute);
app.use("/api/prices", pricesRoute);
app.use("/api/subscribe", subscribeRoute);

app.get("/health", (req, res) => res.json({ status: "ok", ts: Date.now() }));

app.listen(config.port, () => {
  console.log(`[server] CandleVolt backend running on port ${config.port}`);

  // start the always-on data feeds + bot — these keep running independent
  // of any browser tab, which is the whole point of moving this off the frontend
  binanceFeed.start();
  forexFeed.start();
  telegramBot.start();
});
