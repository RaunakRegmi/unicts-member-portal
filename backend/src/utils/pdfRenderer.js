const fs = require('fs');
const config = require('../config/env');

// puppeteer-core drives a locally installed Chrome, so the install stays
// light. Set PUPPETEER_EXECUTABLE_PATH to point at a specific binary.
const CHROME_PATHS = [
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Chromium.app/Contents/MacOS/Chromium',
  '/usr/bin/google-chrome',
  '/usr/bin/google-chrome-stable',
  '/usr/bin/chromium-browser',
  '/usr/bin/chromium',
];

function resolveExecutablePath() {
  if (config.puppeteerExecutablePath) return config.puppeteerExecutablePath;
  return CHROME_PATHS.find((p) => fs.existsSync(p)) || null;
}

async function renderPdf(html, pdfOptions = {}) {
  const puppeteer = require('puppeteer-core');
  const executablePath = resolveExecutablePath();

  let browser;
  try {
    browser = await puppeteer.launch({
      ...(executablePath ? { executablePath } : { channel: 'chrome' }),
      headless: true,
      args: ['--no-sandbox', '--disable-dev-shm-usage'],
    });
  } catch (err) {
    throw new Error(
      `PDF rendering needs Google Chrome or Chromium installed (or set PUPPETEER_EXECUTABLE_PATH). Launch failed: ${err.message}`
    );
  }

  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle0' });
    return await page.pdf({ printBackground: true, ...pdfOptions });
  } finally {
    await browser.close();
  }
}

module.exports = { renderPdf };
