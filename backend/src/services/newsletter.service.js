const prisma = require('../config/prisma');
const { ApiError } = require('../utils/errors');
const storageService = require('./storage.service');
const { sniffMime, DOCUMENT_TYPES } = require('../utils/mime');

async function withSignedUrl(newsletter) {
  return {
    ...newsletter,
    attachmentUrl: await storageService.getSignedUrl(newsletter.attachmentUrl, {
      expiresIn: 600,
    }),
  };
}

async function list() {
  const newsletters = await prisma.newsletter.findMany({
    orderBy: { publishedAt: 'desc' },
  });
  return Promise.all(newsletters.map(withSignedUrl));
}

async function get(id) {
  const newsletter = await prisma.newsletter.findUnique({ where: { id } });
  if (!newsletter) throw ApiError.notFound('Newsletter not found');
  return withSignedUrl(newsletter);
}

async function publish(adminId, { title, content }, file) {
  let attachmentKey = null;
  if (file) {
    const mime = sniffMime(file.buffer);
    if (!DOCUMENT_TYPES.includes(mime)) {
      throw ApiError.unprocessable('Attachment must be a JPG, PNG, or PDF', 'BAD_FILE_TYPE');
    }
    attachmentKey = storageService.makeKey('newsletters', file.originalname);
    await storageService.putObject(attachmentKey, file.buffer, mime);
  }

  const newsletter = await prisma.newsletter.create({
    data: { title, content, attachmentUrl: attachmentKey, publishedById: adminId },
  });
  await prisma.auditLog.create({
    data: {
      actorId: adminId,
      action: 'PUBLISH_NEWSLETTER',
      entityType: 'Newsletter',
      entityId: newsletter.id,
    },
  });
  return withSignedUrl(newsletter);
}

module.exports = { list, get, publish };
