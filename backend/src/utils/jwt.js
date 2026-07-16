const jwt = require('jsonwebtoken');
const config = require('../config/env');

function signAccessToken(user) {
  return jwt.sign({ sub: user.id, role: user.role }, config.jwt.accessSecret, {
    expiresIn: config.jwt.accessExpiresIn,
  });
}

function verifyAccessToken(token) {
  return jwt.verify(token, config.jwt.accessSecret);
}

// Short-lived signed state for flows that round-trip through a third party
// (e.g. the Google OAuth consent redirect, where our auth header is absent).
function signState(payload, expiresIn = '15m') {
  return jwt.sign(payload, config.jwt.accessSecret, { expiresIn });
}

function verifyState(token) {
  return jwt.verify(token, config.jwt.accessSecret);
}

module.exports = { signAccessToken, verifyAccessToken, signState, verifyState };
