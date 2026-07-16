const config = require('./env');

// Redis is optional in development: the rate limiter falls back to an
// in-memory store and background jobs run inline when it's absent.
let redis = null;

if (config.redisUrl) {
  const IORedis = require('ioredis');
  redis = new IORedis(config.redisUrl, { maxRetriesPerRequest: null });
  redis.on('error', (err) => console.error('[redis]', err.message));
}

module.exports = redis;
