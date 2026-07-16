# UNICTS Member Portal — Full-Stack Engineering Specification

> **What this is:** A build-ready engineering prompt for the UNICTS Member Portal — a two-sided platform (Member Portal + Admin Portal) covering membership application, KYC/KYM onboarding, document verification, ID card issuance, CV tooling, and ongoing member engagement. It expands the original product brief into concrete data models, API contracts, and architectural decisions, so it can be handed directly to a developer, a dev team, or an AI coding agent as the source of truth for implementation.

**Stack:** React (Vite) frontend · Express.js backend · PostgreSQL database
**Backend layering:** `Middleware → Controllers → Services → ORM Layer (Prisma) → Database`

## Table of Contents
1. Product Summary
2. Tech Stack
3. System Architecture
4. Database Schema (PostgreSQL)
5. Backend Architecture
6. API Design
7. Authentication & Authorization
8. Frontend Architecture
9. Member-Side Feature Deep Dives
10. Admin-Side Feature Deep Dives
11. Login Evolution
12. Non-Functional Requirements
13. Suggested Implementation Roadmap
14. Assumptions & Open Decisions

---

## 1. Product Summary

UNICTS needs to digitize its full membership lifecycle: **apply → verify identity (KYC/KYM) → admin review → ID card issuance → ongoing engagement → renewal.**

Two portals, one codebase (shared DB and API, role-gated frontend routes):

| Portal | Users | Core jobs |
|---|---|---|
| **Member Portal** | Applicants and approved members | Apply for membership, complete KYC/KYM, upload documents, build or upload a CV, receive a digital ID card, view events/calendar/certifications/newsletters |
| **Admin Portal** | UNICTS staff | Review and approve/reject applications, manage members (roles, removal, renewal, password resets), publish events and news, send SMS/Email |

**Membership structure:**
- One membership **group** exists today, `Central`. Model this as a database table rather than a hardcoded value, so additional groups/chapters can be introduced later with zero schema changes.
- Two membership **categories**: `General` and `Institutional`. An institutional applicant fills in everything a general applicant does, **plus** business-verification documents — it's an additive flow, not a separate form.

Platform note: this is web-only for now, with a web app planned later. Build the backend **API-first and stateless** so a future mobile or wrapped web-app client can reuse the exact same Express API without changes.

## 2. Tech Stack

| Layer | Choice | Why |
|---|---|---|
| Frontend | React 18 + Vite | Fast dev loop, no CRA baggage |
| Routing | React Router v6 | Nested routes, clean protected-route patterns |
| Forms | React Hook Form + Zod | Performant multi-step forms; Zod schemas can be shared/mirrored with backend validation |
| Server state | TanStack Query | Caching, retries, background refetch for all API data |
| Client state | Zustand (small pieces can use Context) | Auth state, multi-step wizard state |
| Styling | Tailwind CSS | Fast to build a consistent design system, including the ID card and CV layouts |
| Backend | Node.js + Express.js | As requested; mature middleware ecosystem |
| ORM | Prisma | Type-safe queries, first-class PostgreSQL support, clean migrations — this is literally the "ORM layer" sitting between Services and the database |
| Database | PostgreSQL | Relational integrity across members, applications, documents, and payments |
| Auth | JWT (short-lived access + refresh) + bcrypt/argon2 | Stateless API, short-lived access tokens, safe password storage |
| File storage | S3-compatible object storage (AWS S3 / DigitalOcean Spaces / self-hosted MinIO) | Documents, photos, and generated PDFs shouldn't live on the app server's disk |
| PDF & ID generation | Puppeteer (HTML/CSS → PDF) + the `qrcode` npm package | ID cards and CVs need pixel-precise layouts; an HTML/CSS template rendered to PDF gives full design control |
| SMS | A Nepal SMS gateway (e.g. Sparrow SMS) or Twilio | OTP delivery and notifications |
| Email | Nodemailer + a transactional provider (SendGrid / Postmark / SES) | OTP delivery and notifications |
| Calendar sync | Google Calendar API (OAuth2) | As requested |
| Background jobs | BullMQ + Redis | PDF generation, SMS/Email sending, renewal reminders — none of these should block the request/response cycle |
| Cache / rate-limit store | Redis | OTP throttling counters, session-adjacent data, job queue backing store |
| Payments | An internal `PaymentService` interface; NPR 0 today, gateway pluggable later | Avoids a rewrite when eSewa/Khalti/ConnectIPS or another gateway is switched on |

## 3. System Architecture

```
Client (React SPA)
    │  HTTPS / REST (JSON)
    ▼
Express App
    │
    ├─ Global middleware: helmet, cors, request logger, body parser, rate limiter
    │
    ├─ Route-level middleware chain:
    │     authMiddleware → rbacMiddleware(roles) → validateRequest(schema) → [uploadMiddleware]
    │
    ▼
Controllers        (thin — parse the request, call a service, shape the response)
    │
    ▼
Services           (all business logic — MembershipService, KYCService, IdCardService,
                     CvService, PaymentService, EventService, NotificationService,
                     CalendarSyncService, AdminService)
    │
    ▼
ORM Layer          (Prisma Client — typed queries, transactions, migrations)
    │
    ▼
PostgreSQL

Services also reach out to, off to the side:
    → BullMQ / Redis            (background jobs: PDF generation, SMS/Email sending, renewal reminders)
    → Object storage (S3)       (documents, profile pictures, generated PDFs)
    → Google Calendar API       (OAuth2 token stored per member)
    → SMS / Email providers
```

Every request flows through the same five layers in the same order. Nothing above the ORM layer (middleware, controllers, services) ever writes raw SQL or touches `pg` directly — that discipline is what keeps the system testable and lets the database be swapped or mocked in tests.

---

## 4. Database Schema (PostgreSQL)

Expressed as a Prisma schema — this maps directly onto the ORM layer and can seed the actual `schema.prisma` file.

### 4.1 Identity, Auth & OTP

```prisma
model User {
  id           String     @id @default(uuid())
  phoneNumber  String     @unique
  email        String?    @unique
  passwordHash String
  role         UserRole   @default(MEMBER)
  status       UserStatus @default(PENDING_VERIFICATION)
  createdAt    DateTime   @default(now())
  updatedAt    DateTime   @updatedAt
  lastLoginAt  DateTime?

  memberProfile           MemberProfile?
  membershipApplications  MembershipApplication[]
  otpVerifications        OtpVerification[]
  googleCalendarToken     GoogleCalendarToken?
  notifications           Notification[]
  eventRegistrations      EventRegistration[]
}

enum UserRole   { MEMBER ADMIN SUPER_ADMIN }
enum UserStatus { PENDING_VERIFICATION ACTIVE SUSPENDED DEACTIVATED }

model OtpVerification {
  id              String     @id @default(uuid())
  userId          String
  user            User       @relation(fields: [userId], references: [id])
  otpCodeHash     String
  deliveryChannel OtpChannel
  purpose         OtpPurpose
  expiresAt       DateTime
  verifiedAt      DateTime?
  attempts        Int        @default(0)
  createdAt       DateTime   @default(now())
}

enum OtpChannel  { SMS EMAIL }
enum OtpPurpose  { SIGNUP LOGIN PASSWORD_RESET }
```

### 4.2 Membership Group, Category & Application

```prisma
model MembershipGroup {
  id           String   @id @default(uuid())
  name         String   @unique          // "Central" today; extensible later
  applications MembershipApplication[]
}

model MembershipApplication {
  id                String             @id @default(uuid())
  userId            String
  user              User               @relation(fields: [userId], references: [id])
  membershipGroupId String
  membershipGroup   MembershipGroup    @relation(fields: [membershipGroupId], references: [id])
  category          MembershipCategory
  status            ApplicationStatus  @default(DRAFT)
  completionPercent Int                @default(0)
  submittedAt       DateTime?
  reviewedAt        DateTime?
  reviewedById      String?
  rejectionReason   String?
  expiresAt         DateTime?          // membership validity / renewal due date
  createdAt         DateTime           @default(now())
  updatedAt         DateTime           @updatedAt

  institutionalDetail InstitutionalDetail?
  idCard              IdCard?
  payment             Payment?
}

enum MembershipCategory { GENERAL INSTITUTIONAL }
enum ApplicationStatus  { DRAFT SUBMITTED PENDING_APPROVAL APPROVED REJECTED EXPIRED }
```

### 4.3 Member Profile & KYC/KYM

```prisma
model MemberProfile {
  id                    String    @id @default(uuid())
  userId                String    @unique
  user                  User      @relation(fields: [userId], references: [id])
  firstName             String?
  lastName              String?
  dob                   DateTime?
  gender                String?
  mobileNumber          String?
  workplaceTelephone    String?
  ictDomainId           String?
  ictDomain             IctDomain? @relation(fields: [ictDomainId], references: [id])
  bloodGroup            String?
  profilePictureUrl     String?
  socialProfileUrl      String?   // LinkedIn/social link, used for the ID card QR code
  emergencyContactName  String?
  emergencyContactPhone String?

  addresses          Address[]
  educationDetail    EducationDetail?
  employmentDetail   EmploymentDetail?
  identityDocuments  IdentityDocument[]
  cvDocuments        CvDocument[]
}

model IctDomain {
  id       String  @id @default(uuid())
  name     String  @unique   // "Digital Banking", "Urbanization", "E-Governance", ...
  isActive Boolean @default(true)

  profiles MemberProfile[]
}

model Address {
  id              String        @id @default(uuid())
  memberProfileId String
  memberProfile   MemberProfile @relation(fields: [memberProfileId], references: [id])
  type            AddressType
  province        String
  district        String
  municipality    String
  wardNumber      String
  tole            String
  sameAsPermanent Boolean       @default(false)
}
enum AddressType { PERMANENT TEMPORARY }

model EducationDetail {
  id                    String        @id @default(uuid())
  memberProfileId       String        @unique
  memberProfile         MemberProfile @relation(fields: [memberProfileId], references: [id])
  highestQualification  String
  institutionName       String?
  fieldOfStudy          String?
}

model EmploymentDetail {
  id                 String        @id @default(uuid())
  memberProfileId    String        @unique
  memberProfile      MemberProfile @relation(fields: [memberProfileId], references: [id])
  organizationName   String?
  designation        String?
  natureOfJob        String        // permanent | contract | temporary | self_employed | student | unemployed
  organizationSector String
}

model IdentityDocument {
  id                 String             @id @default(uuid())
  memberProfileId    String
  memberProfile      MemberProfile      @relation(fields: [memberProfileId], references: [id])
  documentType       DocumentType
  documentNumber     String
  frontImageUrl      String?
  backImageUrl       String?
  verificationStatus VerificationStatus @default(PENDING)
}
enum DocumentType       { CITIZENSHIP NATIONAL_ID PASSPORT PAN }
enum VerificationStatus { PENDING VERIFIED REJECTED }

model InstitutionalDetail {
  id                          String                 @id @default(uuid())
  membershipApplicationId     String                 @unique
  membershipApplication       MembershipApplication  @relation(fields: [membershipApplicationId], references: [id])
  businessName                String
  businessRegistrationNumber  String
  businessRegistrationDocUrl  String
  vatOrPanNumber              String
  vatOrPanDocUrl              String
}
```

### 4.4 CV Upload / Builder

```prisma
model CvTemplate {
  id              String @id @default(uuid())
  name            String
  previewImageUrl String
  templateSchema  Json     // layout + section config the builder UI renders from

  cvDocuments CvDocument[]
}

model CvDocument {
  id              String        @id @default(uuid())
  memberProfileId String
  memberProfile   MemberProfile @relation(fields: [memberProfileId], references: [id])
  sourceType      CvSourceType
  fileUrl         String?
  templateId      String?
  template        CvTemplate?   @relation(fields: [templateId], references: [id])
  parsedData      Json?         // structured fields extracted from an uploaded CV
  createdAt       DateTime      @default(now())
}
enum CvSourceType { UPLOADED GENERATED }
```

### 4.5 ID Card & Payment

```prisma
model IdCard {
  id                      String                @id @default(uuid())
  membershipApplicationId String                @unique
  membershipApplication   MembershipApplication @relation(fields: [membershipApplicationId], references: [id])
  cardNumber              String                @unique
  qrCodeData              String                // resolves to a UNICTS verification page (see §9.8)
  memberSignatureUrl      String
  presidentSignatureUrl   String
  pdfUrl                  String?
  issuedAt                DateTime?
  expiresAt               DateTime?
  status                  IdCardStatus          @default(PENDING)
}
enum IdCardStatus { PENDING ACTIVE REVOKED EXPIRED }

model Payment {
  id                      String                @id @default(uuid())
  membershipApplicationId String                @unique
  membershipApplication   MembershipApplication @relation(fields: [membershipApplicationId], references: [id])
  amount                  Decimal               @default(0)
  currency                String                @default("NPR")
  status                  PaymentStatus         @default(PENDING)
  method                  String?
  transactionReference    String?
  paidAt                  DateTime?
}
enum PaymentStatus { PENDING COMPLETED FAILED WAIVED }
```

### 4.6 Events, Calendar, Certifications, Newsletters

```prisma
model Event {
  id                     String   @id @default(uuid())
  title                  String
  description            String
  startDatetime          DateTime
  endDatetime            DateTime
  location               String?
  bannerImageUrl         String?
  googleCalendarEventId  String?
  createdById            String
  createdAt              DateTime @default(now())

  registrations EventRegistration[]
}

model EventRegistration {
  id               String   @id @default(uuid())
  eventId          String
  event            Event    @relation(fields: [eventId], references: [id])
  userId           String
  user             User     @relation(fields: [userId], references: [id])
  registeredAt     DateTime @default(now())
  attendanceStatus String   @default("registered")
}

model GoogleCalendarToken {
  id           String   @id @default(uuid())
  userId       String   @unique
  user         User     @relation(fields: [userId], references: [id])
  accessToken  String
  refreshToken String
  expiresAt    DateTime
  scope        String
}

model Certification {
  id             String   @id @default(uuid())
  memberUserId   String
  title          String
  issuingBody    String
  issueDate      DateTime
  certificateUrl String?
}

model Newsletter {
  id            String   @id @default(uuid())
  title         String
  content       String
  attachmentUrl String?
  publishedById String
  publishedAt   DateTime @default(now())
}
```

### 4.7 Notifications, Audit Log & Org Settings

```prisma
model Notification {
  id        String       @id @default(uuid())
  userId    String
  user      User         @relation(fields: [userId], references: [id])
  channel   NotifChannel
  type      String
  content   String
  status    NotifStatus  @default(PENDING)
  sentAt    DateTime?
  createdAt DateTime     @default(now())
}
enum NotifChannel { SMS EMAIL IN_APP }
enum NotifStatus  { PENDING SENT FAILED }

model AuditLog {
  id         String   @id @default(uuid())
  actorId    String        // admin user id
  action     String        // e.g. "APPROVE_APPLICATION", "RESET_PASSWORD", "CHANGE_ROLE"
  entityType String
  entityId   String
  metadata   Json?
  createdAt  DateTime @default(now())
}

// Singleton row holding organization-level assets used across every ID card
model OrganizationSettings {
  id                    String @id @default(uuid())
  orgName               String
  orgLogoUrl            String
  presidentName         String
  presidentSignatureUrl String
}
```

---

## 5. Backend Architecture

### 5.1 Folder Structure

```
backend/
├── src/
│   ├── config/              # env, db, redis, s3, google, sms/email provider configs
│   ├── middleware/
│   │   ├── auth.middleware.js
│   │   ├── rbac.middleware.js
│   │   ├── validate.middleware.js       # Zod schema validation
│   │   ├── upload.middleware.js         # multer config, file type/size limits
│   │   ├── rateLimiter.middleware.js
│   │   └── errorHandler.middleware.js
│   ├── routes/
│   │   ├── auth.routes.js
│   │   ├── membership.routes.js
│   │   ├── profile.routes.js
│   │   ├── documents.routes.js
│   │   ├── cv.routes.js
│   │   ├── idcard.routes.js
│   │   ├── payment.routes.js
│   │   ├── calendar.routes.js
│   │   ├── events.routes.js
│   │   ├── certifications.routes.js
│   │   ├── newsletters.routes.js
│   │   └── admin.routes.js
│   ├── controllers/          # one file per route group, same naming
│   ├── services/
│   │   ├── auth.service.js
│   │   ├── membership.service.js
│   │   ├── kyc.service.js
│   │   ├── document.service.js
│   │   ├── cv.service.js
│   │   ├── idcard.service.js
│   │   ├── payment.service.js
│   │   ├── calendarSync.service.js
│   │   ├── event.service.js
│   │   ├── notification.service.js
│   │   └── admin.service.js
│   ├── validators/            # Zod schemas — mirror these shapes on the frontend
│   ├── jobs/                   # BullMQ processors
│   │   ├── generateIdCard.job.js
│   │   ├── sendNotification.job.js
│   │   └── renewalReminder.job.js
│   ├── utils/                  # otpGenerator, qrGenerator, pdfRenderer, nepalAddressData
│   └── app.js
├── prisma/
│   ├── schema.prisma
│   └── migrations/
└── tests/
```

### 5.2 What Each Layer Owns

- **Middleware** — cross-cutting concerns that run *before* a controller: is the request authenticated (`authMiddleware`), is this role allowed here (`rbacMiddleware`), is the payload well-formed (`validateRequest(schema)`), is an attached file safe and within limits (`uploadMiddleware`), and is the caller within rate limits (`rateLimiter`, critical on the OTP and login routes). A final `errorHandler` middleware catches anything thrown by controllers/services and returns a consistent JSON error shape.
- **Controllers** — deliberately thin. They read `req.params`/`req.body`/`req.user`, call exactly one service method, and shape the HTTP response. No business logic, no direct Prisma calls.
- **Services** — where all business logic lives: computing form-completion percentage, enforcing "institutional = general + business docs," deciding what happens on approval, generating ID card data, etc. Services are framework-agnostic — they don't know about `req`/`res` — which makes them directly unit-testable and reusable (e.g., the same `MembershipService.calculateCompletion()` could back both a REST endpoint and a future admin CLI script).
- **ORM layer (Prisma)** — the *only* layer that talks to PostgreSQL. Services call `prisma.model.method()`; nothing above this layer writes raw SQL. Multi-step writes (like approving an application, which touches `MembershipApplication`, `AuditLog`, and queues jobs) run inside a `prisma.$transaction(...)` so partial failures can't leave the data half-updated.

### 5.3 Layering in Practice — a Worked Example

Here's the shape of the validation middleware used on routes that take a body payload:

```javascript
// middleware/validate.middleware.js
const validateRequest = (schema) => (req, res, next) => {
  const result = schema.safeParse(req.body);
  if (!result.success) {
    return res.status(422).json({ success: false, errors: result.error.flatten() });
  }
  req.body = result.data;
  next();
};
```

And here's a full request lifecycle for `PATCH /api/admin/applications/:id/approve`. There's no body payload on this one, so the middleware chain skips straight from `rbacMiddleware` to the controller:

```javascript
// routes/admin.routes.js
router.patch(
  '/applications/:id/approve',
  authMiddleware,
  rbacMiddleware(['ADMIN', 'SUPER_ADMIN']),
  adminController.approveApplication
);
```

```javascript
// controllers/admin.controller.js
async function approveApplication(req, res, next) {
  try {
    const application = await adminService.approveApplication(req.params.id, req.user.id);
    res.status(200).json({ success: true, data: application });
  } catch (err) {
    next(err); // → errorHandler middleware
  }
}
```

```javascript
// services/admin.service.js
const { addYears } = require('date-fns');

async function approveApplication(applicationId, adminId) {
  const application = await prisma.$transaction(async (tx) => {
    const app = await tx.membershipApplication.update({
      where: { id: applicationId },
      data: {
        status: 'APPROVED',
        reviewedAt: new Date(),
        reviewedById: adminId,
        expiresAt: addYears(new Date(), 1),
      },
    });
    await tx.auditLog.create({
      data: { actorId: adminId, action: 'APPROVE_APPLICATION', entityType: 'MembershipApplication', entityId: applicationId },
    });
    return app;
  });

  // Heavy work happens off the request thread
  await idCardQueue.add('generate', { applicationId: application.id });
  await notificationQueue.add('send', { userId: application.userId, channel: 'SMS', type: 'MEMBERSHIP_APPROVED' });

  return application;
}
```

Notice the `prisma.membershipApplication.update(...)` call — that line *is* the ORM layer. Nothing in the controller or route knows PostgreSQL exists; only `admin.service.js` talks to Prisma, and only Prisma talks to the database.

## 6. API Design

All endpoints are prefixed `/api`. Auth column: 🔓 public, 🔒 member (any authenticated user), 🛡️ admin/super-admin only.

**Auth**

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| POST | `/auth/signup` | 🔓 | Create account (name, email, phone, password) |
| POST | `/auth/verify-otp` | 🔓 | Verify signup/login OTP |
| POST | `/auth/resend-otp` | 🔓 | Resend OTP (rate-limited) |
| POST | `/auth/login` | 🔓 | Phone number + password login |
| POST | `/auth/refresh` | 🔓 | Exchange refresh token for a new access token |
| POST | `/auth/logout` | 🔒 | Invalidate refresh token |
| POST | `/auth/forgot-password` | 🔓 | Trigger OTP-based reset |
| POST | `/auth/reset-password` | 🔓 | Complete reset with OTP + new password |

**Membership Application**

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| POST | `/membership/application` | 🔒 | Start an application (choose group + category) |
| GET | `/membership/application` | 🔒 | Get current user's application + completion % |
| PATCH | `/membership/application/institutional-detail` | 🔒 | Save business docs (institutional only) |
| POST | `/membership/application/submit` | 🔒 | Lock and submit for review |
| POST | `/membership/application/payment` | 🔒 | Record payment (NPR 0 today) |

**Profile / KYC**

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| PATCH | `/members/me/profile` | 🔒 | Personal details + ICT domain |
| PATCH | `/members/me/address` | 🔒 | Permanent/temporary address |
| PATCH | `/members/me/education` | 🔒 | Academic details |
| PATCH | `/members/me/employment` | 🔒 | Employment details |
| GET | `/members/me/completion` | 🔒 | Section-by-section completion status |

**Documents & CV**

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| POST | `/members/me/documents` | 🔒 | Upload a document (`documentType` in body) |
| GET | `/members/me/documents` | 🔒 | List uploaded documents |
| DELETE | `/members/me/documents/:id` | 🔒 | Remove a document (pre-submission only) |
| POST | `/members/me/cv/upload` | 🔒 | Upload an existing CV for parsing |
| POST | `/members/me/cv/parse` | 🔒 | Trigger/re-run parsing on an uploaded CV |
| GET | `/cv-templates` | 🔓 | List available CV templates |
| POST | `/members/me/cv/generate` | 🔒 | Generate a CV PDF from template + profile data |

**ID Card**

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| GET | `/members/me/id-card` | 🔒 | Card status/metadata |
| GET | `/members/me/id-card/download` | 🔒 | Signed URL to the generated PDF |

**Calendar & Events**

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| GET | `/members/me/calendar/auth-url` | 🔒 | Get Google OAuth2 consent URL |
| GET | `/members/me/calendar/callback` | 🔒 | OAuth2 redirect handler |
| POST | `/members/me/calendar/sync` | 🔒 | Push org events into the member's Google Calendar |
| GET | `/events?filter=upcoming\|ongoing\|past` | 🔒 | List events |
| GET | `/events/:id` | 🔒 | Event detail |
| POST | `/events/:id/rsvp` | 🔒 | Register attendance |

**Certifications & Newsletters**

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| GET | `/members/me/certifications` | 🔒 | List member's certifications |
| GET | `/newsletters` | 🔒 | List published newsletters |
| GET | `/newsletters/:id` | 🔒 | Newsletter detail |

**Admin**

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| GET | `/admin/applications?status=` | 🛡️ | Review queue, filterable |
| GET | `/admin/applications/:id` | 🛡️ | Full application detail (KYC + docs + CV) |
| PATCH | `/admin/applications/:id/approve` | 🛡️ | Approve → issues ID card |
| PATCH | `/admin/applications/:id/reject` | 🛡️ | Reject with a required reason |
| GET | `/admin/members` | 🛡️ | Search/list/filter members |
| PATCH | `/admin/members/:id/role` | 🛡️ super admin | Change role |
| PATCH | `/admin/members/:id/status` | 🛡️ | Suspend/deactivate/reactivate (soft delete) |
| POST | `/admin/members/:id/reset-password` | 🛡️ | Force a password reset |
| PATCH | `/admin/members/:id/renew` | 🛡️ | Manually extend membership validity |
| POST/PATCH/DELETE | `/admin/events`, `/admin/events/:id` | 🛡️ | Event CRUD |
| POST | `/admin/newsletters` | 🛡️ | Publish a newsletter |
| POST | `/admin/cv-templates` | 🛡️ | Add a CV template |
| POST | `/admin/notifications/send` | 🛡️ | Send SMS/Email to a member or a segment |

## 7. Authentication & Authorization

**Signup:** name, email, phone, password → account created with `status = PENDING_VERIFICATION` → OTP sent to the channel the user picked (SMS or email) → `POST /auth/verify-otp` flips status to `ACTIVE` and returns tokens.

**OTP mechanics:**
- 6-digit numeric code, **hashed** before storage (never store the plaintext code) — mirrors how passwords are handled.
- Expiry: ~5–10 minutes.
- Resend cooldown: ~60 seconds, enforced by `rateLimiter.middleware.js` (Redis-backed counter keyed by phone/email).
- Lockout: after 5 failed attempts on one OTP, require a fresh resend; consider a short IP+identifier lockout window to blunt brute force.

**Tokens:** JWT access token (~15 min) + refresh token (~7 days, rotated on every use, stored httpOnly/secure). Every protected route runs through `authMiddleware`, which verifies the access token and attaches `req.user = { id, role }`.

**RBAC:** `role` lives directly on `User` (`MEMBER` / `ADMIN` / `SUPER_ADMIN`). `rbacMiddleware(['ADMIN', 'SUPER_ADMIN'])` gates every `/admin/*` route. `SUPER_ADMIN` is the only role that can change another user's role — see §10.5.

**Password reset:** same OTP machinery, `purpose = PASSWORD_RESET`, works over phone or email.

## 8. Frontend Architecture

### 8.1 Structure

```
frontend/
├── src/
│   ├── app/                     # router setup, top-level providers
│   ├── features/
│   │   ├── auth/                 # signup, otp, login, forgot-password
│   │   ├── membership/           # category selection, wizard shell, progress bar
│   │   ├── kyc/                   # domain, personal, address, education, employment steps
│   │   ├── documents/
│   │   ├── cv/                     # upload+parse review, template picker, builder
│   │   ├── idcard/                 # preview, download
│   │   ├── payment/
│   │   ├── calendar/
│   │   ├── events/
│   │   ├── certifications/
│   │   ├── newsletters/
│   │   └── admin/
│   │       ├── applications/
│   │       ├── members/
│   │       ├── events-management/
│   │       ├── newsletters-management/
│   │       └── notifications/
│   ├── components/                # shared UI: Stepper, ProgressBar, FileUpload, SignaturePad, AddressCascadeSelect
│   ├── lib/                        # apiClient (axios instance), queryClient
│   ├── store/                      # zustand slices: authStore, wizardStore
│   └── main.jsx
```

### 8.2 Routing

| Route | Access | Notes |
|---|---|---|
| `/`, `/apply` | Public | Landing + category selection |
| `/signup`, `/verify-otp`, `/login`, `/forgot-password` | Public | |
| `/dashboard` | Member | Post-approval home |
| `/membership/wizard/:step` | Member | KYC/KYM multi-step form |
| `/documents`, `/cv`, `/id-card`, `/payment` | Member | |
| `/calendar`, `/events`, `/events/:id`, `/certifications`, `/newsletters` | Member | |
| `/admin/*` | Admin/Super Admin | Fully separate layout, guarded by role not just auth |

A `<ProtectedRoute role="MEMBER|ADMIN">` wrapper checks `authStore` and redirects unauthenticated or under-privileged users — same pattern as the backend's `rbacMiddleware`, just mirrored client-side for UX (the backend remains the real enforcement point).

### 8.3 The Multi-Step Wizard Pattern (KYC/KYM)

A `wizardStore` (Zustand) holds the current step index and in-progress form data. Each step:
1. Loads its slice of data from `GET /membership/application` on mount.
2. Validates locally with the same Zod schema the backend uses.
3. On "Save & Continue," `PATCH`es just that step's endpoint (e.g., `/members/me/address`), then advances.
4. A debounced autosave (on blur / every few seconds) hits the same PATCH endpoint as a safety net, in addition to the explicit save button the flow calls for.

The completion percentage shown in the progress bar is **recalculated server-side** on every PATCH (stored on `MembershipApplication.completionPercent`) rather than trusted from the client, so it can't be spoofed and stays correct even if a user edits a field that un-completes a previously-finished section.

---

## 9. Member-Side Feature Deep Dives

### 9.1 Landing Page & Apply Membership

Public landing page with an "Apply Membership" CTA. Clicking it shows the category screen — `General` vs `Institutional` — with a one-line description of each so applicants self-select correctly before any data entry starts. Selecting a category calls `POST /membership/application` (creates a `DRAFT` row under the `Central` group), then routes into signup (if not authenticated) or straight into the wizard (if already signed up mid-application).

### 9.2 Signup & OTP Verification

Form: name, email, phone, password (with a strength meter and confirm-password field). A radio choice lets the user pick **SMS or Email** for OTP delivery — store the choice so subsequent OTPs default to the same channel. On successful verification, tokens are issued and the user lands directly in the profile-completion wizard — no separate "you're verified, now click to continue" step.

### 9.3 Profile Completion Wizard & Progress Tracking

Presented as a stepper: **Domain → Personal → Address → Education/Employment → Documents → CV → Review**. Every step shows the overall completion percentage (see §8.3) so the applicant always knows how much is left — matching the "usual forms" progress-bar behavior from the brief.

### 9.4 ICT Domain Selection

Single-select list, sourced from the `IctDomain` table (not hardcoded in the frontend) so admins can add/retire domains without a deploy. Suggested starting set: *Digital Banking & Fintech, Urbanization & Smart Cities, E-Governance, Health-Tech, Ed-Tech, Agri-Tech, Cybersecurity, Cloud & Infrastructure, Software Engineering, Data Science & AI/ML, Telecommunications.* A "Skip for now" option leaves `ictDomainId` null; it stays editable later from account settings.

### 9.5 KYC/KYM Form

**Personal:** first name, last name, DOB (date picker, minimum-age validation), gender (inclusive option set including self-describe), blood group.

**Contact:** mobile number (default country code +977), workplace telephone (optional), email (prefilled from signup, editable).

**Address (permanent + temporary):** province → district → municipality/rural municipality → ward number → tole, modeled as **cascading dropdowns** backed by a reference dataset of Nepal's administrative divisions, so district options filter by province and so on — far less error-prone than free-text entry. A "temporary address same as permanent" checkbox copies the permanent address and skips re-entry.

**Academic & employment:** highest qualification (SEE/SLC, +2/Intermediate, Bachelor's, Master's, PhD, Other), institution name, field of study; organization/office name, designation, nature of job (permanent, contract, temporary, self-employed, student, unemployed — broadened from just "permanent" so the form doesn't dead-end on students or the self-employed), organization sector (IT/Software, Banking & Finance, Sales & Marketing, Government, Education, Healthcare, NGO/INGO, Other).

**Enhancements beyond the original list**, added because the ID card and emergency-contact use cases need them: blood group (required for the ID card), an emergency contact name + phone, and a social/professional profile link (used for the ID card QR — see §9.8). Keep these three optional at the schema level even if the UI nudges toward filling them in, since not every applicant will have all of it ready.

Consider *not* collecting anything beyond what's functionally needed (e.g., skip marital status, religion, ethnicity) unless UNICTS has a specific organizational reason to — every extra sensitive field is something to secure, justify, and eventually delete.

### 9.6 Document Upload

- **Profile picture** — client-side crop tool (square aspect ratio, matches the ID card photo slot).
- **Citizenship number + citizenship document** (front/back images).
- **National ID (NID) number + NID document.**
- **Stronger-profile document (optional):** Passport *or* PAN, either/or.

Validation on both client and server: allowed types (jpg/png/pdf), size cap (e.g. 5MB), and real MIME-type sniffing server-side (don't trust the file extension). Every document lives in private object storage — **never a public bucket** — and is served to the owner or an admin only via short-lived signed URLs through `uploadMiddleware`/a dedicated document-access endpoint.

### 9.7 CV Upload & CV Builder

Two paths, either of which produces a `CvDocument`:

- **Upload an existing CV** — accept PDF/DOCX, extract raw text (`pdf-parse` for PDF, `mammoth` for DOCX), then run it through a structured-extraction step (a resume-parsing API, or a well-prompted LLM call that maps the text into the KYC field shape) to pre-fill the form. Always show the applicant a **review/edit screen** before anything is saved — automated parsing will occasionally misread a field, and the applicant should have the final say.
- **No CV? Build one** — pick from `CvTemplate` options (admin-manageable, so new designs can be added later), the builder reuses whatever KYC data is already entered plus a few CV-specific fields (skills, past roles/experience list, summary), and the result exports as a PDF via the same HTML→PDF pipeline used for the ID card.

### 9.8 ID Card Generation

Triggered automatically when an application is approved (queued as a background job so approval stays fast for the admin — see the worked example in §5.3).

**Contents:** name, profile picture, QR code, UNICTS logo, blood group, address, membership type (General/Institutional), member's signature, and the UNICTS president's signature.

**Rendering approach:** a fixed HTML/CSS template with the member's data injected, rendered to PDF via Puppeteer — this gives pixel-level control over a card layout in a way that's much harder to get right with a canvas-drawing approach. The logo and president's signature come from the single `OrganizationSettings` row (§4.7) rather than being re-uploaded per card.

**Signature:** capture the member's signature during the KYC flow via a signature-pad component (draw with mouse/touch), or allow uploading a scanned signature image as an alternative — either becomes `memberSignatureUrl`.

**QR code — a suggested enhancement:** the brief asks for the QR to point at the member's LinkedIn/social profile. Consider instead (or additionally) pointing it at a UNICTS-hosted verification page (`/verify/:cardNumber`) showing name, photo, status, and validity — with an optional outbound link to the member's chosen social profile from that page. This lets anyone who scans the card actually confirm it's a legitimate, current UNICTS ID (the core job of an ID card), while still surfacing the social link. Baseline in this spec is the verification-page approach; swap `qrCodeData` to the raw social URL directly if a straight social-link QR is preferred instead.

The finished PDF is stored in object storage and available anytime from the member dashboard via `GET /members/me/id-card/download`.

### 9.9 Institutional Member Additions

On top of everything in §9.5–§9.8, an institutional applicant fills `InstitutionalDetail`: business name, business registration number + document, VAT/PAN number + document. The ID card and generated CV both reflect `category = INSTITUTIONAL` (e.g., the card shows "Institutional Member," and the CV/profile export can lean toward a company-profile framing rather than an individual résumé framing).

### 9.10 Save, Payment & Submission

- **Save** is available at every step (explicit "Save" button per the brief, backed by the autosave described in §8.3 as a safety net, not a replacement).
- **Payment** — `POST /membership/application/payment` records a `Payment` row at `NPR 0` today. Because it's implemented behind a `PaymentService` interface rather than inlined into the controller, switching on a real gateway (eSewa, Khalti, ConnectIPS, or another) later is a service-level change, not a rewrite of the submission flow.
- **Submit** — `POST /membership/application/submit` validates all required sections are complete, flips status to `PENDING_APPROVAL`, and (recommended) makes the form read-only to the applicant from that point on. If an admin rejects it, the application reopens for edits and can be resubmitted — this keeps "what the admin is reviewing" and "what the applicant can currently edit" from ever being two different versions of the same record at once.

### 9.11 Post-Approval Member Dashboard

- **Calendar** — org-created events are always visible in an in-app calendar view. Additionally, a member can connect Google Calendar (OAuth2 consent → refresh token stored in `GoogleCalendarToken`); a background job then pushes UNICTS events into their connected Google Calendar so they get Google's native reminders/notifications too, satisfying both "seen through our website's calendar" and the sync request.
- **Events** — list with Upcoming / Ongoing / Past filters; detail view with full date, time, description, and location; optional RSVP (`POST /events/:id/rsvp`) so UNICTS gets a headcount.
- **Certifications** — issued by admins (e.g., on training/course completion) and listed/downloadable from the member's dashboard.
- **Newsletters** — archive of published newsletters, viewable and downloadable.
