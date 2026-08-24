const express = require("express");
const router = express.Router();
const db = require("../db");

router.get("/", (req, res) => {
  const analysis = db.getAnalysis();
  res.json(analysis || { text: null, generatedAt: null });
});

module.exports = router;
