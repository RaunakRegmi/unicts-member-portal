const { addYears, differenceInDays } = require('date-fns');
const prisma = require('../config/prisma');
const { ApiError } = require('../utils/errors');
const notificationService = require('./notification.service');
const paymentService = require('./payment.service');

// Statuses in which the applicant can still edit their application/KYC data.
// PENDING_APPROVAL is read-only so the admin always reviews a frozen snapshot.
const EDITABLE_STATUSES = ['DRAFT', 'REJECTED'];
const RENEWAL_WINDOW_DAYS = 60;

async function getActiveApplication(userId) {
  return prisma.membershipApplication.findFirst({
    where: { userId, status: { not: 'EXPIRED' } },
    orderBy: { createdAt: 'desc' },
    include: {
      institutionalDetail: true,
      payment: true,
      idCard: true,
      membershipGroup: true,
    },
  });
}

async function assertEditableApplication(userId) {
  const application = await getActiveApplication(userId);
  if (!application) {
    throw ApiError.notFound('Start a membership application first', 'NO_APPLICATION');
  }
  if (!EDITABLE_STATUSES.includes(application.status)) {
    throw ApiError.forbidden(
      'Your application is locked while it is under review',
      'APPLICATION_LOCKED'
    );
  }
  return application;
}

async function startApplication(userId, { category, membershipGroupId }) {
  const existing = await getActiveApplication(userId);
  if (existing) {
    if (EDITABLE_STATUSES.includes(existing.status)) {
      await prisma.membershipApplication.update({
        where: { id: existing.id },
        data: { category },
      });
      await recalculateCompletion(userId);
      return getActiveApplication(userId);
    }
    throw ApiError.conflict(
      'You already have an application in progress',
      'APPLICATION_EXISTS'
    );
  }

  let groupId = membershipGroupId;
  if (!groupId) {
    const central = await prisma.membershipGroup.findUnique({ where: { name: 'Central' } });
    if (!central) throw new Error('Membership group "Central" missing — run prisma db seed');
    groupId = central.id;
  }

  await prisma.membershipApplication.create({
    data: { userId, membershipGroupId: groupId, category },
  });
  await recalculateCompletion(userId);
  return getActiveApplication(userId);
}

async function getCompletionBreakdown(userId) {
  const application = await prisma.membershipApplication.findFirst({
    where: { userId, status: { not: 'EXPIRED' } },
    orderBy: { createdAt: 'desc' },
    include: { institutionalDetail: true },
  });
  const profile = await prisma.memberProfile.findUnique({
    where: { userId },
    include: {
      addresses: true,
      educationDetail: true,
      employmentDetail: true,
      identityDocuments: true,
      cvDocuments: true,
    },
  });

  const p = profile || {};
  const permanent = (p.addresses || []).find((a) => a.type === 'PERMANENT');
  const citizenship = (p.identityDocuments || []).find(
    (d) => d.documentType === 'CITIZENSHIP'
  );
  const nationalId = (p.identityDocuments || []).find(
    (d) => d.documentType === 'NATIONAL_ID'
  );

  const sections = [
    {
      key: 'personal',
      label: 'Personal details',
      complete: Boolean(p.firstName && p.lastName && p.dob && p.gender && p.mobileNumber),
    },
    {
      key: 'address',
      label: 'Address',
      complete: Boolean(
        permanent &&
          permanent.province &&
          permanent.district &&
          permanent.municipality &&
          permanent.wardNumber &&
          permanent.tole
      ),
    },
    {
      key: 'education',
      label: 'Education',
      complete: Boolean(p.educationDetail && p.educationDetail.highestQualification),
    },
    {
      key: 'employment',
      label: 'Employment',
      complete: Boolean(
        p.employmentDetail &&
          p.employmentDetail.natureOfJob &&
          p.employmentDetail.organizationSector
      ),
    },
    {
      key: 'documents',
      label: 'Photo & identity documents',
      complete: Boolean(
        p.profilePictureUrl &&
          citizenship &&
          citizenship.frontImageUrl &&
          nationalId &&
          nationalId.frontImageUrl
      ),
    },
    {
      key: 'cv',
      label: 'CV',
      complete: (p.cvDocuments || []).length > 0,
    },
  ];

  if (application && application.category === 'INSTITUTIONAL') {
    const d = application.institutionalDetail;
    sections.push({
      key: 'institutional',
      label: 'Business verification',
      complete: Boolean(
        d &&
          d.businessName &&
          d.businessRegistrationNumber &&
          d.businessRegistrationDocUrl &&
          d.vatOrPanNumber &&
          d.vatOrPanDocUrl
      ),
    });
  }

  const completed = sections.filter((s) => s.complete).length;
  const percent = Math.round((completed / sections.length) * 100);
  return { sections, percent, applicationId: application ? application.id : null };
}

// Recomputed server-side on every KYC/document write so the progress bar
// can't be spoofed and un-completing a section is reflected immediately.
async function recalculateCompletion(userId) {
  const { percent, applicationId } = await getCompletionBreakdown(userId);
  if (applicationId) {
    await prisma.membershipApplication.update({
      where: { id: applicationId },
      data: { completionPercent: percent },
    });
  }
  return percent;
}

async function getMyApplication(userId) {
  const application = await getActiveApplication(userId);
  if (!application) return { application: null, completion: null };
  const completion = await getCompletionBreakdown(userId);
  return { application, completion };
}

async function saveInstitutionalDetail(userId, fields, docUrls) {
  const application = await assertEditableApplication(userId);
  if (application.category !== 'INSTITUTIONAL') {
    throw ApiError.badRequest(
      'Business verification only applies to institutional applications',
      'NOT_INSTITUTIONAL'
    );
  }

  const existing = application.institutionalDetail;
  const data = {
    businessName: fields.businessName,
    businessRegistrationNumber: fields.businessRegistrationNumber,
    vatOrPanNumber: fields.vatOrPanNumber,
    businessRegistrationDocUrl:
      docUrls.businessRegistrationDocUrl ||
      (existing && existing.businessRegistrationDocUrl) ||
      '',
    vatOrPanDocUrl: docUrls.vatOrPanDocUrl || (existing && existing.vatOrPanDocUrl) || '',
  };

  if (!data.businessRegistrationDocUrl || !data.vatOrPanDocUrl) {
    throw ApiError.unprocessable(
      'Both the business registration document and VAT/PAN document are required',
      'MISSING_BUSINESS_DOCS'
    );
  }

  const detail = await prisma.institutionalDetail.upsert({
    where: { membershipApplicationId: application.id },
    create: { membershipApplicationId: application.id, ...data },
    update: data,
  });
  await recalculateCompletion(userId);
  return detail;
}

async function submitApplication(userId) {
  const application = await assertEditableApplication(userId);

  const percent = await recalculateCompletion(userId);
  if (percent < 100) {
    const { sections } = await getCompletionBreakdown(userId);
    const missing = sections.filter((s) => !s.complete).map((s) => s.label);
    throw ApiError.unprocessable(
      `Complete these sections before submitting: ${missing.join(', ')}`,
      'INCOMPLETE_APPLICATION'
    );
  }

  // Membership fee is NPR 0 today — record a waived payment if the payment
  // step was skipped, so the admin always sees a settled payment.
  if (!application.payment) {
    await paymentService.recordPayment(userId);
  }

  const updated = await prisma.membershipApplication.update({
    where: { id: application.id },
    data: { status: 'PENDING_APPROVAL', submittedAt: new Date(), rejectionReason: null },
  });

  await notificationService.sendToUser(userId, {
    channel: 'IN_APP',
    type: 'MEMBERSHIP_SUBMITTED',
  });

  return updated;
}

// Member-initiated renewal from the portal (admins can also renew manually).
async function renewOwnMembership(userId) {
  const application = await getActiveApplication(userId);
  if (!application || application.status !== 'APPROVED') {
    throw ApiError.badRequest('Only approved memberships can be renewed', 'NOT_APPROVED');
  }
  if (
    application.expiresAt &&
    differenceInDays(application.expiresAt, new Date()) > RENEWAL_WINDOW_DAYS
  ) {
    throw ApiError.badRequest(
      `Renewal opens ${RENEWAL_WINDOW_DAYS} days before your membership expires`,
      'RENEWAL_NOT_OPEN'
    );
  }

  const base =
    application.expiresAt && application.expiresAt > new Date()
      ? application.expiresAt
      : new Date();
  const newExpiry = addYears(base, 1);

  const updated = await prisma.$transaction(async (tx) => {
    const app = await tx.membershipApplication.update({
      where: { id: application.id },
      data: { expiresAt: newExpiry, status: 'APPROVED' },
    });
    if (application.idCard) {
      await tx.idCard.update({
        where: { id: application.idCard.id },
        data: { expiresAt: newExpiry, status: 'ACTIVE' },
      });
    }
    await tx.auditLog.create({
      data: {
        actorId: userId,
        action: 'SELF_RENEW_MEMBERSHIP',
        entityType: 'MembershipApplication',
        entityId: application.id,
      },
    });
    return app;
  });

  await notificationService.sendToUser(userId, {
    channel: 'IN_APP',
    type: 'MEMBERSHIP_RENEWED',
    context: { date: newExpiry.toDateString() },
  });

  return updated;
}

module.exports = {
  EDITABLE_STATUSES,
  getActiveApplication,
  assertEditableApplication,
  startApplication,
  getCompletionBreakdown,
  recalculateCompletion,
  getMyApplication,
  saveInstitutionalDetail,
  submitApplication,
  renewOwnMembership,
};
