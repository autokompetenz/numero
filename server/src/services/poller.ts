import { env, isTest } from '../config/env.js';
import { logger } from '../config/logger.js';
import { expirePendingOrders, listPaidOrders, listProcessingOrders } from './orders.js';
import { fulfillOrder, syncOrderFromProvider } from './fulfillment.js';

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

    const paidOrders = await listPaidOrders(25);
    for (const order of paidOrders) {
      await fulfillOrder(order.id);
    }

    const orders = await listProcessingOrders(25);
    for (const order of orders) {
      await syncOrderFromProvider(order.id);
    }
  } catch (error) {
    logger.error({ err: error }, 'Erreur du poller de commandes');
    throw error;
  } finally {
    running = false;
  }
}

export function startPoller(): void {
  if (isTest || timer) return;
  const interval = Math.max(3_000, env.ULTRASMS_POLL_INTERVAL_MS);
  timer = setInterval(() => {
    void runPollerTick().catch(() => undefined);
  }, interval);
  timer.unref?.();
  void runPollerTick().catch(() => undefined);
  logger.info({ interval }, 'Poller de commandes démarré');
}

export function stopPoller(): void {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
}
