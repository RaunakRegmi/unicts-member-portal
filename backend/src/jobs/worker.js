// Standalone BullMQ worker process: `npm run worker`.
// Requires REDIS_URL — in dev without Redis, jobs already run inline in the
// API process and this worker is unnecessary.
const config = require('../config/env');
const processors = require('./processors');

if (!config.redisUrl) {
  console.log('REDIS_URL is not set — jobs run inline in the API process. Worker not needed.');
  process.exit(0);
}

const { Worker, Queue } = require('bullmq');
const IORedis = require('ioredis');

const connection = new IORedis(config.redisUrl, { maxRetriesPerRequest: null });

for (const [queueName, handlers] of Object.entries(processors)) {
  const worker = new Worker(
    queueName,
    async (job) => {
      const handler = handlers[job.name];
      if (!handler) throw new Error(`No processor for ${queueName}:${job.name}`);
      return handler(job.data);
    },
    { connection }
  );
  worker.on('completed', (job) => console.log(`[${queueName}:${job.name}] completed`));
  worker.on('failed', (job, err) =>
    console.error(`[${queueName}:${job && job.name}] failed:`, err.message)
  );
}

// Daily renewal reminders at 09:00 Nepal time
(async () => {
  const maintenanceQueue = new Queue('maintenance', { connection });
  await maintenanceQueue.add(
    'renewalReminders',
    {},
    {
      repeat: { pattern: '0 9 * * *', tz: 'Asia/Kathmandu' },
      jobId: 'daily-renewal-reminders',
    }
  );
  console.log('Worker ready — queues:', Object.keys(processors).join(', '));
})();
