import { env, isLiveEnvironment } from '../../config/env.js';
import { LiveUltraSmsProvider } from './live.js';
import { MockUltraSmsProvider } from './mock.js';
import { UltraSmsProvider } from './types.js';

let instance: UltraSmsProvider | null = null;

export function getUltraSmsProvider(): UltraSmsProvider {
  if (instance) return instance;

  if (env.ULTRASMS_MODE === 'mock') {
    if (isLiveEnvironment) {
      // Ceinture et bretelles : env.ts bloque déjà ce cas au démarrage.
      throw new Error('Le mode mock Ultra SMS est interdit en environnement live.');
    }
    instance = new MockUltraSmsProvider();
    return instance;
  }

  instance = new LiveUltraSmsProvider();
  return instance;
}

export function resetUltraSmsProviderForTests(): void {
  instance = null;
}

export * from './types.js';
