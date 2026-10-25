const rateLimit = require("express-rate-limit");

// Rate limit for authentication endpoints (OTP request / verify)
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 50, // limit each IP to 50 requests per window
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: "Too many authentication requests from this IP, please try again after 15 minutes.",
  },
});

// General API rate limiter
const apiLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: "Too many requests, please slow down.",
  },
});

module.exports = {
  authLimiter,
  apiLimiter,
};
