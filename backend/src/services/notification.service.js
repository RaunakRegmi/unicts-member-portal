const prisma = require('../config/prisma');
const { sendEmail, sendSms } = require('../config/providers');

const templates = {
  OTP: (ctx) =>
    `Your UNICTS verification code is ${ctx.code}. It expires in ${ctx.ttl} minutes.`,
  MEMBERSHIP_SUBMITTED: () =>
    'Your UNICTS membership application has been submitted and is awaiting review.',
  MEMBERSHIP_APPROVED: () =>
    'Congratulations! Your UNICTS membership has been approved. Your digital ID card is being prepared.',
  MEMBERSHIP_REJECTED: (ctx) =>
    `Your UNICTS membership application was not approved.${ctx.reason ? ` Reason: ${ctx.reason}.` : ''} You can update and resubmit it from the portal.`,
  ID_CARD_READY: () =>
    'Your UNICTS digital ID card is ready — download it from your dashboard.',
  RENEWAL_REMINDER: (ctx) =>
    `Your UNICTS membership expires on ${ctx.date}. Please renew from the member portal.`,
  MEMBERSHIP_RENEWED: (ctx) =>
    `Your UNICTS membership has been renewed and is now valid until ${ctx.date}.`,
  PASSWORD_RESET_INITIATED: () =>
    'A password reset was initiated for your UNICTS account. Use the verification code sent to you to set a new password.',
  CERTIFICATION_ISSUED: (ctx) =>
    `UNICTS has issued you a new certification: ${ctx.title}.`,
  // Admin-registered members get their login credentials + portal URL
  ACCOUNT_CREDENTIALS: (ctx) =>
    `Namaste ${ctx.name}! Your UNICTS member account is ready.\n` +
    `Login: ${ctx.loginUrl}\n` +
    `Login ID: ${ctx.identifier}\n` +
    `Password: ${ctx.password}\n` +
    `Please change your password after logging in: ${ctx.resetUrl}`,
  ACCOUNT_REMINDER: (ctx) =>
    `Namaste ${ctx.name}! You are already registered on the UNICTS Member Portal.\n` +
    `Login: ${ctx.loginUrl}\n` +
    `Forgot your password? Reset it here: ${ctx.resetUrl}`,
  CUSTOM: (ctx) => ctx.message || '',
};

// Never persist secrets in the notifications table
const REDACTED_TYPES = ['OTP', 'ACCOUNT_CREDENTIALS'];

function renderTemplate(type, context = {}) {
  const template = templates[type] || templates.CUSTOM;
  return template(context);
}

async function dispatch(user, channel, content, subject) {
  if (channel === 'SMS') return sendSms({ to: user.phoneNumber, text: content });
  if (channel === 'EMAIL') {
    return sendEmail({ to: user.email, subject: subject || 'UNICTS', text: content });
  }
  return null; // IN_APP — the stored row is the delivery
}

async function sendToUser(userId, { channel, type, context = {}, subject, content }) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new Error(`notification: user ${userId} not found`);

  // Fall back gracefully when the account is missing a contact channel
  // (admin-imported members can be email-only or phone-only)
  let resolvedChannel = channel;
  if (resolvedChannel === 'EMAIL' && !user.email) {
    resolvedChannel = user.phoneNumber ? 'SMS' : 'IN_APP';
  }
  if (resolvedChannel === 'SMS' && !user.phoneNumber) {
    resolvedChannel = user.email ? 'EMAIL' : 'IN_APP';
  }

  const body = content ?? renderTemplate(type, context);
  const storedContent = REDACTED_TYPES.includes(type)
    ? 'Sensitive message sent (content redacted)'
    : body;

  const notification = await prisma.notification.create({
    data: { userId, channel: resolvedChannel, type, content: storedContent },
  });

  try {
    await dispatch(user, resolvedChannel, body, subject);
    return await prisma.notification.update({
      where: { id: notification.id },
      data: { status: 'SENT', sentAt: new Date() },
    });
  } catch (err) {
    console.error('[notification]', err.message);
    return prisma.notification.update({
      where: { id: notification.id },
      data: { status: 'FAILED' },
    });
  }
}

async function listForUser(userId, { limit = 20 } = {}) {
  return prisma.notification.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    take: limit,
  });
}

module.exports = { sendToUser, listForUser, renderTemplate };
