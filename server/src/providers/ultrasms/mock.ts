import { randomUUID, createHash } from 'node:crypto';
import { env } from '../../config/env.js';
import {
  UltraSmsApiError,
  UltraSmsBalance,
  UltraSmsCountry,
  UltraSmsOrder,
  UltraSmsOrderStatus,
  UltraSmsPrice,
  UltraSmsProvider,
  UltraSmsPurchaseInput,
  UltraSmsService,
} from './types.js';

interface MockOrderInternal extends UltraSmsOrder {
  createdMs: number;
  codes: Array<{ code: string; text?: string; receivedAt?: string }>;
  smsDelayMs: number;
}

const COUNTRIES: UltraSmsCountry[] = [
  { code: 'BJ', name: 'Bénin', dialCode: '229' },
  { code: 'CI', name: "Côte d'Ivoire", dialCode: '225' },
  { code: 'SN', name: 'Sénégal', dialCode: '221' },
  { code: 'TG', name: 'Togo', dialCode: '228' },
  { code: 'FR', name: 'France', dialCode: '33' },
  { code: 'US', name: 'United States', dialCode: '1' },
  { code: 'GB', name: 'United Kingdom', dialCode: '44' },
  { code: 'NG', name: 'Nigeria', dialCode: '234' },
  { code: 'CM', name: 'Cameroun', dialCode: '237' },
  { code: 'CA', name: 'Canada', dialCode: '1' },
  { code: 'DE', name: 'Allemagne', dialCode: '49' },
  { code: 'NL', name: 'Pays-Bas', dialCode: '31' },
];

const SERVICES: UltraSmsService[] = [
  { code: 'wa', name: 'WhatsApp' },
  { code: 'tg', name: 'Telegram' },
  { code: 'go', name: 'Google' },
  { code: 'openai', name: 'OpenAI' },
  { code: 'tk', name: 'TikTok' },
  { code: 'ig', name: 'Instagram' },
  { code: 'ms', name: 'Microsoft' },
  { code: 'tinder', name: 'Tinder' },
  { code: 'uber', name: 'Uber' },
  { code: 'netflix', name: 'Netflix' },
  { code: 'binance', name: 'Binance' },
  { code: 'paypal', name: 'PayPal' },
];

function hashCode(seed: string): string {
  const digest = createHash('sha256').update(seed).digest('hex');
  const value = Number.parseInt(digest.slice(0, 12), 16) % 1_000_000;
  return value.toString().padStart(6, '0');
}

function mockPriceCents(service: string, countryCode: string): number {
  const serviceIndex = Math.max(0, SERVICES.findIndex((item) => item.code === service));
  const countryIndex = Math.max(0, COUNTRIES.findIndex((item) => item.code === countryCode));
  return 90 + serviceIndex * 15 + countryIndex * 7;
}

function mockPhone(countryCode: string): string {
  const country = COUNTRIES.find((item) => item.code === countryCode);
  const dial = country?.dialCode ?? '1';
  const suffix = Math.floor(10000000 + Math.random() * 89999999).toString();
  return `${dial}${suffix.slice(0, countryCode === 'FR' ? 9 : 8)}`;
}

export class MockUltraSmsProvider implements UltraSmsProvider {
  readonly mode = 'mock' as const;
  private readonly orders = new Map<string, MockOrderInternal>();

  async getBalance(): Promise<UltraSmsBalance> {
    return { balanceCents: 100_000, balance: '1000.00', currency: 'USD' };
  }

  async getServices(): Promise<UltraSmsService[]> {
    return [...SERVICES];
  }

  async getCountries(): Promise<UltraSmsCountry[]> {
    return [...COUNTRIES];
  }

  async getPrices(params?: {
    service?: string;
    country?: string;
    server?: number;
  }): Promise<UltraSmsPrice[]> {
    const services = params?.service
      ? SERVICES.filter((item) => item.code === params.service)
      : SERVICES;
    const countries = params?.country
      ? COUNTRIES.filter((item) => item.code === params.country!.toUpperCase())
      : COUNTRIES;

    return services.flatMap((service) =>
      countries.map((country) => {
        const priceCents = mockPriceCents(service.code, country.code);
        return {
          service: service.code,
          name: service.name,
          server: 1,
          country: country.code,
          priceCents,
          price: (priceCents / 100).toFixed(2),
          count: 500,
        };
      }),
    );
  }

  async purchase(input: UltraSmsPurchaseInput): Promise<UltraSmsOrder> {
    if (!input.service || !input.country) {
      throw new UltraSmsApiError('invalido', 'Service et pays requis.', 400);
    }
    const priceCents = mockPriceCents(input.service, input.country.toUpperCase());
    if (input.maxPriceCents !== undefined && priceCents > input.maxPriceCents) {
      throw new UltraSmsApiError('preco_mudou', 'Le prix fournisseur a changé.', 409);
    }

    const id = `mock_${randomUUID()}`;
    const now = Date.now();
    const order: MockOrderInternal = {
      id,
      ref: Math.floor(100000 + Math.random() * 900000),
      service: input.service,
      country: input.country.toUpperCase(),
      server: 1,
      phone: mockPhone(input.country.toUpperCase()),
      priceCents,
      price: (priceCents / 100).toFixed(2),
      status: 'waiting',
      code: null,
      sms: null,
      codes: [],
      createdAt: new Date(now).toISOString(),
      expiresAt: new Date(now + 20 * 60 * 1000).toISOString(),
      cancelAvailableAt: new Date(now).toISOString(),
      createdMs: now,
      smsDelayMs: env.ULTRASMS_MOCK_SMS_DELAY_MS,
    };
    this.orders.set(id, order);
    return this.publicOrder(order);
  }

  async getOrder(id: string): Promise<UltraSmsOrder> {
    const order = this.orders.get(id);
    if (!order) {
      throw new UltraSmsApiError('nao_encontrado', 'Commande introuvable chez le fournisseur.', 404);
    }

    const elapsed = Date.now() - order.createdMs;
    if (order.status === 'waiting' && elapsed >= order.smsDelayMs) {
      const code = hashCode(order.id);
      const sender = SERVICES.find((item) => item.code === order.service)?.name ?? 'Service';
      const message = `Votre code de vérification ${sender} est : ${code}. Numivo (mode démonstration).`;
      order.code = code;
      order.sms = message;
      order.codes = [
        {
          code,
          text: message,
          receivedAt: new Date(order.createdMs + order.smsDelayMs).toISOString(),
        },
      ];
      order.status = 'received';
    }

    if (order.status === 'waiting' && Date.now() > Date.parse(order.expiresAt ?? '')) {
      order.status = 'expired';
    }

    return this.publicOrder(order);
  }

  async cancel(id: string): Promise<UltraSmsOrder> {
    const order = this.orders.get(id);
    if (!order) throw new UltraSmsApiError('nao_encontrado', 'Commande introuvable.', 404);
    if (order.status === 'received') {
      throw new UltraSmsApiError('codigo_recebido', 'Le code a déjà été reçu.', 409);
    }
    order.status = 'cancelled';
    return this.publicOrder(order);
  }

  async finish(id: string): Promise<UltraSmsOrder> {
    const order = this.orders.get(id);
    if (!order) throw new UltraSmsApiError('nao_encontrado', 'Commande introuvable.', 404);
    order.status = 'finished';
    return this.publicOrder(order);
  }

  async resend(id: string): Promise<UltraSmsOrder> {
    const order = this.orders.get(id);
    if (!order) throw new UltraSmsApiError('nao_encontrado', 'Commande introuvable.', 404);
    const code = hashCode(`${order.id}:${order.codes.length + 1}`);
    const sender = SERVICES.find((item) => item.code === order.service)?.name ?? 'Service';
    const message = `Votre nouveau code ${sender} est : ${code}. Numivo (mode démonstration).`;
    order.code = code;
    order.sms = message;
    order.codes.unshift({ code, text: message, receivedAt: new Date().toISOString() });
    order.status = 'received';
    return this.publicOrder(order);
  }

  async reactivateQuote(
    id: string,
  ): Promise<{ priceCents: number; price: string; currency: string }> {
    const order = this.orders.get(id);
    if (!order) throw new UltraSmsApiError('nao_encontrado', 'Commande introuvable.', 404);
    return {
      priceCents: order.priceCents,
      price: order.price,
      currency: 'USD',
    };
  }

  async reactivate(id: string, maxPriceCents?: number): Promise<UltraSmsOrder> {
    const previous = this.orders.get(id);
    if (!previous) throw new UltraSmsApiError('nao_encontrado', 'Commande introuvable.', 404);
    return this.purchase({
      service: previous.service,
      country: previous.country,
      server: previous.server,
      maxPriceCents,
    });
  }

  /** Réservé au mode développement : force la réception immédiate d'un code. */
  forceReceive(id: string): UltraSmsOrder {
    const order = this.orders.get(id);
    if (!order) throw new UltraSmsApiError('nao_encontrado', 'Commande introuvable.', 404);
    const code = hashCode(`${order.id}:forced`);
    const sender = SERVICES.find((item) => item.code === order.service)?.name ?? 'Service';
    const message = `Votre code de vérification ${sender} est : ${code}. Numivo (mode démonstration).`;
    order.code = code;
    order.sms = message;
    order.codes.unshift({ code, text: message, receivedAt: new Date().toISOString() });
    order.status = 'received';
    return this.publicOrder(order);
  }

  private publicOrder(order: MockOrderInternal): UltraSmsOrder {
    const { createdMs: _createdMs, smsDelayMs: _smsDelayMs, ...rest } = order;
    return { ...rest };
  }
}

export function mockProviderStatus(): UltraSmsOrderStatus[] {
  return ['pending', 'waiting', 'received', 'finished', 'cancelled', 'expired', 'failed'];
}
