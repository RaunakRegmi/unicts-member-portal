const prisma = require('../config/prisma');
const { ApiError } = require('../utils/errors');

// Membership is free (NPR 0) today. This service is the seam where a real
// gateway (eSewa / Khalti / ConnectIPS) plugs in later: implement
// createCheckout + a webhook confirmation and stop auto-waiving.
const MEMBERSHIP_FEE = 0;

async function recordPayment(userId) {
  const application = await prisma.membershipApplication.findFirst({
    where: { userId, status: { not: 'EXPIRED' } },
    orderBy: { createdAt: 'desc' },
  });
  if (!application) {
    throw ApiError.notFound('Start a membership application first', 'NO_APPLICATION');
  }

  return prisma.payment.upsert({
    where: { membershipApplicationId: application.id },
    create: {
      membershipApplicationId: application.id,
      amount: MEMBERSHIP_FEE,
      currency: 'NPR',
      status: 'WAIVED',
      method: 'waived',
      paidAt: new Date(),
    },
    update: {},
  });
}

async function getForApplication(applicationId) {
  return prisma.payment.findUnique({ where: { membershipApplicationId: applicationId } });
}

module.exports = { MEMBERSHIP_FEE, recordPayment, getForApplication };
