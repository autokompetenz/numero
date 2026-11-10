import { existsSync } from 'node:fs';
import path from 'node:path';
import express, { Express } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import pinoHttp from 'pino-http';
import { env, corsOrigins, devToolsEnabled, isProduction } from './config/env.js';
import { logger } from './config/logger.js';
import { prisma } from './db/prisma.js';
import { generalLimiter } from './middleware/rateLimit.js';
import { errorHandler, notFoundHandler } from './middleware/error.js';
import { forbidden } from './lib/errors.js';
import { authRouter } from './routes/auth.js';
import { catalogRouter } from './routes/catalog.js';
import { ordersRouter } from './routes/orders.js';
import { walletRouter } from './routes/wallet.js';
import { paymentsRouter } from './routes/payments.js';
import { webhooksRouter } from './routes/webhooks.js';
import { adminRouter } from './routes/admin.js';
import { devRouter } from './routes/dev.js';
import { runPollerTick } from './services/poller.js';

export function createApp(): Express {
  const app = express();

  app.disable('x-powered-by');
  app.set('trust proxy', env.TRUST_PROXY);

  app.use(
    helmet({
      // L'API renvoie du JSON ; la CSP de l'application web est gérée par son hôte.
      contentSecurityPolicy: false,
      crossOriginResourcePolicy: { policy: 'cross-origin' },
    }),
  );

  app.use(
    cors({
      origin(origin, callback) {
        if (!origin) return callback(null, true);
        if (corsOrigins.includes(origin)) return callback(null, true);
        return callback(forbidden(`Origine non autorisée : ${origin}`));
      },
      credentials: true,
      methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'Idempotency-Key'],
    }),
  );

  app.use(
    pinoHttp({
      logger,
      autoLogging: {
        ignore: (req) => req.url === '/api/health',
      },
      customLogLevel: (_req, res, error) => {
        if (error || res.statusCode >= 500) return 'error';
        if (res.statusCode >= 400) return 'warn';
        return 'info';
      },
      redact: {
        paths: [
          'req.headers.authorization',
          'req.headers.cookie',
          'res.headers["set-cookie"]',
        ],
        censor: '[REDACTED]',
      },
    }),
  );

  // Les webhooks ont besoin du corps brut pour vérifier leur signature.
  app.use('/api/webhooks', express.raw({ type: '*/*', limit: '1mb' }));

  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: false, limit: '100kb' }));
  app.use(cookieParser());

  // L'API ne doit jamais être mise en cache (sessions, soldes, paiements).
  // Vercel respecte les en-têtes de cache des origines externes sur les rewrites.
  app.use('/api', (_req, res, next) => {
    res.setHeader('Cache-Control', 'no-store');
    next();
  });

  app.get('/api/health', async (_req, res) => {
    let database = 'down';
    try {
      await prisma.$queryRaw`SELECT 1`;
      database = 'up';
    } catch {
      database = 'down';
    }
    res.status(database === 'up' ? 200 : 503).json({
      status: database === 'up' ? 'ok' : 'degraded',
      database,
      environment: env.NODE_ENV,
      paymentsMode: env.PAYMENTS_MODE,
      ultrasmsMode: env.ULTRASMS_MODE,
      uptime: Math.round(process.uptime()),
    });
  });

  app.get('/api/cron/poller', async (req, res, next) => {
    if (!env.CRON_SECRET || req.headers.authorization !== `Bearer ${env.CRON_SECRET}`) {
      res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'Accès refusé.' } });
      return;
    }
    try {
      await runPollerTick();
      res.json({ ok: true });
    } catch (error) {
      next(error);
    }
  });

  app.get('/api', (_req, res) => {
    res.json({
      name: 'Numivo API',
      version: '1.0.0',
      documentation: '/api/health',
    });
  });

  app.use('/api/auth', generalLimiter, authRouter);
  app.use('/api/catalog', generalLimiter, catalogRouter);
  app.use('/api/orders', generalLimiter, ordersRouter);
  app.use('/api/wallet', generalLimiter, walletRouter);
  app.use('/api/payments', generalLimiter, paymentsRouter);
  app.use('/api/admin', generalLimiter, adminRouter);
  app.use('/api/webhooks', webhooksRouter);

  if (devToolsEnabled) {
    app.use('/api/dev', devRouter);
  }

  // En production, l'API peut servir le build React (déploiement mono-service).
  if (isProduction) {
    const candidates = [
      path.resolve(process.cwd(), 'public'),
      path.resolve(process.cwd(), '..', 'public'),
      path.resolve(process.cwd(), '..', 'dist'),
      path.resolve(process.cwd(), 'dist'),
    ];
    const staticDir = candidates.find((candidate) => existsSync(candidate));
    if (staticDir) {
      app.use(express.static(staticDir, { maxAge: '1h', index: false }));
      app.get('*', (req, res, next) => {
        if (req.path.startsWith('/api/')) return next();
        res.sendFile(path.join(staticDir, 'index.html'));
      });
      logger.info({ staticDir }, 'Frontend statique servi par l’API');
    }
  }

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}

const app = createApp();
export default app;
