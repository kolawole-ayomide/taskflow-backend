const rateLimit = require('express-rate-limit');

// PRD requires rate limiting on auth endpoints specifically (Section 7, Security).
// Skipped entirely in tests — the test suite signs up dozens of users rapidly
// across different files, which would otherwise trip this immediately.
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many attempts. Please try again in a few minutes.' },
  skip: () => process.env.NODE_ENV === 'test',
});

module.exports = { authLimiter };