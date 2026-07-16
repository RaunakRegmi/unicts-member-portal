const crypto = require('crypto');
const { addDays } = require('date-fns');
const prisma = require('../config/prisma');
const config = require('../config/env');
const { signAccessToken } = require('../utils/jwt');
const { ApiError } = require('../utils/errors');

const hashToken = (token) => crypto.createHash('sha256').update(token).digest('hex');

async function issueTokens(user) {
  const accessToken = signAccessToken(user);
  const refreshToken = crypto.randomBytes(48).toString('hex');
  const refreshExpiresAt = addDays(new Date(), config.jwt.refreshTtlDays);

  await prisma.refreshToken.create({
    data: { userId: user.id, tokenHash: hashToken(refreshToken), expiresAt: refreshExpiresAt },
  });

  return { accessToken, refreshToken, refreshExpiresAt };
}

async function rotateRefreshToken(rawToken) {
  if (!rawToken) throw ApiError.unauthorized('Missing refresh token');

  const record = await prisma.refreshToken.findUnique({
    where: { tokenHash: hashToken(rawToken) },
    include: { user: true },
  });
  if (!record) throw ApiError.unauthorized('Invalid refresh token');

  if (record.revokedAt) {
    // A rotated token came back — assume the token family is compromised
    await revokeAllForUser(record.userId);
    throw ApiError.unauthorized('Refresh token reuse detected');
  }
  if (record.expiresAt < new Date()) throw ApiError.unauthorized('Refresh token expired');
  if (record.user.status !== 'ACTIVE') {
    throw ApiError.forbidden('Account is not active', 'ACCOUNT_INACTIVE');
  }

  await prisma.refreshToken.update({
    where: { id: record.id },
    data: { revokedAt: new Date() },
  });

  return { user: record.user, tokens: await issueTokens(record.user) };
}

async function revokeRefreshToken(rawToken) {
  if (!rawToken) return;
  await prisma.refreshToken.updateMany({
    where: { tokenHash: hashToken(rawToken), revokedAt: null },
    data: { revokedAt: new Date() },
  });
}

async function revokeAllForUser(userId) {
  await prisma.refreshToken.updateMany({
    where: { userId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
}

module.exports = { issueTokens, rotateRefreshToken, revokeRefreshToken, revokeAllForUser };
