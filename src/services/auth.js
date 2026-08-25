const jwt = require("jsonwebtoken");
const config = require("../config");

function signToken(userId) {
  return jwt.sign({ userId }, config.jwtSecret, { expiresIn: "30d" });
}

function verifyToken(token) {
  try {
    return jwt.verify(token, config.jwtSecret);
  } catch {
    return null;
  }
}

function generateOtp() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

module.exports = { signToken, verifyToken, generateOtp };
