const prisma = require('../config/prisma');
const config = require('../config/env');
const { ApiError } = require('../utils/errors');
const storageService = require('./storage.service');
const notificationService = require('./notification.service');
const { qrDataUrl } = require('../utils/qrGenerator');
const { idCardTemplate } = require('../utils/templates/idCard.template');
const { renderPdf } = require('../utils/pdfRenderer');
const { EXTENSION_CONTENT_TYPES, sniffMime } = require('../utils/mime');
const path = require('path');

async function toDataUrl(storageKey) {
  if (!storageKey) return null;
  try {
    const buffer = await storageService.getObjectBuffer(storageKey);
    const mime =
      EXTENSION_CONTENT_TYPES[path.extname(storageKey).toLowerCase()] ||
      sniffMime(buffer) ||
      'image/png';
    return `data:${mime};base64,${buffer.toString('base64')}`;
  } catch (err) {
    console.error('[idcard] asset load failed:', storageKey, err.message);
    return null;
  }
}

async function nextCardNumber() {
  const year = new Date().getFullYear();
  const count = await prisma.idCard.count({
    where: { cardNumber: { startsWith: `UNICTS-${year}-` } },
  });
  return `UNICTS-${year}-${String(count + 1).padStart(4, '0')}`;
}

// Runs as a background job after approval (see jobs/generateIdCard.job.js).
async function generateForApplication(applicationId) {
  const application = await prisma.membershipApplication.findUnique({
    where: { id: applicationId },
    include: {
      user: { include: { memberProfile: { include: { addresses: true } } } },
      membershipGroup: true,
      idCard: true,
    },
  });
  if (!application) throw new Error(`Application ${applicationId} not found`);
  if (application.status !== 'APPROVED') {
    throw new Error(`Application ${applicationId} is not approved — skipping card`);
  }

  const profile = application.user.memberProfile;
  const org = await prisma.organizationSettings.findFirst();
  const permanent =
    profile && profile.addresses.find((a) => a.type === 'PERMANENT');

  const cardNumber = application.idCard
    ? application.idCard.cardNumber
    : await nextCardNumber();

  // QR resolves to the UNICTS-hosted verification page; the member's social
  // link is surfaced from that page rather than encoded on the card itself.
  const qrTarget = `${config.appUrl}/verify/${cardNumber}`;

  const html = idCardTemplate({
    orgName: (org && org.orgName) || 'UNICTS',
    orgLogoDataUrl: await toDataUrl(org && org.orgLogoUrl),
    memberName: [profile && profile.firstName, profile && profile.lastName]
      .filter(Boolean)
      .join(' '),
    category: application.category,
    cardNumber,
    photoDataUrl: await toDataUrl(profile && profile.profilePictureUrl),
    bloodGroup: profile && profile.bloodGroup,
    addressLine: permanent
      ? `${permanent.tole}, ${permanent.municipality}-${permanent.wardNumber}, ${permanent.district}, ${permanent.province}`
      : null,
    issuedAt: new Date(),
    expiresAt: application.expiresAt,
    qrDataUrl: await qrDataUrl(qrTarget),
    memberSignatureDataUrl: await toDataUrl(profile && profile.signatureUrl),
    presidentSignatureDataUrl: await toDataUrl(org && org.presidentSignatureUrl),
    presidentName: org && org.presidentName,
  });

  const pdfBuffer = await renderPdf(html, { width: '85.6mm', height: '54mm' });
  const pdfKey = `idcards/${cardNumber}.pdf`;
  await storageService.putObject(pdfKey, Buffer.from(pdfBuffer), 'application/pdf');

  const card = await prisma.idCard.upsert({
    where: { membershipApplicationId: application.id },
    create: {
      membershipApplicationId: application.id,
      cardNumber,
      qrCodeData: qrTarget,
      memberSignatureUrl: profile && profile.signatureUrl,
      presidentSignatureUrl: org && org.presidentSignatureUrl,
      pdfUrl: pdfKey,
      issuedAt: new Date(),
      expiresAt: application.expiresAt,
      status: 'ACTIVE',
    },
    update: {
      qrCodeData: qrTarget,
      memberSignatureUrl: profile && profile.signatureUrl,
      presidentSignatureUrl: org && org.presidentSignatureUrl,
      pdfUrl: pdfKey,
      issuedAt: new Date(),
      expiresAt: application.expiresAt,
      status: 'ACTIVE',
    },
  });

  await notificationService.sendToUser(application.userId, {
    channel: 'IN_APP',
    type: 'ID_CARD_READY',
  });

  return card;
}

async function getMyCard(userId) {
  const application = await prisma.membershipApplication.findFirst({
    where: { userId, status: 'APPROVED' },
    orderBy: { createdAt: 'desc' },
    include: { idCard: true },
  });
  if (!application) {
    throw ApiError.notFound(
      'Your ID card becomes available once your application is approved',
      'NO_CARD'
    );
  }
  if (!application.idCard) {
    return { status: 'PENDING', message: 'Your ID card is being generated' };
  }
  return application.idCard;
}

async function getDownloadUrl(userId) {
  const card = await getMyCard(userId);
  if (!card.pdfUrl) {
    throw ApiError.notFound('Your ID card PDF is still being generated', 'CARD_PENDING');
  }
  return { url: await storageService.getSignedUrl(card.pdfUrl, { expiresIn: 300 }) };
}

// Public verification endpoint backing the QR code (see §9.8 of the spec).
async function verifyCard(cardNumber) {
  const card = await prisma.idCard.findUnique({
    where: { cardNumber },
    include: {
      membershipApplication: {
        include: {
          membershipGroup: true,
          user: { include: { memberProfile: true } },
        },
      },
    },
  });
  if (!card) throw ApiError.notFound('No card found with that number', 'CARD_NOT_FOUND');

  const application = card.membershipApplication;
  const profile = application.user.memberProfile;
  const expired = card.expiresAt && card.expiresAt < new Date();
  const valid =
    card.status === 'ACTIVE' &&
    !expired &&
    application.status === 'APPROVED' &&
    application.user.status === 'ACTIVE';

  return {
    valid,
    status: expired && card.status === 'ACTIVE' ? 'EXPIRED' : card.status,
    cardNumber: card.cardNumber,
    memberName: [profile && profile.firstName, profile && profile.lastName]
      .filter(Boolean)
      .join(' '),
    category: application.category,
    group: application.membershipGroup.name,
    issuedAt: card.issuedAt,
    expiresAt: card.expiresAt,
    photoUrl: await storageService.getSignedUrl(profile && profile.profilePictureUrl, {
      expiresIn: 120,
    }),
    socialProfileUrl: profile && profile.socialProfileUrl,
  };
}

module.exports = { generateForApplication, getMyCard, getDownloadUrl, verifyCard };
