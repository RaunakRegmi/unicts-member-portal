const calendarSyncService = require('../services/calendarSync.service');

async function getAuthUrl(req, res, next) {
  try {
    const url = calendarSyncService.getAuthUrl(req.user.id);
    res.status(200).json({ success: true, data: { url } });
  } catch (err) {
    next(err);
  }
}

// Public: Google redirects the browser here; identity is proven by the
// signed `state` parameter, not by an Authorization header.
async function callback(req, res, next) {
  try {
    const { redirectUrl } = await calendarSyncService.handleCallback({
      code: req.query.code,
      state: req.query.state,
    });
    res.redirect(redirectUrl);
  } catch (err) {
    next(err);
  }
}

async function sync(req, res, next) {
  try {
    const result = await calendarSyncService.syncUserCalendar(req.user.id);
    res.status(200).json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
}

async function status(req, res, next) {
  try {
    const result = await calendarSyncService.getConnectionStatus(req.user.id);
    res.status(200).json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
}

module.exports = { getAuthUrl, callback, sync, status };
