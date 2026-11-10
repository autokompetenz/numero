import { existsSync } from 'node:fs';
import path from 'node:path';
import dotenv from 'dotenv';
import { z } from 'zod';

// Recherche du .env à la racine du projet (dossier parent de server/).
const cwd = process.cwd();
const candidates = [
  path.resolve(cwd, '.env'),
  path.resolve(cwd, '..', '.env'),
];
for (const candidate of candidates) {
  if (existsSync(candidate)) {
    dotenv.config({ path: candidate });
    break;
  }
}

const booleanish = z
  .union([z.boolean(), z.string()])
  .transform((value) => {
    if (typeof value === 'boolean') return value;
    return ['1', 'true', 'yes', 'on'].includes(value.toLowerCase());
  });

const numberish = (fallback: number, min = 0) =>
  z
    .union([z.number(), z.string()])
    .optional()
    .transform((value) => {
      if (value === undefined || value === '') return fallback;
      const parsed = Number(value);
      return Number.isFinite(parsed) ? parsed : fallback;
    })
    .pipe(z.number().min(min));

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  APP_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: numberish(4000, 1),
  APP_URL: z.string().url().default('http://localhost:4000'),
  FRONTEND_URL: z.string().url().default('http://localhost:3000'),
  CORS_ORIGINS: z.string().default('http://localhost:3000,http://127.0.0.1:3000'),
  TRUST_PROXY: numberish(0, 0),

  DATABASE_URL: z.string().min(1, 'DATABASE_URL est requis'),

  JWT_ACCESS_SECRET: z.string().min(32, 'JWT_ACCESS_SECRET doit contenir au moins 32 caractères'),
  ACCESS_TOKEN_TTL: z.string().default('15m'),
  REFRESH_TOKEN_TTL_DAYS: numberish(7, 1),
  COOKIE_SECURE: booleanish.default(false),

  ADMIN_EMAIL: z.string().email().default('admin@numivo.local'),
  ADMIN_PASSWORD: z.string().min(8).optional(),
  ADMIN_NAME: z.string().default('Administrateur Numivo'),
  ADMIN_COUNTRY: z.string().default('Bénin'),

  ULTRASMS_MODE: z.enum(['mock', 'live']).default('mock'),
  ULTRASMS_API_KEY: z.string().optional().default(''),
  ULTRASMS_BASE_URL: z.string().url().default('https://ultrasmsin.com/api/v1'),
  ULTRASMS_WEBHOOK_SECRET: z.string().optional().default(''),
  ULTRASMS_CALLBACK_URL: z.string().optional().default(''),
  ULTRASMS_MOCK_SMS_DELAY_MS: numberish(12000, 0),
  ULTRASMS_POLL_INTERVAL_MS: numberish(10000, 3000),

  PAYMENTS_MODE: z.enum(['mock', 'sandbox', 'live']).default('sandbox'),
  FEDAPAY_PUBLIC_KEY: z.string().optional().default(''),
  FEDAPAY_SECRET_KEY: z.string().optional().default(''),
  FEDAPAY_WEBHOOK_SECRET: z.string().optional().default(''),

  EUR_XOF_RATE: numberish(655.957, 0.000001),
  USD_XOF_RATE: numberish(615, 0.000001),
  TARGET_MARGIN_XOF: numberish(2000, 0),
  PAYMENT_RATE_MOBILE_MONEY: numberish(0.018, 0),
  PAYMENT_RATE_CARD: numberish(0.036, 0),
  PAYMENT_RATE_WALLET: numberish(0, 0),
  ROUNDING_STEP_XOF: numberish(100, 1),

  RATE_LIMIT_WINDOW_MS: numberish(60000, 1000),
  RATE_LIMIT_MAX: numberish(120, 1),
  AUTH_RATE_LIMIT_MAX: numberish(10, 1),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
  SMS_RETENTION_DAYS: numberish(30, 1),
});

const parsed = schema.safeParse(process.env);

if (!parsed.success) {
  const details = parsed.error.issues
    .map((issue) => `  - ${issue.path.join('.')}: ${issue.message}`)
    .join('\n');
  // eslint-disable-next-line no-console
  console.error(`Configuration invalide :\n${details}\n\nCopier .env.example vers .env et renseigner les valeurs.`);
  process.exit(1);
}

export const env = parsed.data;
export const isProduction = env.NODE_ENV === 'production';
export const isDevelopment = env.NODE_ENV === 'development';
export const isTest = env.NODE_ENV === 'test';

export const corsOrigins = env.CORS_ORIGINS.split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

// -----------------------------------------------------------------------------
// Garde-fous : aucune simulation ne doit pouvoir tourner en production.
// -----------------------------------------------------------------------------
const productionErrors: string[] = [];

if (isProduction) {
  if (env.ULTRASMS_MODE === 'mock') {
    productionErrors.push('ULTRASMS_MODE=mock est interdit en production.');
  }
  if (env.PAYMENTS_MODE === 'mock') {
    productionErrors.push('PAYMENTS_MODE=mock est interdit en production.');
  }
  if (!env.COOKIE_SECURE) {
    productionErrors.push('COOKIE_SECURE doit être true en production (HTTPS obligatoire).');
  }
  if (env.JWT_ACCESS_SECRET.length < 64) {
    productionErrors.push('JWT_ACCESS_SECRET doit contenir au moins 64 caractères en production.');
  }
  if (!env.ADMIN_PASSWORD) {
    productionErrors.push('ADMIN_PASSWORD est requis en production (compte administrateur).');
  } else if (env.ADMIN_PASSWORD.length < 12) {
    productionErrors.push('ADMIN_PASSWORD doit contenir au moins 12 caractères en production.');
  }
  if (env.APP_URL.startsWith('http://')) {
    productionErrors.push('APP_URL doit utiliser HTTPS en production.');
  }
}

if (env.ULTRASMS_MODE === 'live' && !env.ULTRASMS_API_KEY) {
  productionErrors.push('ULTRASMS_API_KEY est requis quand ULTRASMS_MODE=live.');
}

if (isProduction && env.ULTRASMS_MODE === 'live' && !env.ULTRASMS_WEBHOOK_SECRET) {
  productionErrors.push('ULTRASMS_WEBHOOK_SECRET est requis en production (signature des callbacks).');
}

if (env.PAYMENTS_MODE !== 'mock' && !env.FEDAPAY_SECRET_KEY) {
  productionErrors.push('FEDAPAY_SECRET_KEY est requis quand PAYMENTS_MODE est sandbox ou live.');
}

if (isProduction && env.PAYMENTS_MODE !== 'mock' && !env.FEDAPAY_WEBHOOK_SECRET) {
  productionErrors.push('FEDAPAY_WEBHOOK_SECRET est requis en production.');
}

if (productionErrors.length > 0) {
  // eslint-disable-next-line no-console
  console.error(`Configuration refusée :\n${productionErrors.map((error) => `  - ${error}`).join('\n')}`);
  process.exit(1);
}
