const prisma = require('../config/prisma');
const { ApiError } = require('../utils/errors');
const membershipService = require('./membership.service');
const storageService = require('./storage.service');
const { sniffMime, IMAGE_TYPES } = require('../utils/mime');

// KYC data is editable in DRAFT/REJECTED, frozen under review, and editable
// again after approval (routine profile upkeep). Only PENDING_APPROVAL locks.
async function assertKycEditable(userId) {
  const application = await membershipService.getActiveApplication(userId);
  if (
    application &&
    ['PENDING_APPROVAL', 'SUBMITTED'].includes(application.status)
  ) {
    throw ApiError.forbidden(
      'Your application is locked while it is under review',
      'APPLICATION_LOCKED'
    );
  }
  return application;
}

async function ensureProfile(userId) {
  return prisma.memberProfile.upsert({
    where: { userId },
    create: { userId },
    update: {},
  });
}

async function updateProfile(userId, data) {
  await assertKycEditable(userId);
  await ensureProfile(userId);

  if (data.ictDomainId) {
    const domain = await prisma.ictDomain.findUnique({ where: { id: data.ictDomainId } });
    if (!domain || !domain.isActive) {
      throw ApiError.badRequest('Unknown ICT domain', 'BAD_ICT_DOMAIN');
    }
  }

  const profile = await prisma.memberProfile.update({
    where: { userId },
    data: {
      firstName: data.firstName,
      lastName: data.lastName,
      dob: data.dob ? new Date(data.dob) : undefined,
      gender: data.gender,
      bloodGroup: data.bloodGroup,
      mobileNumber: data.mobileNumber,
      workplaceTelephone: data.workplaceTelephone,
      ictDomainId: data.ictDomainId === undefined ? undefined : data.ictDomainId,
      socialProfileUrl: data.socialProfileUrl,
      emergencyContactName: data.emergencyContactName,
      emergencyContactPhone: data.emergencyContactPhone,
    },
    include: { ictDomain: true },
  });

  const percent = await membershipService.recalculateCompletion(userId);
  return { profile, completionPercent: percent };
}

async function updateAddress(userId, { permanent, temporary, sameAsPermanent }) {
  await assertKycEditable(userId);
  const profile = await ensureProfile(userId);

  const permanentData = { ...permanent, sameAsPermanent: false };
  await prisma.address.upsert({
    where: {
      memberProfileId_type: { memberProfileId: profile.id, type: 'PERMANENT' },
    },
    create: { memberProfileId: profile.id, type: 'PERMANENT', ...permanentData },
    update: permanentData,
  });

  const temporaryData = sameAsPermanent
    ? { ...permanent, sameAsPermanent: true }
    : { ...temporary, sameAsPermanent: false };
  await prisma.address.upsert({
    where: {
      memberProfileId_type: { memberProfileId: profile.id, type: 'TEMPORARY' },
    },
    create: { memberProfileId: profile.id, type: 'TEMPORARY', ...temporaryData },
    update: temporaryData,
  });

  const addresses = await prisma.address.findMany({
    where: { memberProfileId: profile.id },
  });
  const percent = await membershipService.recalculateCompletion(userId);
  return { addresses, completionPercent: percent };
}

async function updateEducation(userId, data) {
  await assertKycEditable(userId);
  const profile = await ensureProfile(userId);

  const education = await prisma.educationDetail.upsert({
    where: { memberProfileId: profile.id },
    create: { memberProfileId: profile.id, ...data },
    update: data,
  });
  const percent = await membershipService.recalculateCompletion(userId);
  return { education, completionPercent: percent };
}

async function updateEmployment(userId, data) {
  await assertKycEditable(userId);
  const profile = await ensureProfile(userId);

  const employment = await prisma.employmentDetail.upsert({
    where: { memberProfileId: profile.id },
    create: { memberProfileId: profile.id, ...data },
    update: data,
  });
  const percent = await membershipService.recalculateCompletion(userId);
  return { employment, completionPercent: percent };
}

async function setProfilePicture(userId, file) {
  await assertKycEditable(userId);
  const profile = await ensureProfile(userId);

  const mime = sniffMime(file.buffer);
  if (!IMAGE_TYPES.includes(mime)) {
    throw ApiError.unprocessable('Profile picture must be a JPG or PNG image', 'BAD_FILE_TYPE');
  }

  const key = storageService.makeKey('profile-pictures', file.originalname);
  await storageService.putObject(key, file.buffer, mime);
  if (profile.profilePictureUrl) {
    await storageService.deleteObject(profile.profilePictureUrl).catch(() => {});
  }

  await prisma.memberProfile.update({
    where: { userId },
    data: { profilePictureUrl: key },
  });
  const percent = await membershipService.recalculateCompletion(userId);
  return {
    profilePictureUrl: await storageService.getSignedUrl(key),
    completionPercent: percent,
  };
}

// Accepts either an uploaded image file or a signature-pad data URL.
async function setSignature(userId, { file, dataUrl }) {
  await assertKycEditable(userId);
  const profile = await ensureProfile(userId);

  let buffer;
  let mime;
  if (file) {
    buffer = file.buffer;
    mime = sniffMime(buffer);
  } else if (dataUrl) {
    const match = /^data:(image\/(?:png|jpeg));base64,(.+)$/.exec(dataUrl);
    if (!match) throw ApiError.badRequest('Invalid signature image', 'BAD_SIGNATURE');
    mime = match[1];
    buffer = Buffer.from(match[2], 'base64');
  } else {
    throw ApiError.badRequest('Provide a signature image', 'BAD_SIGNATURE');
  }

  if (!IMAGE_TYPES.includes(mime)) {
    throw ApiError.unprocessable('Signature must be a JPG or PNG image', 'BAD_FILE_TYPE');
  }

  const key = storageService.makeKey('signatures', 'signature.png');
  await storageService.putObject(key, buffer, mime);
  if (profile.signatureUrl) {
    await storageService.deleteObject(profile.signatureUrl).catch(() => {});
  }

  await prisma.memberProfile.update({ where: { userId }, data: { signatureUrl: key } });
  return { signatureUrl: await storageService.getSignedUrl(key) };
}

async function getProfile(userId) {
  const profile = await prisma.memberProfile.findUnique({
    where: { userId },
    include: {
      ictDomain: true,
      addresses: true,
      educationDetail: true,
      employmentDetail: true,
    },
  });
  if (!profile) return null;
  return {
    ...profile,
    profilePictureUrl: await storageService.getSignedUrl(profile.profilePictureUrl),
    signatureUrl: await storageService.getSignedUrl(profile.signatureUrl),
    profilePictureKey: profile.profilePictureUrl,
    signatureKey: profile.signatureUrl,
  };
}

module.exports = {
  assertKycEditable,
  ensureProfile,
  updateProfile,
  updateAddress,
  updateEducation,
  updateEmployment,
  setProfilePicture,
  setSignature,
  getProfile,
};
