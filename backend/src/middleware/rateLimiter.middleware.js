const redis = require('../config/redis');

// In-memory fallback for dev environments without Redis. Fixed-window
// counters are plenty for OTP/login throttling at this scale.
const memoryBuckets = new Map();

function rateLimiter({ prefix, windowSec, max, keyFn }) {
  return async (req, res, next) => {
    const identifier = keyFn ? keyFn(req) : req.ip;
    const key = `ratelimit:${prefix}:${identifier}`;

    try {
      let count;
      if (redis) {
        count = await redis.incr(key);
        if (count === 1) await redis.expire(key, windowSec);
      } else {
        const now = Date.now();
        const bucket = memoryBuckets.get(key);
        if (!bucket || now > bucket.resetAt) {
          memoryBuckets.set(key, { count: 1, resetAt: now + windowSec * 1000 });
          count = 1;
        } else {
          bucket.count += 1;
          count = bucket.count;
        }
        if (memoryBuckets.size > 10000) {
          for (const [k, b] of memoryBuckets) if (now > b.resetAt) memoryBuckets.delete(k);
        }
      }

      if (count > max) {
        return res.status(429).json({
          success: false,
          error: { code: 'RATE_LIMITED', message: 'Too many requests — please wait and try again' },
        });
      }
      return next();
    } catch (err) {
      // Fail open: a broken limiter store should never take down auth
      console.error('[rate-limiter]', err.message);
      return next();
    }
  };
}

module.exports = rateLimiter;
