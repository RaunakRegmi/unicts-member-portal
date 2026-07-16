const bcrypt = require('bcryptjs');
const prisma = require('../config/prisma');
const { ApiError } = require('../utils/errors');
const tokenService = require('./token.service');
const otpService = require('./otp.service');

const normalizePhone = (phone) => phone.replace(/[\s()-]/g, '');

function splitName(fullName) {
  const parts = fullName.trim().split(/\s+/);
  if (parts.length === 1) return { firstName: parts[0], lastName: null };
  return { firstName: parts.slice(0, -1).join(' '), lastName: parts[parts.length - 1] };
}

function publicUser(user) {
  return {
    id: user.id,
    phoneNumber: user.phoneNumber,
    email: user.email,
    role: user.role,
    status: user.status,
    preferredOtpChannel: user.preferredOtpChannel,
  };
}

async function findUserByIdentifier(identifier) {
  const where = identifier.includes('@')
    ? { email: identifier.toLowerCase() }
    : { phoneNumber: normalizePhone(identifier) };
  return prisma.user.findUnique({ where });
}

async function signup({ name, email, phoneNumber, password, otpChannel }) {
  const phone = normalizePhone(phoneNumber);
  const normalizedEmail = email.toLowerCase();
  const { firstName, lastName } = splitName(name);
  const passwordHash = await bcrypt.hash(password, 10);

  const existing = await prisma.user.findFirst({
    where: { OR: [{ phoneNumber: phone }, { email: normalizedEmail }] },
  });

  let user;
  if (existing) {
    if (existing.status !== 'PENDING_VERIFICATION' || existing.phoneNumber !== phone) {
      throw ApiError.conflict(
        'An account with that phone number or email already exists',
        'ACCOUNT_EXISTS'
      );
    }
    // Unverified re-signup: refresh the details and resend the OTP
    user = await prisma.user.update({
      where: { id: existing.id },
      data: {
        email: normalizedEmail,
        passwordHash,
        preferredOtpChannel: otpChannel,
        memberProfile: {
          upsert: {
            create: { firstName, lastName, mobileNumber: phone },
            update: { firstName, lastName, mobileNumber: phone },
          },
        },
      },
    });
  } else {
    user = await prisma.user.create({
      data: {
        phoneNumber: phone,
        email: normalizedEmail,
        passwordHash,
        preferredOtpChannel: otpChannel,
        memberProfile: { create: { firstName, lastName, mobileNumber: phone } },
      },
    });
  }

  const otp = await otpService.issueOtp(user, 'SIGNUP', otpChannel);
  return {
    userId: user.id,
    identifier: user.phoneNumber,
    otpChannel: otp.channel,
    expiresInMinutes: otp.expiresInMinutes,
    devOtp: otp.devOtp,
  };
}

async function verifyOtp({ identifier, code, purpose = 'SIGNUP' }) {
  const user = await findUserByIdentifier(identifier);
  if (!user) throw ApiError.notFound('No account found for that phone/email');

  await otpService.verifyOtp(user, code, purpose);

  if (purpose === 'SIGNUP' && user.status === 'PENDING_VERIFICATION') {
    await prisma.user.update({
      where: { id: user.id },
      data: { status: 'ACTIVE', lastLoginAt: new Date() },
    });
    user.status = 'ACTIVE';
  }
  if (user.status !== 'ACTIVE') {
    throw ApiError.forbidden('Account is suspended or deactivated', 'ACCOUNT_INACTIVE');
  }

  const tokens = await tokenService.issueTokens(user);
  return { user: publicUser(user), tokens };
}

async function resendOtp({ identifier, purpose = 'SIGNUP', channel }) {
  const user = await findUserByIdentifier(identifier);
  if (!user) throw ApiError.notFound('No account found for that phone/email');
  if (purpose === 'SIGNUP' && user.status !== 'PENDING_VERIFICATION') {
    throw ApiError.badRequest('This account is already verified', 'ALREADY_VERIFIED');
  }
  const otp = await otpService.issueOtp(user, purpose, channel);
  return { otpChannel: otp.channel, expiresInMinutes: otp.expiresInMinutes, devOtp: otp.devOtp };
}

async function login({ identifier, phoneNumber, password }) {
  const user = await findUserByIdentifier(identifier || phoneNumber);
  const badCredentials = ApiError.unauthorized(
    'Invalid credentials — check your phone/email and password',
    'BAD_CREDENTIALS'
  );
  if (!user) throw badCredentials;

  const matches = await bcrypt.compare(password, user.passwordHash);
  if (!matches) throw badCredentials;

  if (user.status === 'PENDING_VERIFICATION') {
    await otpService.issueOtp(user, 'SIGNUP');
    throw ApiError.forbidden(
      'Account not verified yet — a new code has been sent',
      'VERIFICATION_REQUIRED'
    );
  }
  if (user.status !== 'ACTIVE') {
    throw ApiError.forbidden('Account is suspended or deactivated', 'ACCOUNT_INACTIVE');
  }

  await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
  const tokens = await tokenService.issueTokens(user);
  return { user: publicUser(user), tokens };
}

async function refresh(rawRefreshToken) {
  const { user, tokens } = await tokenService.rotateRefreshToken(rawRefreshToken);
  return { user: publicUser(user), tokens };
}

async function logout(rawRefreshToken) {
  await tokenService.revokeRefreshToken(rawRefreshToken);
}

async function forgotPassword({ identifier }) {
  const user = await findUserByIdentifier(identifier);
  // Generic response either way so account existence can't be probed
  if (!user) return { sent: true };
  const otp = await otpService.issueOtp(user, 'PASSWORD_RESET');
  return { sent: true, otpChannel: otp.channel, devOtp: otp.devOtp };
}

async function resetPassword({ identifier, code, newPassword }) {
  const user = await findUserByIdentifier(identifier);
  if (!user) throw ApiError.notFound('No account found for that phone/email');

  await otpService.verifyOtp(user, code, 'PASSWORD_RESET');
  await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash: await bcrypt.hash(newPassword, 10) },
  });
  await tokenService.revokeAllForUser(user.id);
  return { reset: true };
}

async function getMe(userId) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { memberProfile: { include: { ictDomain: true } } },
  });
  if (!user) throw ApiError.notFound('User not found');
  return { ...publicUser(user), profile: user.memberProfile };
}

module.exports = {
  signup,
  verifyOtp,
  resendOtp,
  login,
  refresh,
  logout,
  forgotPassword,
  resetPassword,
  getMe,
  normalizePhone,
  splitName,
  findUserByIdentifier,
};
