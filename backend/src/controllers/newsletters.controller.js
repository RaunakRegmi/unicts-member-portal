const newsletterService = require('../services/newsletter.service');

async function list(req, res, next) {
  try {
    const newsletters = await newsletterService.list();
    res.status(200).json({ success: true, data: newsletters });
  } catch (err) {
    next(err);
  }
}

async function detail(req, res, next) {
  try {
    const newsletter = await newsletterService.get(req.params.id);
    res.status(200).json({ success: true, data: newsletter });
  } catch (err) {
    next(err);
  }
}

module.exports = { list, detail };
