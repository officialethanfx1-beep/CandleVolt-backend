const express = require("express");
const cors = require("cors");
const config = require("./config");

const binanceFeed = require("./services/binanceFeed");
const forexFeed = require("./services/forexFeed");
const telegramBot = require("./services/telegramBot");
const cryptoPayments = require("./services/cryptoPayments");
const newsFeed = require("./services/newsFeed");
const calendarFeed = require("./services/calendarFeed");
const dailyAnalysis = require("./services/dailyAnalysis");

const signalsRoute = require("./routes/signals");
const pricesRoute = require("./routes/prices");
const subscribeRoute = require("./routes/subscribe");
const webhooksRoute = require("./routes/webhooks");
const candlesRoute = require("./routes/candles");
const newsRoute = require("./routes/news");
const authRoute = require("./routes/auth");
const calendarRoute = require("./routes/calendar");
const analysisRoute = require("./routes/analysis");

const app = express();

app.use(cors());

app.use("/api/webhooks", express.raw({ type: "application/json" }), webhooksRoute);

app.use(express.json());

app.use("/api/signals", signalsRoute);
app.use("/api/prices", pricesRoute);
app.use("/api/subscribe", subscribeRoute);
app.use("/api/candles", candlesRoute);
app.use("/api/news", newsRoute);
app.use("/api/auth", authRoute);
app.use("/api/calendar", calendarRoute);
app.use("/api/analysis", analysisRoute);

app.get("/health", (req, res) => res.json({ status: "ok", ts: Date.now() }));

app.listen(config.port, () => {
  console.log(`[server] CandleVolt backend running on port ${config.port}`);

  binanceFeed.start();
  forexFeed.start();
  telegramBot.start();
  cryptoPayments.start();
  newsFeed.start();
  calendarFeed.start();
  dailyAnalysis.start();
});
