const prisma = require('../config/prisma');
const { ApiError } = require('../utils/errors');
const storageService = require('./storage.service');
const membershipService = require('./membership.service');
const kycService = require('./kyc.service');
const { sniffMime, DOCUMENT_TYPES } = require('../utils/mime');

function assertDocumentFile(file, label) {
  const mime = sniffMime(file.buffer);
  if (!DOCUMENT_TYPES.includes(mime)) {
    throw ApiError.unprocessable(`${label} must be a JPG, PNG, or PDF`, 'BAD_FILE_TYPE');
  }
  return mime;
}

async function storeDocumentFile(file, folder) {
  const mime = assertDocumentFile(file, 'Document');
  const key = storageService.makeKey(folder, file.originalname);
  await storageService.putObject(key, file.buffer, mime);
  return key;
}

async function uploadIdentityDocument(userId, { documentType, documentNumber }, files) {
  await kycService.assertKycEditable(userId);
  const profile = await kycService.ensureProfile(userId);

  const front = files && files.front && files.front[0];
  const back = files && files.back && files.back[0];
  if (!front) {
    throw ApiError.badRequest('The front image/scan of the document is required', 'MISSING_FRONT');
  }

  const frontKey = await storeDocumentFile(front, 'documents');
  const backKey = back ? await storeDocumentFile(back, 'documents') : null;

  const existing = await prisma.identityDocument.findUnique({
    where: {
      memberProfileId_documentType: { memberProfileId: profile.id, documentType },
    },
  });

  const document = await prisma.identityDocument.upsert({
    where: {
      memberProfileId_documentType: { memberProfileId: profile.id, documentType },
    },
    create: {
      memberProfileId: profile.id,
      documentType,
      documentNumber,
      frontImageUrl: frontKey,
      backImageUrl: backKey,
    },
    update: {
      documentNumber,
      frontImageUrl: frontKey,
      backImageUrl: backKey || (existing && existing.backImageUrl),
      verificationStatus: 'PENDING',
    },
  });

  // Best-effort cleanup of replaced files
  if (existing && existing.frontImageUrl && existing.frontImageUrl !== frontKey) {
    await storageService.deleteObject(existing.frontImageUrl).catch(() => {});
  }
  if (existing && existing.backImageUrl && backKey && existing.backImageUrl !== backKey) {
    await storageService.deleteObject(existing.backImageUrl).catch(() => {});
  }

  const completionPercent = await membershipService.recalculateCompletion(userId);
  return { document: await withSignedUrls(document), completionPercent };
}

async function withSignedUrls(document) {
  return {
    ...document,
    frontImageUrl: await storageService.getSignedUrl(document.frontImageUrl),
    backImageUrl: await storageService.getSignedUrl(document.backImageUrl),
  };
}

async function listDocuments(userId) {
  const profile = await prisma.memberProfile.findUnique({ where: { userId } });
  if (!profile) return [];
  const documents = await prisma.identityDocument.findMany({
    where: { memberProfileId: profile.id },
    orderBy: { documentType: 'asc' },
  });
  return Promise.all(documents.map(withSignedUrls));
}

// Spec: removing documents is allowed pre-submission only.
async function deleteDocument(userId, documentId) {
  const application = await membershipService.getActiveApplication(userId);
  if (application && !membershipService.EDITABLE_STATUSES.includes(application.status)) {
    throw ApiError.forbidden(
      'Documents can only be removed before submission',
      'APPLICATION_LOCKED'
    );
  }

  const profile = await prisma.memberProfile.findUnique({ where: { userId } });
  const document =
    profile &&
    (await prisma.identityDocument.findFirst({
      where: { id: documentId, memberProfileId: profile.id },
    }));
  if (!document) throw ApiError.notFound('Document not found');

  await prisma.identityDocument.delete({ where: { id: document.id } });
  await storageService.deleteObject(document.frontImageUrl).catch(() => {});
  await storageService.deleteObject(document.backImageUrl).catch(() => {});

  const completionPercent = await membershipService.recalculateCompletion(userId);
  return { deleted: true, completionPercent };
}

module.exports = {
  assertDocumentFile,
  storeDocumentFile,
  uploadIdentityDocument,
  listDocuments,
  deleteDocument,
};
