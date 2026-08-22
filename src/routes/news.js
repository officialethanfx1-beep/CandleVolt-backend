const express = require("express");
const router = express.Router();
const db = require("../db");

// GET /api/news?category=crypto&limit=20
router.get("/", (req, res) => {
  const { category, limit } = req.query;
  const items = db.getNews(category, limit ? parseInt(limit, 10) : 30);
  res.json({ news: items });
});

module.exports = router;
