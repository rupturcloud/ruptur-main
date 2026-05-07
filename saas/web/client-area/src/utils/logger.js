import * as Sentry from "@sentry/react";

export const logger = {
  debug: (msg, data = {}) => {
    console.debug(`[DEBUG] ${msg}`, data);
  },

  info: (msg, data = {}) => {
    console.log(`[INFO] ${msg}`, data);
    Sentry.captureMessage(msg, { level: 'info', extra: data });
  },

  warn: (msg, data = {}) => {
    console.warn(`[WARN] ${msg}`, data);
    Sentry.captureMessage(msg, { level: 'warning', extra: data });
  },

  error: (msg, error, context = {}) => {
    console.error(`[ERROR] ${msg}`, error, context);
    Sentry.captureException(error, {
      tags: { origin: 'logger', ...context },
      level: 'error',
    });
  },
};
