import { createHmac, timingSafeEqual } from 'node:crypto';
import { env } from '../../config/env.js';
import { logger } from '../../config/logger.js';
import {
  CreateFedaPayTransactionInput,
  FedaPayApiError,
  FedaPayClient,
  FedaPayToken,
  FedaPayTransaction,
} from './types.js';

const SANDBOX_BASE = 'https://sandbox-api.fedapay.com/v1';
const LIVE_BASE = 'https://api.fedapay.com/v1';

interface RawEnvelope {
  'v1/transaction'?: Record<string, unknown>;
  transaction?: Record<string, unknown>;
  token?: string;
  url?: string;
  payment_url?: string;
  [key: string]: unknown;
}

function normalizeTransaction(raw: Record<string, unknown>): FedaPayTransaction {
  const currency = raw.currency as { iso?: string } | string | undefined;
  const customer = raw.customer as Record<string, unknown> | undefined;
  return {
    id: String(raw.id ?? ''),
    reference: String(raw.reference ?? ''),
    amount: Number(raw.amount ?? 0),
    currency:
      typeof currency === 'string'
        ? currency
        : String(currency?.iso ?? 'XOF'),
    status: String(raw.status ?? 'pending'),
    description: raw.description ? String(raw.description) : undefined,
    customer,
    metadata: raw.metadata,
    createdAt: raw.created_at ? String(raw.created_at) : undefined,
    updatedAt: raw.updated_at ? String(raw.updated_at) : undefined,
  };
}

export class LiveFedaPayClient implements FedaPayClient {
  readonly mode: 'sandbox' | 'live';

  constructor(mode: 'sandbox' | 'live') {
    this.mode = mode;
  }

  private get baseUrl(): string {
    return this.mode === 'live' ? LIVE_BASE : SANDBOX_BASE;
  }

  private async request<T>(path: string, init: RequestInit = {}): Promise<T> {
    if (!env.FEDAPAY_SECRET_KEY) {
      throw new FedaPayApiError('missing_key', 'Clé secrète FedaPay absente.', 500);
    }

    const url = `${this.baseUrl}${path}`;
    let response: Response;
    try {
      response = await fetch(url, {
        ...init,
        headers: {
          Authorization: `Bearer ${env.FEDAPAY_SECRET_KEY}`,
          'Content-Type': 'application/json',
          Accept: 'application/json',
          ...(init.headers ?? {}),
        },
        signal: AbortSignal.timeout(25_000),
      });
    } catch (error) {
      logger.error({ err: error, path }, 'FedaPay : échec réseau');
      throw new FedaPayApiError(
        'network_error',
        'Le service de paiement est momentanément injoignable.',
        503,
      );
    }

    const text = await response.text();
    let body: unknown = null;
    try {
      body = text ? JSON.parse(text) : null;
    } catch {
      body = { message: text.slice(0, 300) };
    }

    if (!response.ok) {
      const payload = (body ?? {}) as {
        message?: string;
        error?: string;
        errors?: unknown;
      };
      const message =
        payload.message ??
        (typeof payload.error === 'string' ? payload.error : undefined) ??
        `Erreur FedaPay (${response.status}).`;
      logger.warn(
        { status: response.status, path, errors: payload.errors },
        'FedaPay : erreur API',
      );
      throw new FedaPayApiError(
        payload.error ?? `http_${response.status}`,
        message,
        response.status,
      );
    }

    return body as T;
  }

  async createTransaction(
    input: CreateFedaPayTransactionInput,
  ): Promise<FedaPayTransaction> {
    if (!Number.isInteger(input.amount) || input.amount <= 0) {
      throw new FedaPayApiError('invalid_amount', 'Montant FedaPay invalide.', 400);
    }

    const body: Record<string, unknown> = {
      description: input.description,
      amount: input.amount,
      currency: { iso: input.currency },
    };
    if (input.callbackUrl) body.callback_url = input.callbackUrl;
    if (input.customer) {
      body.customer = {
        firstname: input.customer.firstname ?? 'Client',
        lastname: input.customer.lastname ?? 'Numivo',
        email: input.customer.email,
        ...(input.customer.phoneNumber
          ? {
              phone_number: {
                number: input.customer.phoneNumber.number,
                country: input.customer.phoneNumber.country.toLowerCase(),
              },
            }
          : {}),
      };
    }

    const raw = await this.request<RawEnvelope>('/transactions', {
      method: 'POST',
      body: JSON.stringify(body),
    });
    const transaction = raw['v1/transaction'] ?? raw.transaction;
    if (!transaction) {
      throw new FedaPayApiError(
        'invalid_response',
        'Réponse FedaPay sans transaction.',
        502,
      );
    }
    return normalizeTransaction(transaction);
  }

  async generateToken(transactionId: string): Promise<FedaPayToken> {
    const raw = await this.request<RawEnvelope>(
      `/transactions/${encodeURIComponent(transactionId)}/token`,
      { method: 'POST', body: JSON.stringify({}) },
    );
    const token = String(raw.token ?? '');
    const url = String(raw.url ?? raw.payment_url ?? '');
    if (!token || !url) {
      throw new FedaPayApiError(
        'invalid_response',
        'Réponse FedaPay sans lien de paiement.',
        502,
      );
    }
    return { token, url };
  }

  async getTransaction(transactionId: string): Promise<FedaPayTransaction> {
    const raw = await this.request<RawEnvelope>(
      `/transactions/${encodeURIComponent(transactionId)}`,
    );
    const transaction = raw['v1/transaction'] ?? raw.transaction;
    if (!transaction) {
      throw new FedaPayApiError(
        'invalid_response',
        'Réponse FedaPay sans transaction.',
        502,
      );
    }
    return normalizeTransaction(transaction);
  }
}

// -----------------------------------------------------------------------------
// Vérification des webhooks FedaPay
// En-tête : X-FEDAPAY-SIGNATURE: t=<timestamp>,s=<signature>
// Signature : HMAC SHA-256 de "<timestamp>.<corps brut>"
// -----------------------------------------------------------------------------
export function verifyFedaPayWebhook(
  rawBody: string,
  header: string | undefined,
  secret: string,
  toleranceSeconds = 300,
): unknown {
  if (!header) {
    throw new FedaPayApiError('missing_signature', 'Signature FedaPay absente.', 401);
  }

  const parts = new Map<string, string>();
  for (const chunk of header.split(',')) {
    const index = chunk.indexOf('=');
    if (index > 0) {
      parts.set(chunk.slice(0, index).trim(), chunk.slice(index + 1).trim());
    }
  }

  const timestamp = Number(parts.get('t'));
  const signature = parts.get('s') ?? parts.get('v1');
  if (!Number.isFinite(timestamp) || !signature) {
    throw new FedaPayApiError('invalid_signature', 'Signature FedaPay malformée.', 401);
  }

  const now = Math.floor(Date.now() / 1000);
  if (Math.abs(now - timestamp) > toleranceSeconds) {
    throw new FedaPayApiError(
      'expired_signature',
      'Signature FedaPay expirée.',
      401,
    );
  }

  const expected = createHmac('sha256', secret)
    .update(`${timestamp}.${rawBody}`)
    .digest('hex');

  const provided = Buffer.from(signature, 'utf8');
  const computed = Buffer.from(expected, 'utf8');
  if (
    provided.length !== computed.length ||
    !timingSafeEqual(provided, computed)
  ) {
    throw new FedaPayApiError(
      'invalid_signature',
      'Signature FedaPay invalide.',
      401,
    );
  }

  try {
    return JSON.parse(rawBody);
  } catch {
    throw new FedaPayApiError('invalid_payload', 'Corps de webhook invalide.', 400);
  }
}
