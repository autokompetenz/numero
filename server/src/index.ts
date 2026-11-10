import { createServer } from 'node:http';
import { createApp } from './app.js';
import { env, isProduction } from './config/env.js';
import { logger } from './config/logger.js';
import { prisma, disconnectPrisma } from './db/prisma.js';
import { startPoller, stopPoller } from './services/poller.js';

async function main(): Promise<void> {
  try {
    await prisma.$queryRaw`SELECT 1`;
  } catch (error) {
    logger.fatal({ err: error }, 'Connexion PostgreSQL impossible');
    process.exit(1);
  }

  const app = createApp();
  const server = createServer(app);

  server.listen(env.PORT, () => {
    logger.info(
      {
        port: env.PORT,
        environment: env.NODE_ENV,
        paymentsMode: env.PAYMENTS_MODE,
        ultrasmsMode: env.ULTRASMS_MODE,
      },
      'API Numivo démarrée',
    );
    if (isProduction && (env.PAYMENTS_MODE === 'mock' || env.ULTRASMS_MODE === 'mock')) {
      logger.fatal('Mode simulation détecté en production — arrêt immédiat.');
      process.exit(1);
    }
    startPoller();
  });

  const shutdown = async (signal: string): Promise<void> => {
    logger.info({ signal }, 'Arrêt en cours');
    stopPoller();
    server.close(async () => {
      await disconnectPrisma();
      process.exit(0);
    });
    setTimeout(() => process.exit(1), 10_000).unref();
  };

  process.on('SIGTERM', () => void shutdown('SIGTERM'));
  process.on('SIGINT', () => void shutdown('SIGINT'));

  process.on('unhandledRejection', (reason) => {
    logger.error({ err: reason }, 'Promesse rejetée non gérée');
  });
  process.on('uncaughtException', (error) => {
    logger.fatal({ err: error }, 'Exception non capturée');
    process.exit(1);
  });
}

void main();
