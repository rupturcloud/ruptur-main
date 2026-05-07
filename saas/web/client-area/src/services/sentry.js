import * as Sentry from "@sentry/react";

export function initSentry() {
  Sentry.init({
    dsn: import.meta.env.VITE_SENTRY_DSN,
    environment: import.meta.env.VITE_ENVIRONMENT || 'development',
    integrations: [
      Sentry.browserTracingIntegration(),
      Sentry.replayIntegration({ maskAllText: true, blockAllMedia: true }),
    ],
    tracesSampleRate: import.meta.env.VITE_ENVIRONMENT === 'production' ? 0.1 : 1.0,
    replaysSessionSampleRate: 0.1,
    replaysOnErrorSampleRate: 1.0,
  });
}

export function captureAuthError(error, context) {
  Sentry.captureException(error, {
    tags: { component: 'AuthContext', ...context },
    level: 'error',
  });
}

export function logAuthEvent(event, data) {
  Sentry.captureMessage(event, {
    level: 'info',
    tags: { component: 'AuthContext' },
    extra: data,
  });
}
