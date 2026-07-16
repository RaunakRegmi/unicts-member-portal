// Maps queue name → { jobName: handler }. Shared by the BullMQ workers
// (worker.js) and the inline no-Redis fallback (queues.js).
module.exports = {
  idcard: {
    generate: async (data) => {
      const idcardService = require('../services/idcard.service');
      return idcardService.generateForApplication(data.applicationId);
    },
  },
  notifications: {
    send: async (data) => {
      const notificationService = require('../services/notification.service');
      return notificationService.sendToUser(data.userId, data.payload);
    },
  },
  calendar: {
    syncEventForAllUsers: async (data) => {
      const calendarSyncService = require('../services/calendarSync.service');
      return calendarSyncService.syncEventForAllUsers(data.eventId);
    },
  },
  maintenance: {
    renewalReminders: async () => {
      const { run } = require('./renewalReminder.job');
      return run();
    },
  },
};
