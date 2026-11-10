import pino from 'pino';
import { env, isProduction } from './env.js';

export const logger = pino({
  level: env.LOG_LEVEL,
  redact: {
    paths: [
      'req.headers.authorization',
      'req.headers.cookie',
      'req.headers["x-api-key"]',
      'req.headers["x-fedapay-signature"]',
      'req.headers["x-ultrasms-signature"]',
      'res.headers["set-cookie"]',
      'password',
      'passwordHash',
      'secret',
      'apiKey',
      'token',
    ],
    censor: '[REDACTED]',
  },
  transport: isProduction
    ? undefined
    : {
        target: 'pino/file',
        options: { destination: 1 },
      },
});
