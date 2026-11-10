import { env } from '../../config/env.js';
import { logger } from '../../config/logger.js';
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

interface RawOrder {
  id: string;
  ref?: number;
  service?: string;
  country?: string;
  server?: number;
  phone?: string;
  price_cents?: number;
  price?: string;
  status?: string;
  code?: string | null;
  sms?: string | null;
  codes?: Array<{ code?: string; text?: string; received_at?: string }>;
  created_at?: string;
  expires_at?: string;
  cancel_available_at?: string;
}

const STATUSES = new Set<UltraSmsOrderStatus>([
  'pending',
  'waiting',
  'received',
  'finished',
  'cancelled',
  'expired',
  'failed',
]);

function normalizeStatus(value: unknown): UltraSmsOrderStatus {
  const status = String(value ?? 'pending') as UltraSmsOrderStatus;
  return STATUSES.has(status) ? status : 'pending';
}

function mapOrder(raw: RawOrder): UltraSmsOrder {
  return {
    id: String(raw.id),
    ref: raw.ref,
    service: raw.service ?? '',
    country: raw.country ?? '',
    server: raw.server,
    phone: raw.phone ?? '',
    priceCents: Number(raw.price_cents ?? 0),
    price: String(raw.price ?? '0'),
    status: normalizeStatus(raw.status),
    code: raw.code ?? null,
    sms: raw.sms ?? null,
    codes: (raw.codes ?? [])
      .filter((item) => item && item.code)
      .map((item) => ({
        code: String(item.code),
        text: item.text,
        receivedAt: item.received_at,
      })),
    createdAt: raw.created_at,
    expiresAt: raw.expires_at,
    cancelAvailableAt: raw.cancel_available_at,
  };
}

export class LiveUltraSmsProvider implements UltraSmsProvider {
  readonly mode = 'live' as const;

  private async request<T>(
    path: string,
    init: RequestInit = {},
  ): Promise<T> {
    const url = `${env.ULTRASMS_BASE_URL.replace(/\/$/, '')}${path}`;
    let response: Response;
    try {
      response = await fetch(url, {
        ...init,
        headers: {
          Authorization: `Bearer ${env.ULTRASMS_API_KEY}`,
          'Content-Type': 'application/json',
          Accept: 'application/json',
          ...(init.headers ?? {}),
        },
        signal: AbortSignal.timeout(20_000),
      });
    } catch (error) {
      logger.error({ err: error, path }, 'Ultra SMS : échec réseau');
      throw new UltraSmsApiError('indisponivel', 'Fournisseur Ultra SMS injoignable.', 503);
    }

    const text = await response.text();
    let body: unknown = null;
    try {
      body = text ? JSON.parse(text) : null;
    } catch {
      body = { error: 'reponse_invalide', message: text.slice(0, 300) };
    }

    if (!response.ok) {
      const payload = (body ?? {}) as { error?: string; message?: string };
      const code = payload.error ?? `http_${response.status}`;
      const message = payload.message ?? `Erreur Ultra SMS (${response.status}).`;
      logger.warn({ code, status: response.status, path }, 'Ultra SMS : erreur API');
      throw new UltraSmsApiError(code, message, response.status);
    }

    return body as T;
  }

  async getBalance(): Promise<UltraSmsBalance> {
    const raw = await this.request<{
      balance_cents?: number;
      balance?: string;
      currency?: string;
    }>('/balance');
    return {
      balanceCents: Number(raw.balance_cents ?? 0),
      balance: String(raw.balance ?? '0.00'),
      currency: String(raw.currency ?? 'USD'),
    };
  }

  async getServices(): Promise<UltraSmsService[]> {
    const raw = await this.request<{ services?: Array<{ code?: string; name?: string }> }>('/services');
    return (raw.services ?? [])
      .filter((item) => item.code && item.name)
      .map((item) => ({ code: String(item.code), name: String(item.name) }));
  }

  async getCountries(): Promise<UltraSmsCountry[]> {
    const raw = await this.request<{
      countries?: Array<{ code?: string; name?: string; dial_code?: string }>;
    }>('/countries');
    return (raw.countries ?? [])
      .filter((item) => item.code && item.name)
      .map((item) => ({
        code: String(item.code).toUpperCase(),
        name: String(item.name),
        dialCode: String(item.dial_code ?? ''),
      }));
  }

  async getPrices(params?: {
    service?: string;
    country?: string;
    server?: number;
  }): Promise<UltraSmsPrice[]> {
    const query = new URLSearchParams();
    if (params?.service) query.set('service', params.service);
    if (params?.country) query.set('country', params.country);
    if (params?.server) query.set('server', String(params.server));
    const suffix = query.toString() ? `?${query.toString()}` : '';

    const raw = await this.request<{
      currency?: string;
      prices?: Array<{
        service?: string;
        name?: string;
        server?: number;
        country?: string;
        price_cents?: number;
        price?: string;
        count?: number;
      }>;
    }>(`/prices${suffix}`);

    return (raw.prices ?? []).map((item) => ({
      service: String(item.service ?? ''),
      name: String(item.name ?? ''),
      server: Number(item.server ?? 0),
      country: String(item.country ?? params?.country ?? '').toUpperCase(),
      priceCents: Number(item.price_cents ?? 0),
      price: String(item.price ?? '0'),
      count: Number(item.count ?? 0),
    }));
  }

  async purchase(input: UltraSmsPurchaseInput): Promise<UltraSmsOrder> {
    const raw = await this.request<{ order?: RawOrder }>('/orders', {
      method: 'POST',
      body: JSON.stringify({
        service: input.service,
        country: input.country,
        ...(input.server ? { server: input.server } : {}),
        ...(input.maxPriceCents !== undefined ? { max_price_cents: input.maxPriceCents } : {}),
      }),
    });
    if (!raw.order) {
      throw new UltraSmsApiError('reponse_invalide', 'Réponse Ultra SMS sans commande.', 502);
    }
    return mapOrder(raw.order);
  }

  async getOrder(id: string): Promise<UltraSmsOrder> {
    const raw = await this.request<{ order?: RawOrder }>(`/orders/${encodeURIComponent(id)}`);
    if (!raw.order) {
      throw new UltraSmsApiError('reponse_invalide', 'Réponse Ultra SMS sans commande.', 502);
    }
    return mapOrder(raw.order);
  }

  async cancel(id: string): Promise<UltraSmsOrder> {
    const raw = await this.request<{ order?: RawOrder }>(
      `/orders/${encodeURIComponent(id)}/cancel`,
      { method: 'POST' },
    );
    if (!raw.order) throw new UltraSmsApiError('reponse_invalide', 'Réponse Ultra SMS invalide.', 502);
    return mapOrder(raw.order);
  }

  async finish(id: string): Promise<UltraSmsOrder> {
    const raw = await this.request<{ order?: RawOrder }>(
      `/orders/${encodeURIComponent(id)}/finish`,
      { method: 'POST' },
    );
    if (!raw.order) throw new UltraSmsApiError('reponse_invalide', 'Réponse Ultra SMS invalide.', 502);
    return mapOrder(raw.order);
  }

  async resend(id: string): Promise<UltraSmsOrder> {
    const raw = await this.request<{ order?: RawOrder }>(
      `/orders/${encodeURIComponent(id)}/resend`,
      { method: 'POST' },
    );
    if (!raw.order) throw new UltraSmsApiError('reponse_invalide', 'Réponse Ultra SMS invalide.', 502);
    return mapOrder(raw.order);
  }

  async reactivateQuote(
    id: string,
  ): Promise<{ priceCents: number; price: string; currency: string }> {
    const raw = await this.request<{
      price_cents?: number;
      price?: string;
      currency?: string;
    }>(`/orders/${encodeURIComponent(id)}/reactivate`);
    return {
      priceCents: Number(raw.price_cents ?? 0),
      price: String(raw.price ?? '0'),
      currency: String(raw.currency ?? 'USD'),
    };
  }

  async reactivate(id: string, maxPriceCents?: number): Promise<UltraSmsOrder> {
    const raw = await this.request<{ order?: RawOrder }>(
      `/orders/${encodeURIComponent(id)}/reactivate`,
      {
        method: 'POST',
        body: JSON.stringify(
          maxPriceCents !== undefined ? { max_price_cents: maxPriceCents } : {},
        ),
      },
    );
    if (!raw.order) throw new UltraSmsApiError('reponse_invalide', 'Réponse Ultra SMS invalide.', 502);
    return mapOrder(raw.order);
  }
}
