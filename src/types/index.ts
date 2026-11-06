/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type UserRole = 'VISITOR' | 'CLIENT' | 'ADMIN' | 'SUPPORT';

export type Currency = 'XOF' | 'EUR' | 'USD';

export type PaymentMethod = 'MOBILE_MONEY' | 'CARD' | 'WALLET';

export type MobileMoneyOperator = 'MTN' | 'MOOV' | 'CELTIIS' | 'ORANGE' | 'WAVE';

export type PaymentGateway = 'FEDAPAY' | 'KKIAPAY' | 'INTERNAL';

export type OrderStatus =
  | 'PENDING_PAYMENT'
  | 'PAID'
  | 'PROCESSING'
  | 'COMPLETED'
  | 'CANCELLED'
  | 'REFUNDED';

export type WalletTransactionType =
  | 'DEPOSIT'
  | 'PURCHASE'
  | 'REFUND'
  | 'ADMIN_ADJUSTMENT';

export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  phone?: string;
  preferredCurrency: Currency;
  createdAt: string;
}

export interface PricingConfig {
  targetMarginXof: number; // e.g. 2000 XOF
  paymentRateMomo: number; // e.g. 0.025 (2.5%)
  paymentRateCard: number; // e.g. 0.036 (3.6%)
  fixedPaymentFeeXof: number; // e.g. 0
  fxFeeXof: number; // e.g. 0
  roundingStepXof: number; // e.g. 100
}

export interface ExchangeRates {
  EUR_TO_XOF: number; // ~655.957
  USD_TO_XOF: number; // ~610.00
  XOF_TO_EUR: number;
  XOF_TO_USD: number;
}

export interface PriceCalculationResult {
  supplierCostXof: number;
  targetMarginXof: number;
  paymentRate: number;
  fixedPaymentFeeXof: number;
  fxFeeXof: number;
  rawPriceXof: number;
  sellingPriceXof: number;
  estimatedPaymentFeeXof: number;
  estimatedNetMarginXof: number;
  // Converted to target currency
  displayCurrency: Currency;
  displayPrice: number;
  displayFormatted: string;
  exchangeRateUsed: number;
}

export interface Country {
  code: string; // ISO 2 (e.g. 'BJ', 'CI', 'FR', 'US')
  name: string;
  flag: string;
  dialCode: string;
  availableServicesCount: number;
  supportedOperators: MobileMoneyOperator[];
  isPopular?: boolean;
}

export interface ServiceItem {
  id: string;
  name: string;
  category: 'social' | 'messaging' | 'ai' | 'finance' | 'transport' | 'entertainment' | 'other';
  icon: string; // Icon identifier or name
  baseSupplierCostXof: number; // Base cost from Ultra SMS
  description: string;
  successRate: number; // e.g. 98%
  isHot?: boolean;
}

export interface SMSMessage {
  id: string;
  orderId: string;
  sender: string;
  text: string;
  extractedCode?: string;
  receivedAt: string;
}

export interface Order {
  id: string;
  orderNumber: string;
  userId: string;
  userName: string;
  userEmail: string;
  countryCode: string;
  countryName: string;
  serviceId: string;
  serviceName: string;
  phoneNumber?: string;
  currency: Currency;
  // Financial breakdown
  supplierCostXof: number;
  supplierCostMinor: number;
  supplierCostCurrency: string;
  exchangeRate: number;
  sellingPriceXof: number;
  sellingPriceMinor: number;
  paymentMethod: PaymentMethod;
  paymentOperator?: MobileMoneyOperator;
  paymentFeeXof: number;
  targetMarginXof: number;
  actualMarginXof: number;
  status: OrderStatus;
  provider: 'NUM_FAST' | 'ULTRA_SMS';
  providerOrderId?: string;
  createdAt: string;
  expiresAt: string;
  completedAt?: string;
  smsMessages: SMSMessage[];
  idempotencyKey: string;
}

export interface Wallet {
  id: string;
  userId: string;
  currency: Currency;
  balanceMinor: number; // In minor units (XOF has 0 decimals, EUR/USD have 2 decimals)
  updatedAt: string;
}

export interface WalletTransaction {
  id: string;
  walletId: string;
  userId: string;
  type: WalletTransactionType;
  amountMinor: number;
  currency: Currency;
  status: 'COMPLETED' | 'PENDING' | 'REJECTED';
  reference: string;
  description: string;
  idempotencyKey: string;
  createdAt: string;
}

export interface AuditLog {
  id: string;
  actorId: string;
  actorName: string;
  actorRole: UserRole;
  action: string;
  entityType: 'ORDER' | 'PRICING' | 'WALLET' | 'CATALOG' | 'PROVIDER' | 'REFUND';
  entityId: string;
  metadata: Record<string, any>;
  ipAddress?: string;
  createdAt: string;
}

export interface ProviderSetting {
  id: string;
  name: string;
  type: 'SMS' | 'PAYMENT';
  status: 'ACTIVE' | 'TEST' | 'INACTIVE';
  apiKeyMasked: string;
  endpointUrl: string;
  balance?: string;
  lastChecked: string;
}
