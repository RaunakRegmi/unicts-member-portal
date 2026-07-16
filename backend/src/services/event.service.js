const prisma = require('../config/prisma');
const { ApiError } = require('../utils/errors');
const storageService = require('./storage.service');
const { sniffMime, IMAGE_TYPES } = require('../utils/mime');
const { calendarQueue } = require('../jobs/queues');

async function withSignedBanner(event) {
  if (!event) return event;
  return {
    ...event,
    bannerImageUrl: await storageService.getSignedUrl(event.bannerImageUrl, {
      expiresIn: 3600,
    }),
  };
}

async function listEvents({ filter } = {}, userId) {
  const now = new Date();
  const where =
    filter === 'upcoming'
      ? { startDatetime: { gt: now } }
      : filter === 'ongoing'
        ? { startDatetime: { lte: now }, endDatetime: { gte: now } }
        : filter === 'past'
          ? { endDatetime: { lt: now } }
          : {};

  const events = await prisma.event.findMany({
    where,
    orderBy: { startDatetime: filter === 'past' ? 'desc' : 'asc' },
    include: {
      _count: { select: { registrations: true } },
      registrations: userId ? { where: { userId }, select: { id: true } } : false,
    },
  });

  return Promise.all(
    events.map(async (e) => ({
      ...(await withSignedBanner(e)),
      registrationCount: e._count.registrations,
      isRegistered: userId ? e.registrations.length > 0 : false,
      _count: undefined,
      registrations: undefined,
    }))
  );
}

async function getEvent(eventId, userId) {
  const event = await prisma.event.findUnique({
    where: { id: eventId },
    include: {
      _count: { select: { registrations: true } },
      registrations: userId ? { where: { userId }, select: { id: true } } : false,
    },
  });
  if (!event) throw ApiError.notFound('Event not found');
  return {
    ...(await withSignedBanner(event)),
    registrationCount: event._count.registrations,
    isRegistered: userId ? event.registrations.length > 0 : false,
    _count: undefined,
    registrations: undefined,
  };
}

async function rsvp(userId, eventId) {
  const event = await prisma.event.findUnique({ where: { id: eventId } });
  if (!event) throw ApiError.notFound('Event not found');
  if (event.endDatetime < new Date()) {
    throw ApiError.badRequest('This event has already ended', 'EVENT_ENDED');
  }

  const registration = await prisma.eventRegistration.upsert({
    where: { eventId_userId: { eventId, userId } },
    create: { eventId, userId },
    update: {},
  });
  return registration;
}

// ---------- Admin CRUD ----------

async function storeBanner(file) {
  const mime = sniffMime(file.buffer);
  if (!IMAGE_TYPES.includes(mime)) {
    throw ApiError.unprocessable('Banner must be a JPG or PNG image', 'BAD_FILE_TYPE');
  }
  const key = storageService.makeKey('event-banners', file.originalname);
  await storageService.putObject(key, file.buffer, mime);
  return key;
}

async function createEvent(adminId, data, bannerFile) {
  const bannerKey = bannerFile ? await storeBanner(bannerFile) : null;
  const event = await prisma.event.create({
    data: {
      title: data.title,
      description: data.description,
      startDatetime: new Date(data.startDatetime),
      endDatetime: new Date(data.endDatetime),
      location: data.location || null,
      bannerImageUrl: bannerKey,
      createdById: adminId,
    },
  });
  await prisma.auditLog.create({
    data: { actorId: adminId, action: 'CREATE_EVENT', entityType: 'Event', entityId: event.id },
  });
  // Push into the Google Calendars of every member who connected theirs
  await calendarQueue.add('syncEventForAllUsers', { eventId: event.id });
  return withSignedBanner(event);
}

async function updateEvent(adminId, eventId, data, bannerFile) {
  const existing = await prisma.event.findUnique({ where: { id: eventId } });
  if (!existing) throw ApiError.notFound('Event not found');

  const bannerKey = bannerFile ? await storeBanner(bannerFile) : undefined;
  const event = await prisma.event.update({
    where: { id: eventId },
    data: {
      title: data.title,
      description: data.description,
      startDatetime: data.startDatetime ? new Date(data.startDatetime) : undefined,
      endDatetime: data.endDatetime ? new Date(data.endDatetime) : undefined,
      location: data.location,
      bannerImageUrl: bannerKey,
    },
  });
  if (bannerKey && existing.bannerImageUrl) {
    await storageService.deleteObject(existing.bannerImageUrl).catch(() => {});
  }
  await prisma.auditLog.create({
    data: { actorId: adminId, action: 'UPDATE_EVENT', entityType: 'Event', entityId: eventId },
  });
  await calendarQueue.add('syncEventForAllUsers', { eventId });
  return withSignedBanner(event);
}

async function deleteEvent(adminId, eventId) {
  const existing = await prisma.event.findUnique({ where: { id: eventId } });
  if (!existing) throw ApiError.notFound('Event not found');

  await prisma.$transaction([
    prisma.calendarSyncedEvent.deleteMany({ where: { eventId } }),
    prisma.eventRegistration.deleteMany({ where: { eventId } }),
    prisma.event.delete({ where: { id: eventId } }),
  ]);
  if (existing.bannerImageUrl) {
    await storageService.deleteObject(existing.bannerImageUrl).catch(() => {});
  }
  await prisma.auditLog.create({
    data: { actorId: adminId, action: 'DELETE_EVENT', entityType: 'Event', entityId: eventId },
  });
  return { deleted: true };
}

module.exports = { listEvents, getEvent, rsvp, createEvent, updateEvent, deleteEvent };
