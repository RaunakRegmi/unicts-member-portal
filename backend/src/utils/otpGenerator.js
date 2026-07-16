const crypto = require('crypto');

function generateOtpCode() {
  return String(crypto.randomInt(100000, 1000000));
}

module.exports = { generateOtpCode };
