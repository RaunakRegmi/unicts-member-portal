const eventService = require('../services/event.service');

async function list(req, res, next) {
  try {
    const events = await eventService.listEvents(
      { filter: req.query.filter },
      req.user.id
    );
    res.status(200).json({ success: true, data: events });
  } catch (err) {
    next(err);
  }
}

async function detail(req, res, next) {
  try {
    const event = await eventService.getEvent(req.params.id, req.user.id);
    res.status(200).json({ success: true, data: event });
  } catch (err) {
    next(err);
  }
}

async function rsvp(req, res, next) {
  try {
    const registration = await eventService.rsvp(req.user.id, req.params.id);
    res.status(201).json({ success: true, data: registration });
  } catch (err) {
    next(err);
  }
}

module.exports = { list, detail, rsvp };
