const config = require('./env');
const nodemailer = require('nodemailer');

// ---------- Email (real SMTP) ----------
// Priority: configured SMTP server (connection verified at first send) →
// auto-provisioned Ethereal test inbox in dev (real SMTP, preview URLs
// logged) → plain console logging as the last resort.

let transporterPromise = null;

async function buildTransporter() {
  if (config.smtp.enabled) {
    const transporter = nodemailer.createTransport({
      host: config.smtp.host,
      port: config.smtp.port,
      secure: config.smtp.port === 465, // 465 = implicit TLS, otherwise STARTTLS
      auth: config.smtp.user
        ? { user: config.smtp.user, pass: config.smtp.pass }
        : undefined,
    });
    try {
      await transporter.verify();
      console.log(`[email] SMTP connection verified: ${config.smtp.host}:${config.smtp.port}`);
    } catch (err) {
      console.error(`[email] SMTP verification failed (${err.message}) — sends may fail`);
    }
    return transporter;
  }

  if (config.isDev && config.smtp.devPreview) {
    try {
      const testAccount = await nodemailer.createTestAccount();
      const transporter = nodemailer.createTransport({
        host: testAccount.smtp.host,
        port: testAccount.smtp.port,
        secure: testAccount.smtp.secure,
        auth: { user: testAccount.user, pass: testAccount.pass },
      });
      transporter.__ethereal = true;
      console.log(
        `[email] Dev mode: sending via Ethereal test SMTP (${testAccount.user}) — preview URLs are logged per message`
      );
      return transporter;
    } catch (err) {
      console.log(`[email] Ethereal unavailable (${err.message}) — logging emails to console`);
    }
  }
  return null;
}

function getTransporter() {
  if (!transporterPromise) transporterPromise = buildTransporter();
  return transporterPromise;
}

const escapeHtml = (value) =>
  String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

// Branded HTML wrapper for plain-text bodies: escapes, auto-links URLs,
// preserves line breaks.
function renderEmailHtml({ subject, text }) {
  const body = escapeHtml(text)
    .replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1" style="color:#0e7490">$1</a>')
    .replace(/\n/g, '<br/>');
  return `<!doctype html>
<html><body style="margin:0;padding:24px;background:#f1f5f9;font-family:Helvetica,Arial,sans-serif">
  <div style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e2e8f0">
    <div style="background:linear-gradient(120deg,#0f2a5c,#0e7490);padding:18px 24px">
      <span style="color:#ffffff;font-size:18px;font-weight:bold;letter-spacing:0.5px">UNICTS</span>
      <span style="color:#cbd5e1;font-size:12px;margin-left:8px">Member Portal</span>
    </div>
    <div style="padding:24px;color:#1e293b;font-size:14px;line-height:1.7">
      <div style="font-size:16px;font-weight:bold;margin-bottom:12px">${escapeHtml(subject)}</div>
      ${body}
    </div>
    <div style="padding:14px 24px;background:#f8fafc;color:#94a3b8;font-size:11px">
      United Nepal ICT Society — this is an automated message, please do not reply.
    </div>
  </div>
</body></html>`;
}

async function sendEmail({ to, subject, text, html }) {
  if (!to) throw new Error('sendEmail: missing recipient');

  const transporter = await getTransporter();
  if (!transporter) {
    console.log(`[email:dev] to=${to} subject="${subject}"\n${text}`);
    return { dev: true };
  }

  const info = await transporter.sendMail({
    from: config.smtp.from,
    to,
    subject,
    text,
    html: html || renderEmailHtml({ subject, text }),
  });
  if (transporter.__ethereal) {
    console.log(`[email] Preview: ${nodemailer.getTestMessageUrl(info)}`);
  }
  return info;
}

// Sparrow SMS v2 API (https://github.com/sparrowsms/apidocs):
// POST https://api.sparrowsms.com/v2/sms/ with form-encoded token/from/to/text.
// `to` takes comma-separated 10-digit mobile numbers; success is
// HTTP 200 + { response_code: 200 }, errors are 403 + codes 1000–1013.

// Sparrow expects bare 10-digit numbers — strip +977 / 977 prefixes.
function toSparrowNumber(phone) {
  const digits = String(phone).replace(/\D/g, '');
  return digits.length > 10 ? digits.slice(-10) : digits;
}

async function sendSms({ to, text }) {
  if (!to) throw new Error('sendSms: missing recipient');
  if (!config.sms.enabled) {
    console.log(`[sms:dev] to=${to} text="${text}"`);
    return { dev: true };
  }

  const recipients = (Array.isArray(to) ? to : [to]).map(toSparrowNumber).join(',');
  const res = await fetch(config.sms.apiUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      token: config.sms.token,
      from: config.sms.from,
      to: recipients,
      text,
    }),
  });

  const payload = await res.json().catch(() => null);
  if (!res.ok || !payload || payload.response_code !== 200) {
    const detail = payload
      ? `${payload.response_code}: ${payload.response}`
      : `HTTP ${res.status}`;
    throw new Error(`Sparrow SMS error — ${detail}`);
  }
  return payload;
}

module.exports = { sendEmail, sendSms };
