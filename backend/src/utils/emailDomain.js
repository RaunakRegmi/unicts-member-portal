const dns = require('dns').promises;
const config = require('../config/env');

// "Legit email" gate: a syntactically valid address is worthless if its
// domain can't receive mail. MX lookup catches typo'd and fabricated domains
// before an account is created around them.

const CACHE_TTL_MS = 10 * 60 * 1000;
const cache = new Map(); // domain -> { ok, at }

async function hasMxRecords(email) {
  if (!config.emailMxCheck) return true;

  const domain = String(email).split('@')[1];
  if (!domain) return false;
  const key = domain.toLowerCase();

  const cached = cache.get(key);
  if (cached && Date.now() - cached.at < CACHE_TTL_MS) return cached.ok;

  let ok;
  try {
    const records = await dns.resolveMx(key);
    ok = records.length > 0;
  } catch (err) {
    if (err.code === 'ENOTFOUND' || err.code === 'ENODATA') {
      ok = false; // domain doesn't exist / has no mail exchangers
    } else {
      ok = true; // transient DNS trouble — fail open, don't block signups
    }
  }

  cache.set(key, { ok, at: Date.now() });
  return ok;
}

module.exports = { hasMxRecords };
