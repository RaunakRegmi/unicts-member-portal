const config = require('../config/env');
const processors = require('./processors');

// With REDIS_URL set, jobs go to BullMQ and are consumed by `npm run worker`.
// Without it (local dev), jobs run inline on the next tick so the whole
// system still works with nothing but Postgres running.

let connection = null;
function getConnection() {
  if (!connection) {
    const IORedis = require('ioredis');
    connection = new IORedis(config.redisUrl, { maxRetriesPerRequest: null });
  }
  return connection;
}

function makeQueue(name) {
  if (config.redisUrl) {
    const { Queue } = require('bullmq');
    return new Queue(name, { connection: getConnection() });
  }

  return {
    name,
    inline: true,
    add: async (jobName, data) => {
      setImmediate(() => {
        const handler = processors[name] && processors[name][jobName];
        if (!handler) {
          console.error(`[job:${name}:${jobName}] no processor registered`);
          return;
        }
        Promise.resolve(handler(data)).catch((err) =>
          console.error(`[job:${name}:${jobName}]`, err.message)
        );
      });
      return { inline: true };
    },
  };
}

module.exports = {
  idCardQueue: makeQueue('idcard'),
  notificationQueue: makeQueue('notifications'),
  calendarQueue: makeQueue('calendar'),
  maintenanceQueue: makeQueue('maintenance'),
};
