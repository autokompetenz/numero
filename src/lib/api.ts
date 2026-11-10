import {
  AdminCatalogResponse,
  AdminStats,
  AdminUser,
  AppConfig,
  AuditLog,
  AuthResponse,
  CatalogResponse,
  Country,
  Currency,
  NumberType,
  Order,
  Payment,
  PaymentMethod,
  PricingConfig,
  QuoteResponse,
  UserProfile,
  WalletSummary,
  WalletTransaction,
} from '../types';

/**
 * URL de l'API.
 * - Développement : API Express sur le port 4000, front Vite sur 3000.
 * - Production : le front appelle `/api` sur sa propre origine ; Vercel
 *   réécrit `/api/*` vers le projet API (cookie de refresh first-party).
 */
const API_BASE = (() => {
  const configured = (import.meta.env.VITE_API_URL as string | undefined)?.trim();
  if (configured) return configured.replace(/\/+$/, '');
  return import.meta.env.DEV ? 'http://localhost:4000/api' : '/api';
})();

export function getApiBase(): string {
  return API_BASE;
}

/** Racine HTTP de l'API (sans le suffixe /api). */
export function getApiOrigin(): string {
  if (API_BASE.startsWith('http')) return API_BASE.replace(/\/api\/?$/, '');
  return window.location.origin;
}

let accessToken: string | null = null;
let refreshPromise: Promise<boolean> | null = null;
let unauthorizedHandler: (() => void) | null = null;

export function setAccessToken(token: string | null): void {
  accessToken = token;
}

export function getAccessToken(): string | null {
  return accessToken;
}

/** Appelé lorsque la session ne peut plus être rafraîchie. */
export function setUnauthorizedHandler(handler: (() => void) | null): void {
  unauthorizedHandler = handler;
}

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details?: unknown;

  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

interface RequestOptions extends Omit<RequestInit, 'body'> {
  body?: unknown;
  /** Ne pas tenter de rafraîchir la session (routes d'authentification). */
  skipAuth?: boolean;
  /** Ne pas déclencher le handler de session expirée. */
  silent?: boolean;
}

async function parseResponse<T>(response: Response): Promise<T> {
  if (response.status === 204) return undefined as T;
  const contentType = response.headers.get('content-type') ?? '';
  if (!contentType.includes('application/json')) {
    const text = await response.text();
    if (!response.ok) {
      throw new ApiError(response.status, 'HTTP_ERROR', text || 'Erreur réseau.');
    }
    return text as unknown as T;
  }
  const payload = await response.json();
  if (!response.ok) {
    const error = payload?.error ?? {};
    throw new ApiError(
      response.status,
      typeof error.code === 'string' ? error.code : 'HTTP_ERROR',
      typeof error.message === 'string' ? error.message : 'Une erreur est survenue.',
      error.details,
    );
  }
  return payload as T;
}

async function refreshAccessToken(): Promise<boolean> {
  if (!refreshPromise) {
    refreshPromise = (async () => {
      try {
        const response = await fetch(`${API_BASE}/auth/refresh`, {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
        });
        if (!response.ok) {
          setAccessToken(null);
          return false;
        }
        const data = (await response.json()) as AuthResponse;
        setAccessToken(data.accessToken);
        return true;
      } catch {
        setAccessToken(null);
        return false;
      } finally {
        refreshPromise = null;
      }
    })();
  }
  return refreshPromise;
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { body, skipAuth = false, silent = false, headers, ...rest } = options;

  const send = async (): Promise<Response> => {
    const nextHeaders = new Headers(headers);
    if (body !== undefined && !(body instanceof FormData)) {
      nextHeaders.set('Content-Type', 'application/json');
    }
    if (accessToken) nextHeaders.set('Authorization', `Bearer ${accessToken}`);

    return fetch(`${API_BASE}${path}`, {
      ...rest,
      credentials: 'include',
      headers: nextHeaders,
      body:
        body === undefined
          ? undefined
          : body instanceof FormData
            ? body
            : JSON.stringify(body),
    });
  };

  let response = await send();

  if (response.status === 401 && !skipAuth) {
    const refreshed = await refreshAccessToken();
    if (refreshed) {
      response = await send();
    } else if (!silent) {
      accessToken = null;
      unauthorizedHandler?.();
    }
  }

  return parseResponse<T>(response);
}

/* -------------------------------------------------------------------------- */
/* Authentification                                                           */
/* -------------------------------------------------------------------------- */

export const authApi = {
  login: (email: string, password: string) =>
    request<AuthResponse>('/auth/login', {
      method: 'POST',
      body: { email, password },
      skipAuth: true,
    }),

  register: (data: {
    name: string;
    email: string;
    password: string;
    country?: string;
    phone?: string;
    preferredCurrency?: Currency;
  }) =>
    request<AuthResponse>('/auth/register', {
      method: 'POST',
      body: data,
      skipAuth: true,
    }),

  refresh: () =>
    request<AuthResponse>('/auth/refresh', {
      method: 'POST',
      skipAuth: true,
      silent: true,
    }),

  me: () => request<{ user: UserProfile }>('/auth/me'),

  logout: () =>
    request<void>('/auth/logout', {
      method: 'POST',
      skipAuth: true,
      silent: true,
    }),
};

/* -------------------------------------------------------------------------- */
/* Catalogue                                                                  */
/* -------------------------------------------------------------------------- */

export const catalogApi = {
  config: () => request<AppConfig>('/catalog/config'),

  countries: async () => {
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 10_000);
    try {
      return await request<{ countries: Country[] }>('/catalog/countries', {
        signal: controller.signal,
      });
    } catch (error) {
      if (controller.signal.aborted) {
        throw new Error('Le serveur ne répond pas au chargement des pays.');
      }
      throw error;
    } finally {
      window.clearTimeout(timeout);
    }
  },

  list: (params: {
    currency: Currency;
    paymentMethod?: PaymentMethod;
    countryCode?: string;
    serviceId?: string;
    type?: NumberType;
    category?: string;
    search?: string;
    page?: number;
    limit?: number;
  }) => {
    const search = new URLSearchParams({
      currency: params.currency,
      paymentMethod: params.paymentMethod ?? 'MOBILE_MONEY',
    });
    if (params.countryCode) search.set('country', params.countryCode);
    if (params.serviceId) search.set('service', params.serviceId);
    if (params.type) search.set('type', params.type);
    if (params.category && params.category !== 'all') search.set('category', params.category);
    if (params.search) search.set('search', params.search);
    if (params.page) search.set('page', String(params.page));
    if (params.limit) search.set('limit', String(params.limit));
    return request<CatalogResponse>(`/catalog?${search.toString()}`);
  },

  quote: (itemId: string, currency: Currency, paymentMethod: PaymentMethod) => {
    const search = new URLSearchParams({ itemId, currency, paymentMethod });
    return request<QuoteResponse>(`/catalog/quote?${search.toString()}`);
  },
};

/* -------------------------------------------------------------------------- */
/* Portefeuille                                                               */
/* -------------------------------------------------------------------------- */

export const walletApi = {
  list: () => request<{ wallets: WalletSummary[] }>('/wallet'),

  transactions: (currency: Currency) =>
    request<{ currency: Currency; transactions: WalletTransaction[] }>(
      `/wallet/transactions?currency=${currency}`,
    ),

  topUp: (amountXof: number, paymentMethod: 'MOBILE_MONEY' | 'CARD' = 'MOBILE_MONEY') =>
    request<{ payment: Payment; checkoutUrl: string }>('/wallet/topups', {
      method: 'POST',
      body: { amountMinor: Math.round(amountXof), paymentMethod },
    }),

  payment: (paymentId: string) =>
    request<{ payment: Payment }>(`/wallet/payments/${paymentId}`),
};

/* -------------------------------------------------------------------------- */
/* Commandes                                                                  */
/* -------------------------------------------------------------------------- */

export const ordersApi = {
  list: () => request<{ orders: Order[] }>('/orders'),

  create: (data: {
    catalogItemId: string;
    paymentMethod: PaymentMethod;
    currency: Currency;
    mobileMoneyOperator?: string;
    mobileMoneyPhone?: string;
    idempotencyKey?: string;
  }) =>
    request<{
      order: Order;
      checkoutUrl?: string | null;
      idempotent?: boolean;
      payment?: Payment;
      price?: QuoteResponse['price'];
    }>('/orders', { method: 'POST', body: data }),

  get: (orderId: string) => request<{ order: Order }>(`/orders/${orderId}`),

  verifyPayment: (orderId: string) =>
    request<{ payment: Payment; order: Order }>(`/orders/${orderId}/verify-payment`, {
      method: 'POST',
    }),

  refresh: (orderId: string) =>
    request<{ order: Order }>(`/orders/${orderId}/refresh`, { method: 'POST' }),

  cancel: (orderId: string) =>
    request<{ order: Order }>(`/orders/${orderId}/cancel`, { method: 'POST' }),

  resendSms: (orderId: string) =>
    request<{ order: Order }>(`/orders/${orderId}/resend`, { method: 'POST' }),
};

/* -------------------------------------------------------------------------- */
/* Paiements                                                                  */
/* -------------------------------------------------------------------------- */

export const paymentsApi = {
  byReference: (reference: string) =>
    request<{ payment: Payment; orderId: string | null; orderStatus: string | null }>(
      `/payments/by-reference/${encodeURIComponent(reference)}`,
    ),

  verify: (paymentId: string) =>
    request<{ payment: Payment }>(`/payments/${paymentId}/verify`, { method: 'POST' }),
};

/* -------------------------------------------------------------------------- */
/* Administration                                                             */
/* -------------------------------------------------------------------------- */

export const adminApi = {
  stats: () => request<AdminStats>('/admin/stats'),

  orders: (params: { page?: number; limit?: number; status?: string; search?: string } = {}) => {
    const search = new URLSearchParams();
    if (params.page) search.set('page', String(params.page));
    if (params.limit) search.set('limit', String(params.limit));
    if (params.status) search.set('status', params.status);
    if (params.search) search.set('search', params.search);
    return request<{ orders: Order[]; total: number; page: number; limit: number }>(
      `/admin/orders?${search.toString()}`,
    );
  },

  users: (page = 1, limit = 50) =>
    request<{ users: AdminUser[]; total: number; page: number; limit: number }>(
      `/admin/users?page=${page}&limit=${limit}`,
    ),

  catalog: (params?: {
    page?: number;
    limit?: number;
    search?: string;
    countryCode?: string;
    serviceId?: string;
    type?: NumberType;
  }) => {
    const search = new URLSearchParams();
    if (params?.page) search.set('page', String(params.page));
    if (params?.limit) search.set('limit', String(params.limit));
    if (params?.search) search.set('search', params.search);
    if (params?.countryCode) search.set('country', params.countryCode);
    if (params?.serviceId) search.set('service', params.serviceId);
    if (params?.type) search.set('type', params.type);
    const suffix = search.toString();
    return request<AdminCatalogResponse>(`/admin/catalog${suffix ? `?${suffix}` : ''}`);
  },

  updateCatalog: (
    id: string,
    patch: { enabled?: boolean; availableCount?: number; supplierCostXofMinor?: number },
  ) =>
    request<{ ok: boolean }>(`/admin/catalog/${id}`, { method: 'PATCH', body: patch }),

  syncCatalog: () => request<Record<string, unknown>>('/admin/catalog/sync', { method: 'POST' }),

  pricing: () => request<{ pricing: PricingConfig }>('/admin/pricing'),

  updatePricing: (patch: Partial<PricingConfig>) =>
    request<{ pricing: PricingConfig }>('/admin/pricing', { method: 'PATCH', body: patch }),

  rates: () => request<{ rates: AppConfig['exchangeRates'] }>('/admin/rates'),

  audit: (page = 1, limit = 50) =>
    request<{ logs: AuditLog[]; total: number; page: number; limit: number }>(
      `/admin/audit?page=${page}&limit=${limit}`,
    ),

  refundOrder: (orderId: string, reason?: string) =>
    request<{ refund: unknown }>(`/admin/orders/${orderId}/refund`, {
      method: 'POST',
      body: reason ? { reason } : {},
    }),

  syncOrder: (orderId: string) =>
    request<{ order: Order | null }>(`/admin/orders/${orderId}/sync`, { method: 'POST' }),

  providerBalance: () =>
    request<{ provider: string; mode: string; balance: { balanceCents: number; balance: string; currency: string } }>(
      '/admin/provider/balance',
    ),

  updateUser: (id: string, patch: { role?: string; status?: string }) =>
    request<{ user: AdminUser }>(`/admin/users/${id}`, { method: 'PATCH', body: patch }),

  resetUserPassword: (id: string) =>
    request<{ user: { id: string; email: string }; temporaryPassword: string; message: string }>(
      `/admin/users/${id}/reset-password`,
      { method: 'POST' },
    ),
};

/* -------------------------------------------------------------------------- */
/* Outils de développement (mock uniquement, jamais exposés en production)     */
/* -------------------------------------------------------------------------- */

export const devApi = {
  simulateSms: (orderId: string) =>
    request<{ ok: boolean }>(`/dev/orders/${orderId}/sms`, { method: 'POST' }),

  syncOrder: (orderId: string) =>
    request<{ ok: boolean }>(`/dev/orders/${orderId}/sync`, { method: 'POST' }),

  approvePayment: (paymentId: string) =>
    request<{ ok: boolean }>(`/dev/payments/${paymentId}/approve`, { method: 'POST' }),

  declinePayment: (paymentId: string) =>
    request<{ ok: boolean }>(`/dev/payments/${paymentId}/decline`, { method: 'POST' }),
};

/**
 * Les pages de checkout simulées sont servies par l'API.
 * En mode mock, FedaPay renvoie `?mock_payment=<transactionId>` ; on le
 * transforme en URL directe vers la page de test de l'API.
 */
export function resolveCheckoutUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    const parsed = new URL(url, window.location.origin);
    const mockTransactionId = parsed.searchParams.get('mock_payment');
    if (mockTransactionId) {
      return `${getApiOrigin()}/api/dev/checkout/${encodeURIComponent(mockTransactionId)}`;
    }
    return url;
  } catch {
    return url;
  }
}

export { API_BASE };
