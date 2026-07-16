const bcrypt = require('bcryptjs');
const { addMinutes } = require('date-fns');
const prisma = require('../config/prisma');
const config = require('../config/env');
const { generateOtpCode } = require('../utils/otpGenerator');
const notificationService = require('./notification.service');
const { ApiError } = require('../utils/errors');

async function issueOtp(user, purpose, channel) {
  let resolvedChannel = channel || user.preferredOtpChannel || 'SMS';
  if (resolvedChannel === 'EMAIL' && !user.email) resolvedChannel = 'SMS';
  // Admin-imported accounts may have no phone number
  if (resolvedChannel === 'SMS' && !user.phoneNumber) resolvedChannel = 'EMAIL';

  const code = generateOtpCode();
  await prisma.otpVerification.create({
    data: {
      userId: user.id,
      otpCodeHash: await bcrypt.hash(code, 8),
      deliveryChannel: resolvedChannel,
      purpose,
      expiresAt: addMinutes(new Date(), config.otp.ttlMinutes),
    },
  });

  await notificationService.sendToUser(user.id, {
    channel: resolvedChannel,
    type: 'OTP',
    subject: 'Your UNICTS verification code',
    context: { code, ttl: config.otp.ttlMinutes },
  });

  if (config.otp.devEcho) {
    console.log(`[otp:dev] ${purpose} code for ${user.phoneNumber || user.email}: ${code}`);
  }

  return {
    channel: resolvedChannel,
    expiresInMinutes: config.otp.ttlMinutes,
    // Exposed only when OTP_DEV_ECHO=true outside production
    devOtp: config.otp.devEcho ? code : undefined,
  };
}

async function verifyOtp(user, code, purpose) {
  const otp = await prisma.otpVerification.findFirst({
    where: {
      userId: user.id,
      purpose,
      verifiedAt: null,
      expiresAt: { gt: new Date() },
    },
    orderBy: { createdAt: 'desc' },
  });

  if (!otp) {
    throw ApiError.badRequest('No active code found — request a new one', 'OTP_NOT_FOUND');
  }
  if (otp.attempts >= config.otp.maxAttempts) {
    throw ApiError.badRequest(
      'Too many incorrect attempts — request a new code',
      'OTP_LOCKED'
    );
  }

  const matches = await bcrypt.compare(code, otp.otpCodeHash);
  if (!matches) {
    await prisma.otpVerification.update({
      where: { id: otp.id },
      data: { attempts: { increment: 1 } },
    });
    throw ApiError.badRequest('Incorrect verification code', 'OTP_INCORRECT');
  }

  await prisma.otpVerification.update({
    where: { id: otp.id },
    data: { verifiedAt: new Date() },
  });
  return true;
}

module.exports = { issueOtp, verifyOtp };
