const { addDays, subDays } = require('date-fns');
const prisma = require('../config/prisma');
const notificationService = require('../services/notification.service');

// Daily maintenance: remind members whose membership expires within 30 days
// (at most once a week per member), and expire ID cards past their validity.
async function run() {
  const now = new Date();

  const expiring = await prisma.membershipApplication.findMany({
    where: {
      status: 'APPROVED',
      expiresAt: { gt: now, lt: addDays(now, 30) },
    },
    include: { user: true },
  });

  let reminded = 0;
  for (const application of expiring) {
    const recentReminder = await prisma.notification.findFirst({
      where: {
        userId: application.userId,
        type: 'RENEWAL_REMINDER',
        createdAt: { gt: subDays(now, 7) },
      },
    });
    if (recentReminder) continue;

    await notificationService.sendToUser(application.userId, {
      channel: application.user.preferredOtpChannel,
      type: 'RENEWAL_REMINDER',
      context: { date: application.expiresAt.toDateString() },
    });
    await notificationService.sendToUser(application.userId, {
      channel: 'IN_APP',
      type: 'RENEWAL_REMINDER',
      context: { date: application.expiresAt.toDateString() },
    });
    reminded += 1;
  }

  const { count: expiredCards } = await prisma.idCard.updateMany({
    where: { status: 'ACTIVE', expiresAt: { lt: now } },
    data: { status: 'EXPIRED' },
  });

  console.log(
    `[renewal-reminders] reminded=${reminded} expiredCards=${expiredCards} checked=${expiring.length}`
  );
  return { reminded, expiredCards };
}

module.exports = { run };
