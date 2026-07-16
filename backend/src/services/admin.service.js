const { addYears, addMonths } = require('date-fns');
const prisma = require('../config/prisma');
const { ApiError } = require('../utils/errors');
const storageService = require('./storage.service');
const tokenService = require('./token.service');
const otpService = require('./otp.service');
const notificationService = require('./notification.service');
const { idCardQueue, notificationQueue } = require('../jobs/queues');

const REVIEWABLE_STATUSES = ['SUBMITTED', 'PENDING_APPROVAL'];

async function audit(actorId, action, entityType, entityId, metadata) {
  await prisma.auditLog.create({
    data: { actorId, action, entityType, entityId, metadata },
  });
}

// ---------- Applications ----------

async function listApplications({ status, category, search, page = 1, pageSize = 20 }) {
  const where = {
    ...(status ? { status } : { status: { not: 'DRAFT' } }),
    ...(category ? { category } : {}),
    ...(search
      ? {
          user: {
            OR: [
              { phoneNumber: { contains: search } },
              { email: { contains: search, mode: 'insensitive' } },
              {
                memberProfile: {
                  OR: [
                    { firstName: { contains: search, mode: 'insensitive' } },
                    { lastName: { contains: search, mode: 'insensitive' } },
                  ],
                },
              },
            ],
          },
        }
      : {}),
  };

  const [total, items] = await prisma.$transaction([
    prisma.membershipApplication.count({ where }),
    prisma.membershipApplication.findMany({
      where,
      orderBy: { submittedAt: { sort: 'desc', nulls: 'last' } },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        membershipGroup: true,
        payment: true,
        user: {
          select: {
            id: true,
            phoneNumber: true,
            email: true,
            status: true,
            memberProfile: { select: { firstName: true, lastName: true } },
          },
        },
      },
    }),
  ]);

  return { items, total, page, pageSize };
}

async function getApplication(applicationId) {
  const application = await prisma.membershipApplication.findUnique({
    where: { id: applicationId },
    include: {
      membershipGroup: true,
      institutionalDetail: true,
      payment: true,
      idCard: true,
      user: {
        select: {
          id: true,
          phoneNumber: true,
          email: true,
          status: true,
          role: true,
          createdAt: true,
          memberProfile: {
            include: {
              ictDomain: true,
              addresses: true,
              educationDetail: true,
              employmentDetail: true,
              identityDocuments: true,
              cvDocuments: { include: { template: { select: { name: true } } } },
            },
          },
        },
      },
    },
  });
  if (!application) throw ApiError.notFound('Application not found');

  // Resolve every stored object into a short-lived signed URL for review
  const profile = application.user.memberProfile;
  if (profile) {
    profile.profilePictureUrl = await storageService.getSignedUrl(profile.profilePictureUrl);
    profile.signatureUrl = await storageService.getSignedUrl(profile.signatureUrl);
    profile.identityDocuments = await Promise.all(
      profile.identityDocuments.map(async (d) => ({
        ...d,
        frontImageUrl: await storageService.getSignedUrl(d.frontImageUrl),
        backImageUrl: await storageService.getSignedUrl(d.backImageUrl),
      }))
    );
    profile.cvDocuments = await Promise.all(
      profile.cvDocuments.map(async (c) => ({
        ...c,
        fileUrl: await storageService.getSignedUrl(c.fileUrl),
      }))
    );
  }
  if (application.institutionalDetail) {
    application.institutionalDetail.businessRegistrationDocUrl =
      await storageService.getSignedUrl(
        application.institutionalDetail.businessRegistrationDocUrl
      );
    application.institutionalDetail.vatOrPanDocUrl = await storageService.getSignedUrl(
      application.institutionalDetail.vatOrPanDocUrl
    );
  }
  if (application.idCard) {
    application.idCard.pdfUrl = await storageService.getSignedUrl(application.idCard.pdfUrl);
  }

  return application;
}

async function approveApplication(applicationId, adminId) {
  const existing = await prisma.membershipApplication.findUnique({
    where: { id: applicationId },
    include: { user: { include: { memberProfile: true } } },
  });
  if (!existing) throw ApiError.notFound('Application not found');
  if (!REVIEWABLE_STATUSES.includes(existing.status)) {
    throw ApiError.badRequest(
      `Only submitted applications can be approved (current: ${existing.status})`,
      'NOT_REVIEWABLE'
    );
  }

  const application = await prisma.$transaction(async (tx) => {
    const app = await tx.membershipApplication.update({
      where: { id: applicationId },
      data: {
        status: 'APPROVED',
        reviewedAt: new Date(),
        reviewedById: adminId,
        rejectionReason: null,
        expiresAt: addYears(new Date(), 1),
      },
    });
    if (existing.user.memberProfile) {
      await tx.identityDocument.updateMany({
        where: {
          memberProfileId: existing.user.memberProfile.id,
          verificationStatus: 'PENDING',
        },
        data: { verificationStatus: 'VERIFIED' },
      });
    }
    await tx.auditLog.create({
      data: {
        actorId: adminId,
        action: 'APPROVE_APPLICATION',
        entityType: 'MembershipApplication',
        entityId: applicationId,
      },
    });
    return app;
  });

  // Heavy work happens off the request thread
  await idCardQueue.add('generate', { applicationId: application.id });
  await notificationQueue.add('send', {
    userId: application.userId,
    payload: { channel: 'IN_APP', type: 'MEMBERSHIP_APPROVED' },
  });
  await notificationQueue.add('send', {
    userId: application.userId,
    payload: { channel: existing.user.preferredOtpChannel, type: 'MEMBERSHIP_APPROVED' },
  });

  return application;
}

async function rejectApplication(applicationId, adminId, reason) {
  const existing = await prisma.membershipApplication.findUnique({
    where: { id: applicationId },
    include: { user: true },
  });
  if (!existing) throw ApiError.notFound('Application not found');
  if (!REVIEWABLE_STATUSES.includes(existing.status)) {
    throw ApiError.badRequest(
      `Only submitted applications can be rejected (current: ${existing.status})`,
      'NOT_REVIEWABLE'
    );
  }

  const application = await prisma.$transaction(async (tx) => {
    const app = await tx.membershipApplication.update({
      where: { id: applicationId },
      data: {
        status: 'REJECTED',
        reviewedAt: new Date(),
        reviewedById: adminId,
        rejectionReason: reason,
      },
    });
    await tx.auditLog.create({
      data: {
        actorId: adminId,
        action: 'REJECT_APPLICATION',
        entityType: 'MembershipApplication',
        entityId: applicationId,
        metadata: { reason },
      },
    });
    return app;
  });

  await notificationQueue.add('send', {
    userId: application.userId,
    payload: { channel: 'IN_APP', type: 'MEMBERSHIP_REJECTED', context: { reason } },
  });
  await notificationQueue.add('send', {
    userId: application.userId,
    payload: {
      channel: existing.user.preferredOtpChannel,
      type: 'MEMBERSHIP_REJECTED',
      context: { reason },
    },
  });

  return application;
}

// ---------- Members ----------

async function listMembers({ search, role, status, page = 1, pageSize = 20 }) {
  const where = {
    ...(role ? { role } : {}),
    ...(status ? { status } : {}),
    ...(search
      ? {
          OR: [
            { phoneNumber: { contains: search } },
            { email: { contains: search, mode: 'insensitive' } },
            {
              memberProfile: {
                OR: [
                  { firstName: { contains: search, mode: 'insensitive' } },
                  { lastName: { contains: search, mode: 'insensitive' } },
                ],
              },
            },
          ],
        }
      : {}),
  };

  const [total, items] = await prisma.$transaction([
    prisma.user.count({ where }),
    prisma.user.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: {
        id: true,
        phoneNumber: true,
        email: true,
        role: true,
        status: true,
        createdAt: true,
        lastLoginAt: true,
        memberProfile: { select: { firstName: true, lastName: true } },
        membershipApplications: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: { id: true, status: true, category: true, expiresAt: true },
        },
      },
    }),
  ]);

  return { items, total, page, pageSize };
}

async function getMember(userId) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      phoneNumber: true,
      email: true,
      role: true,
      status: true,
      createdAt: true,
      lastLoginAt: true,
      memberProfile: { include: { ictDomain: true, addresses: true } },
      membershipApplications: {
        orderBy: { createdAt: 'desc' },
        include: { payment: true, idCard: true, membershipGroup: true },
      },
      certifications: { orderBy: { issueDate: 'desc' } },
    },
  });
  if (!user) throw ApiError.notFound('Member not found');

  if (user.memberProfile) {
    user.memberProfile.profilePictureUrl = await storageService.getSignedUrl(
      user.memberProfile.profilePictureUrl
    );
  }
  return user;
}

async function changeRole(actorId, targetUserId, role) {
  if (actorId === targetUserId) {
    throw ApiError.badRequest('You cannot change your own role', 'SELF_ROLE_CHANGE');
  }
  const user = await prisma.user.update({ where: { id: targetUserId }, data: { role } });
  // Role is embedded in the access token — force a fresh login
  await tokenService.revokeAllForUser(targetUserId);
  await audit(actorId, 'CHANGE_ROLE', 'User', targetUserId, { role });
  return { id: user.id, role: user.role };
}

async function changeStatus(actorId, targetUserId, status) {
  if (actorId === targetUserId) {
    throw ApiError.badRequest('You cannot change your own status', 'SELF_STATUS_CHANGE');
  }
  const user = await prisma.user.update({
    where: { id: targetUserId },
    data: { status },
  });
  if (status !== 'ACTIVE') {
    await tokenService.revokeAllForUser(targetUserId);
  }
  await audit(actorId, 'CHANGE_STATUS', 'User', targetUserId, { status });
  return { id: user.id, status: user.status };
}

async function resetMemberPassword(actorId, targetUserId) {
  const user = await prisma.user.findUnique({ where: { id: targetUserId } });
  if (!user) throw ApiError.notFound('Member not found');

  await tokenService.revokeAllForUser(targetUserId);
  await otpService.issueOtp(user, 'PASSWORD_RESET');
  await notificationService.sendToUser(targetUserId, {
    channel: 'IN_APP',
    type: 'PASSWORD_RESET_INITIATED',
  });
  await audit(actorId, 'RESET_PASSWORD', 'User', targetUserId);
  return { sent: true };
}

async function renewMember(actorId, targetUserId, months = 12) {
  const application = await prisma.membershipApplication.findFirst({
    where: { userId: targetUserId, status: 'APPROVED' },
    orderBy: { createdAt: 'desc' },
    include: { idCard: true },
  });
  if (!application) {
    throw ApiError.badRequest('This member has no approved membership to renew', 'NOT_APPROVED');
  }

  const base =
    application.expiresAt && application.expiresAt > new Date()
      ? application.expiresAt
      : new Date();
  const newExpiry = addMonths(base, months);

  const updated = await prisma.$transaction(async (tx) => {
    const app = await tx.membershipApplication.update({
      where: { id: application.id },
      data: { expiresAt: newExpiry },
    });
    if (application.idCard) {
      await tx.idCard.update({
        where: { id: application.idCard.id },
        data: { expiresAt: newExpiry, status: 'ACTIVE' },
      });
    }
    await tx.auditLog.create({
      data: {
        actorId,
        action: 'RENEW_MEMBERSHIP',
        entityType: 'MembershipApplication',
        entityId: application.id,
        metadata: { months, newExpiry: newExpiry.toISOString() },
      },
    });
    return app;
  });

  await notificationQueue.add('send', {
    userId: targetUserId,
    payload: {
      channel: 'IN_APP',
      type: 'MEMBERSHIP_RENEWED',
      context: { date: newExpiry.toDateString() },
    },
  });

  return updated;
}

// ---------- Notifications ----------

async function sendNotifications(actorId, { audience, userId, channel, subject, message }) {
  let targets = [];
  if (audience === 'USER') {
    if (!userId) throw ApiError.badRequest('userId is required for a single recipient');
    targets = [userId];
  } else if (audience === 'ALL_ACTIVE_MEMBERS') {
    const users = await prisma.user.findMany({
      where: { status: 'ACTIVE', role: 'MEMBER' },
      select: { id: true },
    });
    targets = users.map((u) => u.id);
  } else if (audience === 'PENDING_APPLICANTS') {
    const apps = await prisma.membershipApplication.findMany({
      where: { status: { in: REVIEWABLE_STATUSES } },
      select: { userId: true },
    });
    targets = [...new Set(apps.map((a) => a.userId))];
  }

  for (const targetId of targets) {
    await notificationQueue.add('send', {
      userId: targetId,
      payload: { channel, type: 'CUSTOM', subject, context: { message } },
    });
  }

  await audit(actorId, 'SEND_NOTIFICATION', 'Notification', audience, {
    audience,
    channel,
    recipients: targets.length,
  });
  return { queued: targets.length };
}

// ---------- CV templates & dashboard ----------

async function createCvTemplate(actorId, { name, templateSchema }, previewFile) {
  let previewKey = '';
  if (previewFile) {
    const { sniffMime, IMAGE_TYPES } = require('../utils/mime');
    const mime = sniffMime(previewFile.buffer);
    if (!IMAGE_TYPES.includes(mime)) {
      throw ApiError.unprocessable('Preview must be a JPG or PNG image', 'BAD_FILE_TYPE');
    }
    previewKey = storageService.makeKey('cv-templates', previewFile.originalname);
    await storageService.putObject(previewKey, previewFile.buffer, mime);
  }

  const template = await prisma.cvTemplate.create({
    data: { name, previewImageUrl: previewKey, templateSchema: templateSchema || {} },
  });
  await audit(actorId, 'CREATE_CV_TEMPLATE', 'CvTemplate', template.id);
  return template;
}

async function getStats() {
  const [
    pendingApplications,
    approvedApplications,
    rejectedApplications,
    activeMembers,
    upcomingEvents,
    recentApplications,
  ] = await prisma.$transaction([
    prisma.membershipApplication.count({ where: { status: { in: REVIEWABLE_STATUSES } } }),
    prisma.membershipApplication.count({ where: { status: 'APPROVED' } }),
    prisma.membershipApplication.count({ where: { status: 'REJECTED' } }),
    prisma.user.count({ where: { status: 'ACTIVE', role: 'MEMBER' } }),
    prisma.event.count({ where: { startDatetime: { gt: new Date() } } }),
    prisma.membershipApplication.findMany({
      where: { status: { not: 'DRAFT' } },
      orderBy: { submittedAt: { sort: 'desc', nulls: 'last' } },
      take: 5,
      include: {
        user: {
          select: {
            phoneNumber: true,
            memberProfile: { select: { firstName: true, lastName: true } },
          },
        },
      },
    }),
  ]);

  return {
    pendingApplications,
    approvedApplications,
    rejectedApplications,
    activeMembers,
    upcomingEvents,
    recentApplications,
  };
}

module.exports = {
  listApplications,
  getApplication,
  approveApplication,
  rejectApplication,
  listMembers,
  getMember,
  changeRole,
  changeStatus,
  resetMemberPassword,
  renewMember,
  sendNotifications,
  createCvTemplate,
  getStats,
};
