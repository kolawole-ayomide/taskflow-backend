const jwt = require('jsonwebtoken');

if (!process.env.JWT_SECRET) {
  throw new Error(
    'JWT_SECRET environment variable is required. Set it in your .env (or .env.test) file before starting the server.'
  );
}

const JWT_SECRET = process.env.JWT_SECRET;
const JWT_EXPIRES_IN = '7d';

const generateToken = (payload) => {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
};

const verifyToken = (token) => {
  return jwt.verify(token, JWT_SECRET);
};

module.exports = { generateToken, verifyToken };