export type UltraSmsOrderStatus =
  | 'pending'
  | 'waiting'
  | 'received'
  | 'finished'
  | 'cancelled'
  | 'expired'
  | 'failed';

export interface UltraSmsOrder {
  id: string;
  ref?: number;
  service: string;
  country: string;
  server?: number;
  phone: string;
  priceCents: number;
  price: string;
  status: UltraSmsOrderStatus;
  code: string | null;
  sms: string | null;
  codes: Array<{ code: string; text?: string; receivedAt?: string }>;
  createdAt?: string;
  expiresAt?: string;
  cancelAvailableAt?: string;
}

export interface UltraSmsPrice {
  service: string;
  name: string;
  server: number;
  country: string;
  priceCents: number;
  price: string;
  count: number;
}

export interface UltraSmsService {
  code: string;
  name: string;
}

export interface UltraSmsCountry {
  code: string;
  name: string;
  dialCode: string;
}

export interface UltraSmsBalance {
  balanceCents: number;
  balance: string;
  currency: string;
}

export interface UltraSmsPurchaseInput {
  service: string;
  country: string;
  server?: number;
  maxPriceCents?: number;
}

export interface UltraSmsProvider {
  readonly mode: 'mock' | 'live';
  getBalance(): Promise<UltraSmsBalance>;
  getServices(): Promise<UltraSmsService[]>;
  getCountries(): Promise<UltraSmsCountry[]>;
  getPrices(params?: { service?: string; country?: string; server?: number }): Promise<UltraSmsPrice[]>;
  purchase(input: UltraSmsPurchaseInput): Promise<UltraSmsOrder>;
  getOrder(id: string): Promise<UltraSmsOrder>;
  cancel(id: string): Promise<UltraSmsOrder>;
  finish(id: string): Promise<UltraSmsOrder>;
  resend(id: string): Promise<UltraSmsOrder>;
  reactivateQuote(id: string): Promise<{ priceCents: number; price: string; currency: string }>;
  reactivate(id: string, maxPriceCents?: number): Promise<UltraSmsOrder>;
}

export class UltraSmsApiError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly statusCode: number,
  ) {
    super(message);
    this.name = 'UltraSmsApiError';
  }
}
