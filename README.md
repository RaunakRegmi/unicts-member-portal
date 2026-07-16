# UNICTS Member Portal

Two-sided membership platform for UNICTS: **Member Portal** (apply → KYC/KYM → documents → CV → digital ID card → events/certifications/newsletters) and **Admin Portal** (review applications, manage members, publish events & news, send SMS/email). Built from [`unicts-member-portal-spec.md`](./unicts-member-portal-spec.md).

**Stack:** React 18 + Vite + Tailwind + TanStack Query + Zustand · Express.js (`Middleware → Controllers → Services → Prisma → PostgreSQL`) · BullMQ/Redis jobs · Puppeteer PDF generation.

## Quick start (local dev)

Prereqs: Node 18+, PostgreSQL (a local install on 5432 **or** `docker compose up -d` which provides Postgres on **5433** and Redis on **6380**), and Google Chrome (used by `puppeteer-core` for ID card / CV PDFs).

```bash
# 1. Backend
cd backend
npm install
cp .env.example .env          # set DATABASE_URL (see notes below)
npx prisma migrate dev        # create schema
npm run seed                  # groups, ICT domains, org settings, super admin, demo data
npm run dev                   # API on http://localhost:4000

# 2. Frontend (second terminal)
cd frontend
npm install
npm run dev                   # SPA on http://localhost:5173 (proxies /api → 4000)
```

Seeded super admin: phone **9800000000** / password **Admin@123!** → log in and open `/admin`.

### Dev conveniences (all optional to replace later)

| Concern | Without config (default in dev) | With config |
|---|---|---|
| OTP delivery | Logged to server console + echoed in API responses (`OTP_DEV_ECHO=true`) | Sparrow-style SMS API / SMTP via `.env` |
| File storage | Local `backend/uploads/` with HMAC-signed expiring URLs | S3-compatible bucket (`S3_*` vars) |
| Background jobs | Run inline in the API process | BullMQ via `REDIS_URL` + `npm run worker` |
| Google Calendar | Feature hidden/disabled | `GOOGLE_CLIENT_ID/SECRET/REDIRECT_URI` |
| Payments | NPR 0, auto-waived `Payment` row | Implement gateway inside `payment.service.js` |

## Member flow

Landing → **Apply** (General vs Institutional) → signup (name/email/phone/password, OTP via SMS or email) → wizard: **Domain → Personal → Address (cascading Province/District/Municipality selects, full 7/77/753 dataset) → Education & Work → Documents (photo, signature pad, citizenship + NID, optional passport/PAN) → CV (upload+parse or template builder) → [Business docs if institutional] → Review & Submit**. Completion % is recomputed server-side on every save. After submit the form is read-only; rejection reopens it with the admin's reason. Approval triggers a background job that renders the **ID card PDF** (CR80 size, front + back, QR → public `/verify/:cardNumber` page). Members log in afterwards with phone + password, can renew within 60 days of expiry, RSVP to events, sync Google Calendar, and view certifications/newsletters.

## Admin flow

`/admin` — overview stats, review queue (approve → auto ID card; reject with required reason), member management (role change — super admin only, suspend/deactivate/reactivate, force password reset, manual renewal, issue certifications), events CRUD (auto-pushed to connected members' Google Calendars), newsletters, SMS/email/in-app blasts, CV template management. Every admin action lands in `AuditLog`.

### Bulk member registration (Add Members)

`/admin/add-members` lets staff register people collected at events etc. — two input modes, one flow:

1. **Manual entry** (name + email and/or phone + optional address, multiple rows) or **Excel upload** (`.xlsx` with columns like `S.N | Name | Phone Number | Email | Address` — headers matched flexibly, address may be blank; see `member_sample_sheet.xlsx`).
2. **Preview with duplicate detection** — every row is validated and checked against existing accounts (by phone *and* email) plus repeats inside the same batch. Filter tabs: All / New / Already registered / Invalid. Already-registered rows are **unselected by default**; selecting one never recreates the account or changes its password — it only re-sends the login link.
3. **Commit** — admin sets one default password for the batch; each new person gets an `ACTIVE` account (no OTP gate — the admin vouched for the contact info) and receives their credentials + login URL + password-reset link via **SMS (Sparrow), email, or both**, matching whatever contact info was provided. SMS uses compact `/r/login` & `/r/reset` API redirects; passwords are never stored in the notifications table.

Imported members then log in with **phone *or* email + the default password**, can reset the password via the normal forgot-password flow, and continue with KYC/application exactly like self-registered members. Imported free-text addresses land on `User.address`.

SMS is wired to the real **Sparrow SMS v2 API** (form-encoded `token/from/to/text` against `https://api.sparrowsms.com/v2/sms/`, 10-digit numbers, `response_code === 200` = success). Configure `SMS_API_URL`, `SMS_TOKEN`, `SMS_FROM` in `.env`; without them, messages are logged to the console.

## Repository layout

```
backend/
  prisma/schema.prisma        # full data model (see spec §4, plus RefreshToken & CalendarSyncedEvent)
  prisma/seed.js
  src/
    config/                   # env, prisma, redis, providers (SMS/email)
    middleware/               # auth (JWT), rbac, zod validation, multer upload, rate limiter, error handler
    validators/               # zod schemas (mirrored client-side)
    controllers/  routes/     # thin HTTP layer, one file per route group
    services/                 # ALL business logic (auth, otp, membership, kyc, documents,
                              #  cv, idcard, payment, events, calendarSync, notifications, admin, storage)
    jobs/                     # BullMQ queues + processors (+ inline fallback), renewal reminders, worker
    utils/                    # pdfRenderer (puppeteer-core→Chrome), qr, mime sniffing,
                              #  ID card & CV HTML templates, nepal-address-data.json
frontend/
  src/
    app/                      # router, ProtectedRoute, auth bootstrap
    components/               # ui kit, Stepper, ProgressBar, FileUpload, SignaturePad, AddressCascadeSelect, layouts
    features/                 # auth, landing, membership wizard, documents, cv, idcard, payment,
                              #  calendar, events, certifications, newsletters, verify, admin/*
    lib/                      # axios client w/ silent refresh-token rotation, query hooks
    store/                    # zustand: authStore, wizardStore
```

## Auth model

- Access JWT (15 min) held in memory; refresh token (7 days) in an httpOnly cookie scoped to `/api/auth`, **rotated on every use** with reuse-detection (a replayed token revokes the whole family).
- OTPs are 6-digit, bcrypt-hashed at rest, 10-min expiry, 5-attempt lockout, 60-second resend cooldown (Redis-backed rate limiter with in-memory fallback).
- RBAC: `MEMBER` / `ADMIN` / `SUPER_ADMIN` on `User`; only super admins can change roles.
- All uploads are content-sniffed (magic bytes) server-side and stored privately; access is via short-lived signed URLs only.

## Verified end-to-end

`scripts-free` smoke test exercised: signup→OTP→login, application+full KYC, photo/signature/document/CV uploads, signed URL serving, 100% completion, waived payment, submit+lock, admin approve, background ID-card PDF generation (real Chrome render), card download + public QR verification, CV generation, events RSVP, newsletters, and RBAC denials.

## Production checklist (not yet done)

- Set real `JWT_ACCESS_SECRET` / `FILE_SIGNING_SECRET`, SMTP + SMS credentials, S3 bucket, `REDIS_URL` (+ run `npm run worker`).
- Replace placeholder org logo/president signature (seeded SVGs) via `OrganizationSettings`.
- Point `APP_URL`/`API_URL` at real domains; serve the SPA build (`frontend/dist`) behind HTTPS.
- Consider swapping the heuristic CV parser in `cv.service.js` for an LLM/parsing API (the review-before-save UX already assumes imperfect parsing).
