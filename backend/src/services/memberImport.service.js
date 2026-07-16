const bcrypt = require('bcryptjs');
const prisma = require('../config/prisma');
const config = require('../config/env');
const { ApiError } = require('../utils/errors');
const { normalizePhone, splitName } = require('./auth.service');
const notificationService = require('./notification.service');

const MAX_ROWS = 500;
const EMAIL_RE = /^[\w.+-]+@[\w-]+\.[\w.]{2,}$/;
const PHONE_RE = /^\+?\d{7,15}$/;

// ---------- Normalization & validation ----------

function normalizeEntry(raw, index) {
  const name = String(raw.name ?? '').trim();
  const email = String(raw.email ?? '').trim().toLowerCase() || null;
  // Excel often delivers phone numbers as numbers, not strings
  const phoneRaw = raw.phone == null ? '' : normalizePhone(String(raw.phone).trim());
  const phone = phoneRaw || null;
  const address = String(raw.address ?? '').trim() || null;

  const errors = [];
  if (!name || name.length < 2) errors.push('Name is required');
  if (!email && !phone) errors.push('Needs an email or a phone number');
  if (email && !EMAIL_RE.test(email)) errors.push('Invalid email');
  if (phone && !PHONE_RE.test(phone)) errors.push('Invalid phone number');

  return { index, name, email, phone, address, errors, valid: errors.length === 0 };
}

// ---------- Excel parsing ----------

// Header mapping is forgiving: "Phone Number", "phone", "Mobile No." all land
// on `phone`. Matches the sample sheet: S.N | Name | Phone Number | Email | Address
const HEADER_MAP = {
  name: 'name',
  fullname: 'name',
  membername: 'name',
  phone: 'phone',
  phonenumber: 'phone',
  phoneno: 'phone',
  mobile: 'phone',
  mobilenumber: 'phone',
  mobileno: 'phone',
  contact: 'phone',
  contactnumber: 'phone',
  email: 'email',
  emailaddress: 'email',
  address: 'address',
};

function parseExcel(buffer) {
  const XLSX = require('xlsx');
  let workbook;
  try {
    workbook = XLSX.read(buffer, { type: 'buffer' });
  } catch (err) {
    throw ApiError.unprocessable(
      'Could not read that file — upload a valid .xlsx sheet',
      'BAD_EXCEL'
    );
  }

  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  if (!sheet) throw ApiError.unprocessable('The Excel file has no sheets', 'BAD_EXCEL');

  const rows = XLSX.utils.sheet_to_json(sheet, { defval: null, raw: true });
  const mapped = rows
    .map((row) => {
      const out = {};
      for (const [key, value] of Object.entries(row)) {
        const normalizedKey = String(key).toLowerCase().replace(/[^a-z]/g, '');
        const field = HEADER_MAP[normalizedKey];
        if (field && out[field] == null) out[field] = value;
      }
      return out;
    })
    .filter((row) =>
      Object.values(row).some((v) => v != null && String(v).trim() !== '')
    );

  if (!mapped.length) {
    throw ApiError.unprocessable(
      'No usable rows found — the sheet needs Name plus Phone Number and/or Email columns',
      'EMPTY_SHEET'
    );
  }
  return mapped;
}

// ---------- Preview: normalize + flag duplicates ----------

async function preview({ users, fileBuffer }) {
  const rawEntries = fileBuffer ? parseExcel(fileBuffer) : Array.isArray(users) ? users : [];
  if (!rawEntries.length) throw ApiError.badRequest('No rows to import', 'NO_ROWS');
  if (rawEntries.length > MAX_ROWS) {
    throw ApiError.badRequest(`Import at most ${MAX_ROWS} people at a time`, 'TOO_MANY_ROWS');
  }

  const entries = rawEntries.map(normalizeEntry);

  // Repeats inside the same batch: keep the first occurrence, flag the rest
  const seenPhones = new Set();
  const seenEmails = new Set();
  for (const entry of entries) {
    entry.duplicateInBatch =
      (entry.phone && seenPhones.has(entry.phone)) ||
      (entry.email && seenEmails.has(entry.email));
    if (entry.phone) seenPhones.add(entry.phone);
    if (entry.email) seenEmails.add(entry.email);
  }

  // Already-registered members, matched by phone or email
  const phones = entries.filter((e) => e.phone).map((e) => e.phone);
  const emails = entries.filter((e) => e.email).map((e) => e.email);
  const existingUsers = phones.length || emails.length
    ? await prisma.user.findMany({
        where: {
          OR: [
            ...(phones.length ? [{ phoneNumber: { in: phones } }] : []),
            ...(emails.length ? [{ email: { in: emails } }] : []),
          ],
        },
        select: {
          id: true,
          phoneNumber: true,
          email: true,
          status: true,
          memberProfile: { select: { firstName: true, lastName: true } },
        },
      })
    : [];

  const byPhone = new Map(existingUsers.filter((u) => u.phoneNumber).map((u) => [u.phoneNumber, u]));
  const byEmail = new Map(existingUsers.filter((u) => u.email).map((u) => [u.email, u]));

  for (const entry of entries) {
    const matchPhone = entry.phone && byPhone.get(entry.phone);
    const matchEmail = entry.email && byEmail.get(entry.email);
    const match = matchPhone || matchEmail;
    entry.existing = match
      ? {
          id: match.id,
          matchedBy: matchPhone ? 'phone' : 'email',
          name: match.memberProfile
            ? [match.memberProfile.firstName, match.memberProfile.lastName]
                .filter(Boolean)
                .join(' ')
            : null,
          status: match.status,
        }
      : null;
  }

  const summary = {
    total: entries.length,
    new: entries.filter((e) => e.valid && !e.existing && !e.duplicateInBatch).length,
    alreadyRegistered: entries.filter((e) => e.existing).length,
    invalid: entries.filter((e) => !e.valid || e.duplicateInBatch).length,
  };

  return { entries, summary };
}

// ---------- Commit: create accounts + deliver credentials ----------

function credentialUrls() {
  return {
    // Full URLs for email; short API redirects (/r/…) keep the SMS compact
    loginUrl: `${config.appUrl}/login`,
    resetUrl: `${config.appUrl}/forgot-password`,
    loginUrlShort: `${config.apiUrl}/r/login`,
    resetUrlShort: `${config.apiUrl}/r/reset`,
  };
}

// Delivery goes to every channel the admin provided (SMS and/or email)
async function deliver(userId, type, context, channels) {
  const notified = [];
  for (const channel of channels) {
    const urls = credentialUrls();
    const result = await notificationService.sendToUser(userId, {
      channel,
      type,
      subject:
        type === 'ACCOUNT_CREDENTIALS'
          ? 'Your UNICTS Member Portal account'
          : 'Your UNICTS Member Portal login',
      context: {
        ...context,
        loginUrl: channel === 'SMS' ? urls.loginUrlShort : urls.loginUrl,
        resetUrl: channel === 'SMS' ? urls.resetUrlShort : urls.resetUrl,
      },
    });
    notified.push({ channel: result.channel, status: result.status });
  }
  return notified;
}

async function commit(adminId, { users, defaultPassword }) {
  const entries = users.map(normalizeEntry);
  if (!entries.length) throw ApiError.badRequest('No rows selected', 'NO_ROWS');
  if (entries.length > MAX_ROWS) {
    throw ApiError.badRequest(`Import at most ${MAX_ROWS} people at a time`, 'TOO_MANY_ROWS');
  }

  const passwordHash = await bcrypt.hash(defaultPassword, 10);
  const results = [];

  for (const entry of entries) {
    const base = {
      name: entry.name,
      phone: entry.phone,
      email: entry.email,
      address: entry.address,
    };

    if (!entry.valid) {
      results.push({ ...base, status: 'invalid', error: entry.errors.join('; ') });
      continue;
    }

    try {
      const existing = await prisma.user.findFirst({
        where: {
          OR: [
            ...(entry.phone ? [{ phoneNumber: entry.phone }] : []),
            ...(entry.email ? [{ email: entry.email }] : []),
          ],
        },
      });

      if (existing) {
        // Deliberately selected duplicate: never recreate the account or touch
        // its password — just re-send the login link.
        const notified = await deliver(
          existing.id,
          'ACCOUNT_REMINDER',
          { name: entry.name.split(/\s+/)[0] },
          [
            ...(existing.phoneNumber ? ['SMS'] : []),
            ...(existing.email ? ['EMAIL'] : []),
          ]
        );
        results.push({ ...base, status: 'already_registered_notified', notified });
        continue;
      }

      const { firstName, lastName } = splitName(entry.name);
      const user = await prisma.user.create({
        data: {
          phoneNumber: entry.phone,
          email: entry.email,
          passwordHash,
          role: 'MEMBER',
          // Admin vouched for the contact info — no OTP verification gate
          status: 'ACTIVE',
          address: entry.address,
          preferredOtpChannel: entry.phone ? 'SMS' : 'EMAIL',
          memberProfile: { create: { firstName, lastName, mobileNumber: entry.phone } },
        },
      });

      const notified = await deliver(
        user.id,
        'ACCOUNT_CREDENTIALS',
        {
          name: firstName,
          identifier: entry.phone || entry.email,
          password: defaultPassword,
        },
        [...(entry.phone ? ['SMS'] : []), ...(entry.email ? ['EMAIL'] : [])]
      );
      results.push({ ...base, status: 'created', notified });
    } catch (err) {
      const message =
        err.code === 'P2002' ? 'Already registered (added moments ago)' : err.message;
      results.push({ ...base, status: 'failed', error: message });
    }
  }

  const summary = {
    total: results.length,
    created: results.filter((r) => r.status === 'created').length,
    alreadyRegistered: results.filter((r) => r.status === 'already_registered_notified').length,
    failed: results.filter((r) => r.status === 'failed' || r.status === 'invalid').length,
  };

  await prisma.auditLog.create({
    data: {
      actorId: adminId,
      action: 'IMPORT_MEMBERS',
      entityType: 'User',
      entityId: 'bulk',
      metadata: summary,
    },
  });

  return { results, summary };
}

module.exports = { preview, commit, parseExcel, normalizeEntry };
