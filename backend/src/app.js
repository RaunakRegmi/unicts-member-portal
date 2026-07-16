const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const morgan = require('morgan');
const cookieParser = require('cookie-parser');
const config = require('./config/env');
const {
  errorHandler,
  notFoundHandler,
} = require('./middleware/errorHandler.middleware');

const authRoutes = require('./routes/auth.routes');
const membershipRoutes = require('./routes/membership.routes');
const profileRoutes = require('./routes/profile.routes');
const documentsRoutes = require('./routes/documents.routes');
const cvRoutes = require('./routes/cv.routes');
const cvTemplatesRoutes = require('./routes/cvTemplates.routes');
const idcardRoutes = require('./routes/idcard.routes');
const calendarRoutes = require('./routes/calendar.routes');
const certificationsRoutes = require('./routes/certifications.routes');
const eventsRoutes = require('./routes/events.routes');
const newslettersRoutes = require('./routes/newsletters.routes');
const referenceRoutes = require('./routes/reference.routes');
const adminRoutes = require('./routes/admin.routes');
const verifyController = require('./controllers/verify.controller');
const filesController = require('./controllers/files.controller');

const app = express();

app.set('trust proxy', 1);
// Signed-URL assets are loaded cross-origin by the SPA
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
app.use(cors({ origin: config.appUrl, credentials: true }));
if (config.isDev) app.use(morgan('dev'));
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

app.get('/api/health', (req, res) =>
  res.json({ ok: true, service: 'unicts-api', env: config.nodeEnv })
);

app.use('/api/auth', authRoutes);
app.use('/api/membership', membershipRoutes);
app.use('/api/members/me/documents', documentsRoutes);
app.use('/api/members/me/cv', cvRoutes);
app.use('/api/members/me/id-card', idcardRoutes);
app.use('/api/members/me/calendar', calendarRoutes);
app.use('/api/members/me/certifications', certificationsRoutes);
app.use('/api/members/me', profileRoutes);
app.use('/api/cv-templates', cvTemplatesRoutes);
app.use('/api/events', eventsRoutes);
app.use('/api/newsletters', newslettersRoutes);
app.use('/api/reference', referenceRoutes);
app.use('/api/admin', adminRoutes);

// Public QR-code verification page data + local-mode signed file serving
app.get('/api/verify/:cardNumber', verifyController.verifyCard);
app.get('/api/files/*', filesController.serve);

// Short redirects used in credential SMS texts, keeping messages compact
const SHORT_LINKS = {
  login: `${config.appUrl}/login`,
  reset: `${config.appUrl}/forgot-password`,
};
app.get('/r/:code', (req, res) => {
  const target = SHORT_LINKS[req.params.code];
  if (!target) return res.status(404).send('Unknown link');
  return res.redirect(target);
});

app.use(notFoundHandler);
app.use(errorHandler);

module.exports = app;
