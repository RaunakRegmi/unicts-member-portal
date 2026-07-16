const authService = require('../services/auth.service');
const config = require('../config/env');

const REFRESH_COOKIE = 'unicts_rt';

function setRefreshCookie(res, token, expires) {
  res.cookie(REFRESH_COOKIE, token, {
    httpOnly: true,
    secure: !config.isDev,
    sameSite: 'lax',
    expires,
    path: '/api/auth',
  });
}

function clearRefreshCookie(res) {
  res.clearCookie(REFRESH_COOKIE, { path: '/api/auth' });
}

async function signup(req, res, next) {
  try {
    const result = await authService.signup(req.body);
    res.status(201).json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
}

async function verifyOtp(req, res, next) {
  try {
    const { user, tokens } = await authService.verifyOtp(req.body);
    setRefreshCookie(res, tokens.refreshToken, tokens.refreshExpiresAt);
    res.status(200).json({ success: true, data: { user, accessToken: tokens.accessToken } });
  } catch (err) {
    next(err);
  }
}

async function resendOtp(req, res, next) {
  try {
    const result = await authService.resendOtp(req.body);
    res.status(200).json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
}

async function login(req, res, next) {
  try {
    const { user, tokens } = await authService.login(req.body);
    setRefreshCookie(res, tokens.refreshToken, tokens.refreshExpiresAt);
    res.status(200).json({ success: true, data: { user, accessToken: tokens.accessToken } });
  } catch (err) {
    next(err);
  }
}

async function refresh(req, res, next) {
  try {
    const rawToken = req.cookies[REFRESH_COOKIE] || req.body.refreshToken;
    const { user, tokens } = await authService.refresh(rawToken);
    setRefreshCookie(res, tokens.refreshToken, tokens.refreshExpiresAt);
    res.status(200).json({ success: true, data: { user, accessToken: tokens.accessToken } });
  } catch (err) {
    clearRefreshCookie(res);
    next(err);
  }
}

async function logout(req, res, next) {
  try {
    await authService.logout(req.cookies[REFRESH_COOKIE] || req.body.refreshToken);
    clearRefreshCookie(res);
    res.status(200).json({ success: true, data: { loggedOut: true } });
  } catch (err) {
    next(err);
  }
}

async function forgotPassword(req, res, next) {
  try {
    const result = await authService.forgotPassword(req.body);
    res.status(200).json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
}

async function resetPassword(req, res, next) {
  try {
    const result = await authService.resetPassword(req.body);
    res.status(200).json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
}

async function me(req, res, next) {
  try {
    const result = await authService.getMe(req.user.id);
    res.status(200).json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  signup,
  verifyOtp,
  resendOtp,
  login,
  refresh,
  logout,
  forgotPassword,
  resetPassword,
  me,
};
