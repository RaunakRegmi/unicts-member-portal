/* Sends one test email through the configured provider chain.
 * Usage: npm run email:test -- you@example.com
 */
const { sendEmail } = require('../src/config/providers');
const config = require('../src/config/env');

const to = process.argv[2];
if (!to || !to.includes('@')) {
  console.error('Usage: npm run email:test -- you@example.com');
  process.exit(1);
}

(async () => {
  console.log(
    config.smtp.enabled
      ? `Sending via configured SMTP (${config.smtp.host}:${config.smtp.port}) …`
      : 'No SMTP_HOST configured — this will go to the Ethereal test inbox (or console), NOT a real inbox.'
  );
  try {
    await sendEmail({
      to,
      subject: 'UNICTS Member Portal — SMTP test',
      text: `This is a test email from the UNICTS Member Portal backend.\nIf you are reading this in your inbox, SMTP delivery is working.\nSent at ${new Date().toISOString()}`,
    });
    console.log(`Done — check ${to} (and the spam folder for the first message).`);
  } catch (err) {
    console.error('Send failed:', err.message);
    process.exit(1);
  }
  process.exit(0);
})();
