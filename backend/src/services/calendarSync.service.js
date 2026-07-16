const prisma = require('../config/prisma');
const config = require('../config/env');
const { ApiError } = require('../utils/errors');
const { signState, verifyState } = require('../utils/jwt');

const TIMEZONE = 'Asia/Kathmandu';

function assertConfigured() {
  if (!config.google.enabled) {
    throw ApiError.badRequest(
      'Google Calendar sync is not configured on this server',
      'GOOGLE_NOT_CONFIGURED'
    );
  }
}

function oauthClient() {
  const { google } = require('googleapis');
  return new google.auth.OAuth2(
    config.google.clientId,
    config.google.clientSecret,
    config.google.redirectUri
  );
}

function getAuthUrl(userId) {
  assertConfigured();
  const client = oauthClient();
  return client.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    scope: ['https://www.googleapis.com/auth/calendar.events'],
    state: signState({ sub: userId, purpose: 'gcal' }),
  });
}

// Google redirects the browser here without our Authorization header, so the
// signed `state` token is what proves which member initiated the flow.
async function handleCallback({ code, state }) {
  assertConfigured();
  let payload;
  try {
    payload = verifyState(state);
  } catch (err) {
    throw ApiError.unauthorized('Invalid or expired OAuth state');
  }
  if (payload.purpose !== 'gcal') throw ApiError.unauthorized('Invalid OAuth state');

  const client = oauthClient();
  const { tokens } = await client.getToken(code);

  const existing = await prisma.googleCalendarToken.findUnique({
    where: { userId: payload.sub },
  });
  await prisma.googleCalendarToken.upsert({
    where: { userId: payload.sub },
    create: {
      userId: payload.sub,
      accessToken: tokens.access_token || '',
      refreshToken: tokens.refresh_token || '',
      expiresAt: tokens.expiry_date ? new Date(tokens.expiry_date) : new Date(),
      scope: tokens.scope || '',
    },
    update: {
      accessToken: tokens.access_token || '',
      refreshToken: tokens.refresh_token || (existing && existing.refreshToken) || '',
      expiresAt: tokens.expiry_date ? new Date(tokens.expiry_date) : new Date(),
      scope: tokens.scope || '',
    },
  });

  return { redirectUrl: `${config.appUrl}/calendar?connected=1` };
}

async function getAuthedCalendar(userId) {
  const { google } = require('googleapis');
  const tokenRow = await prisma.googleCalendarToken.findUnique({ where: { userId } });
  if (!tokenRow) {
    throw ApiError.badRequest('Google Calendar is not connected', 'GOOGLE_NOT_CONNECTED');
  }

  const client = oauthClient();
  client.setCredentials({
    access_token: tokenRow.accessToken,
    refresh_token: tokenRow.refreshToken || undefined,
    expiry_date: tokenRow.expiresAt.getTime(),
  });
  // Persist refreshed tokens so the stored copy stays current
  client.on('tokens', async (tokens) => {
    await prisma.googleCalendarToken
      .update({
        where: { userId },
        data: {
          accessToken: tokens.access_token || tokenRow.accessToken,
          expiresAt: tokens.expiry_date ? new Date(tokens.expiry_date) : tokenRow.expiresAt,
        },
      })
      .catch(() => {});
  });

  return google.calendar({ version: 'v3', auth: client });
}

function toGoogleEvent(event) {
  return {
    summary: event.title,
    description: event.description,
    location: event.location || undefined,
    start: { dateTime: event.startDatetime.toISOString(), timeZone: TIMEZONE },
    end: { dateTime: event.endDatetime.toISOString(), timeZone: TIMEZONE },
  };
}

async function syncEventForUser(calendar, userId, event) {
  const existing = await prisma.calendarSyncedEvent.findUnique({
    where: { userId_eventId: { userId, eventId: event.id } },
  });

  if (existing) {
    await calendar.events.patch({
      calendarId: 'primary',
      eventId: existing.googleEventId,
      requestBody: toGoogleEvent(event),
    });
    return 'updated';
  }

  const created = await calendar.events.insert({
    calendarId: 'primary',
    requestBody: toGoogleEvent(event),
  });
  await prisma.calendarSyncedEvent.create({
    data: { userId, eventId: event.id, googleEventId: created.data.id },
  });
  return 'created';
}

async function getConnectionStatus(userId) {
  const tokenRow = await prisma.googleCalendarToken.findUnique({ where: { userId } });
  return { connected: Boolean(tokenRow), configured: config.google.enabled };
}

// Push all upcoming org events into one member's connected calendar.
async function syncUserCalendar(userId) {
  const calendar = await getAuthedCalendar(userId);
  const events = await prisma.event.findMany({
    where: { endDatetime: { gte: new Date() } },
  });

  let synced = 0;
  for (const event of events) {
    try {
      await syncEventForUser(calendar, userId, event);
      synced += 1;
    } catch (err) {
      console.error(`[gcal] sync failed for event ${event.id}:`, err.message);
    }
  }
  return { synced, total: events.length };
}

// Background job: push one (new/updated) event to every connected member.
async function syncEventForAllUsers(eventId) {
  if (!config.google.enabled) return { synced: 0 };
  const event = await prisma.event.findUnique({ where: { id: eventId } });
  if (!event) return { synced: 0 };

  const tokenRows = await prisma.googleCalendarToken.findMany();
  let synced = 0;
  for (const row of tokenRows) {
    try {
      const calendar = await getAuthedCalendar(row.userId);
      await syncEventForUser(calendar, row.userId, event);
      synced += 1;
    } catch (err) {
      console.error(`[gcal] sync failed for user ${row.userId}:`, err.message);
    }
  }
  return { synced };
}

module.exports = {
  getAuthUrl,
  handleCallback,
  getConnectionStatus,
  syncUserCalendar,
  syncEventForAllUsers,
};
