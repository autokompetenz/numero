import { env, isTest } from '../config/env.js';
import { logger } from '../config/logger.js';
import { expirePendingOrders, listProcessingOrders } from './orders.js';
import { syncOrderFromProvider } from './fulfillment.js';

let timer: NodeJS.Timeout | null = null;
let running = false;

export async function runPollerTick(): Promise<void> {
  if (running) return;
  running = true;
  try {
    const expired = await expirePendingOrders();
    if (expired > 0) {
      logger.info({ expired }, 'Commandes en attente expirées');
    }

    const orders = await listProcessingOrders(25);
    for (const order of orders) {
      await syncOrderFromProvider(order.id);
    }
  } catch (error) {
    logger.error({ err: error }, 'Erreur du poller de commandes');
  } finally {
    running = false;
  }
}

export function startPoller(): void {
  if (isTest || timer) return;
  const interval = Math.max(3_000, env.ULTRASMS_POLL_INTERVAL_MS);
  timer = setInterval(() => {
    void runPollerTick();
  }, interval);
  timer.unref?.();
  void runPollerTick();
  logger.info({ interval }, 'Poller de commandes démarré');
}

export function stopPoller(): void {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
}
