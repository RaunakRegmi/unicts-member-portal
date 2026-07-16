const config = require('./env');

let transporter = null;
if (config.smtp.enabled) {
  const nodemailer = require('nodemailer');
  transporter = nodemailer.createTransport({
    host: config.smtp.host,
    port: config.smtp.port,
    secure: config.smtp.port === 465,
    auth: config.smtp.user
      ? { user: config.smtp.user, pass: config.smtp.pass }
      : undefined,
  });
}

async function sendEmail({ to, subject, text, html }) {
  if (!to) throw new Error('sendEmail: missing recipient');
  if (!transporter) {
    console.log(`[email:dev] to=${to} subject="${subject}"\n${text}`);
    return { dev: true };
  }
  return transporter.sendMail({ from: config.smtp.from, to, subject, text, html });
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
