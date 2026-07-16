const prisma = require('../config/prisma');
const { ApiError } = require('../utils/errors');
const storageService = require('./storage.service');
const notificationService = require('./notification.service');
const { sniffMime, DOCUMENT_TYPES } = require('../utils/mime');

async function withSignedUrl(certification) {
  return {
    ...certification,
    certificateUrl: await storageService.getSignedUrl(certification.certificateUrl, {
      expiresIn: 600,
    }),
  };
}

async function listForUser(userId) {
  const certifications = await prisma.certification.findMany({
    where: { memberUserId: userId },
    orderBy: { issueDate: 'desc' },
  });
  return Promise.all(certifications.map(withSignedUrl));
}

async function issue(adminId, memberUserId, { title, issuingBody, issueDate }, file) {
  const member = await prisma.user.findUnique({ where: { id: memberUserId } });
  if (!member) throw ApiError.notFound('Member not found');

  let certificateKey = null;
  if (file) {
    const mime = sniffMime(file.buffer);
    if (!DOCUMENT_TYPES.includes(mime)) {
      throw ApiError.unprocessable('Certificate must be a JPG, PNG, or PDF', 'BAD_FILE_TYPE');
    }
    certificateKey = storageService.makeKey('certifications', file.originalname);
    await storageService.putObject(certificateKey, file.buffer, mime);
  }

  const certification = await prisma.certification.create({
    data: {
      memberUserId,
      title,
      issuingBody,
      issueDate: new Date(issueDate),
      certificateUrl: certificateKey,
    },
  });

  await prisma.auditLog.create({
    data: {
      actorId: adminId,
      action: 'ISSUE_CERTIFICATION',
      entityType: 'Certification',
      entityId: certification.id,
      metadata: { memberUserId, title },
    },
  });
  await notificationService.sendToUser(memberUserId, {
    channel: 'IN_APP',
    type: 'CERTIFICATION_ISSUED',
    context: { title },
  });

  return withSignedUrl(certification);
}

module.exports = { listForUser, issue };
