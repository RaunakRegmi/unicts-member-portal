const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env') });

const env = (key, fallback = undefined) => {
  const value = process.env[key];
  return value === undefined || value === '' ? fallback : value;
};

const nodeEnv = env('NODE_ENV', 'development');

const config = {
  nodeEnv,
  isDev: nodeEnv !== 'production',
  port: parseInt(env('PORT', '4000'), 10),
  apiUrl: env('API_URL', 'http://localhost:4000'),
  appUrl: env('APP_URL', 'http://localhost:5173'),

  databaseUrl: env('DATABASE_URL'),
  redisUrl: env('REDIS_URL', null),

  jwt: {
    accessSecret: env('JWT_ACCESS_SECRET', 'dev-access-secret'),
    accessExpiresIn: env('JWT_ACCESS_EXPIRES_IN', '15m'),
    refreshTtlDays: parseInt(env('REFRESH_TOKEN_TTL_DAYS', '7'), 10),
  },

  fileSigningSecret: env('FILE_SIGNING_SECRET', 'dev-file-secret'),
  uploadsDir: path.join(__dirname, '..', '..', 'uploads'),

  otp: {
    ttlMinutes: parseInt(env('OTP_TTL_MINUTES', '10'), 10),
    devEcho: env('OTP_DEV_ECHO', 'false') === 'true' && nodeEnv !== 'production',
    maxAttempts: 5,
  },

  s3: {
    endpoint: env('S3_ENDPOINT', null),
    region: env('S3_REGION', 'us-east-1'),
    bucket: env('S3_BUCKET', null),
    accessKeyId: env('S3_ACCESS_KEY_ID', null),
    secretAccessKey: env('S3_SECRET_ACCESS_KEY', null),
    get enabled() {
      return Boolean(this.bucket && this.accessKeyId && this.secretAccessKey);
    },
  },

  smtp: {
    host: env('SMTP_HOST', null),
    port: parseInt(env('SMTP_PORT', '587'), 10),
    user: env('SMTP_USER', null),
    pass: env('SMTP_PASS', null),
    from: env('MAIL_FROM', 'UNICTS <no-reply@unicts.org.np>'),
    // Dev only: when no SMTP_HOST is set, send through an auto-provisioned
    // Ethereal test inbox (real SMTP) and log preview URLs
    devPreview: env('EMAIL_DEV_PREVIEW', 'true') !== 'false',
    get enabled() {
      return Boolean(this.host);
    },
  },

  // Reject emails whose domain has no MX records (signup + bulk import)
  emailMxCheck: env('EMAIL_MX_CHECK', 'true') !== 'false',

  sms: {
    apiUrl: env('SMS_API_URL', null),
    token: env('SMS_TOKEN', null),
    from: env('SMS_FROM', 'UNICTS'),
    get enabled() {
      return Boolean(this.apiUrl && this.token);
    },
  },

  google: {
    clientId: env('GOOGLE_CLIENT_ID', null),
    clientSecret: env('GOOGLE_CLIENT_SECRET', null),
    redirectUri: env(
      'GOOGLE_REDIRECT_URI',
      'http://localhost:4000/api/members/me/calendar/callback'
    ),
    get enabled() {
      return Boolean(this.clientId && this.clientSecret);
    },
  },

  puppeteerExecutablePath: env('PUPPETEER_EXECUTABLE_PATH', null),
};

module.exports = config;
