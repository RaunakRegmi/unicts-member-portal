const app = require('./app');
const config = require('./config/env');
const prisma = require('./config/prisma');

const server = app.listen(config.port, () => {
  console.log(`UNICTS API listening on http://localhost:${config.port}`);
  console.log(
    config.redisUrl
      ? 'Jobs: BullMQ via Redis (run `npm run worker` in another terminal)'
      : 'Jobs: inline mode (no REDIS_URL set) — no separate worker needed'
  );
});

// Without Redis there is no repeatable BullMQ job, so run the daily
// renewal-reminder sweep from the API process instead.
if (!config.redisUrl) {
  const { run } = require('./jobs/renewalReminder.job');
  const sweep = () => run().catch((err) => console.error('[renewal-reminders]', err.message));
  setTimeout(sweep, 15 * 1000);
  setInterval(sweep, 24 * 60 * 60 * 1000);
}

async function shutdown(signal) {
  console.log(`${signal} received — shutting down`);
  server.close(async () => {
    await prisma.$disconnect();
    process.exit(0);
  });
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
