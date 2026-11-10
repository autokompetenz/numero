import { env, isLiveEnvironment } from '../../config/env.js';
import { LiveFedaPayClient } from './client.js';
import { MockFedaPayClient } from './mock.js';
import { FedaPayClient } from './types.js';

let instance: FedaPayClient | null = null;

export function getFedaPayClient(): FedaPayClient {
  if (instance) return instance;

  if (env.PAYMENTS_MODE === 'mock') {
    if (isLiveEnvironment) {
      throw new Error('Le mode mock FedaPay est interdit en environnement live.');
    }
    instance = new MockFedaPayClient();
    return instance;
  }

  instance = new LiveFedaPayClient(env.PAYMENTS_MODE);
  return instance;
}

export function getMockFedaPayClient(): MockFedaPayClient | null {
  const client = getFedaPayClient();
  return client instanceof MockFedaPayClient ? client : null;
}

export function resetFedaPayClientForTests(): void {
  instance = null;
}

export * from './types.js';
export { verifyFedaPayWebhook } from './client.js';
