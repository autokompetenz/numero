export type Currency = 'XOF' | 'EUR' | 'USD';

export type UserRole = 'VISITOR' | 'CLIENT' | 'ADMIN' | 'SUPPORT';

export type UserStatus = 'ACTIVE' | 'SUSPENDED';

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  role: Exclude<UserRole, 'VISITOR'>;
  country: string | null;
  phone?: string | null;
  preferredCurrency: Currency;
  status?: UserStatus;
  createdAt: string;
}

export type NumberType = 'TEMPORARY' | 'RENTAL';

export type PaymentMethod = 'MOBILE_MONEY' | 'CARD' | 'WALLET';

export type PaymentProvider = 'FEDAPAY' | 'KKIAPAY' | 'CARD_GATEWAY' | 'WALLET' | 'MOCK';

export type MobileMoneyOperator = 'MTN' | 'MOOV' | 'CELTIIS';

export type OrderStatus =
  | 'PENDING_PAYMENT'
  | 'PAID'
  | 'PROCESSING'
  | 'COMPLETED'
  | 'CANCELLED'
  | 'REFUNDED'
  | 'FAILED';

export type PaymentStatus = 'PENDING' | 'APPROVED' | 'DECLINED' | 'CANCELED' | 'REFUNDED' | 'FAILED';

export type PaymentPurpose = 'ORDER' | 'TOPUP';

export interface Country {
  code: string;
  name: string;
  flag: string;
  prefix: string;
  popular?: boolean;
}

export interface ServiceItem {
  id: string;
  name: string;
  iconName: string;
  category: 'social' | 'ai' | 'messaging' | 'tech' | 'fintech';
  popular?: boolean;
  providerCode?: string;
}

export interface CatalogItem {
  id: string;
  countryCode: string;
  serviceId: string;
  type: NumberType;
  supplierCostXof: number;
  availableCount: number;
  enabled: boolean;
  /** Prix de vente calculé par le serveur pour la devise demandée. */
  sellingPriceXof: number;
  sellingPriceMinor: number;
  sellingPriceFormatted: string;
  currency: Currency;
  paymentMethod: PaymentMethod;
  paymentFeeXof: number;
  estimatedNetMarginXof: number;
}

export interface CatalogResponse {
  countries: Country[];
  services: ServiceItem[];
  /** Nombre total de services ayant au moins une offre. */
  serviceTotal: number;
  /** Services réellement disponibles pour le pays demandé (ou tous). */
  serviceOptions: ServiceItem[];
  items: CatalogItem[];
  page: number;
  limit: number;
  total: number;
  hasMore: boolean;
  currency: Currency;
  paymentMethod: PaymentMethod;
}

export interface CatalogFilters {
  countryCode?: string;
  serviceId?: string;
  type?: NumberType;
  category?: string;
  search?: string;
}

export interface PricingConfig {
  targetMarginXof: number;
  paymentRateMobileMoney: number;
  paymentRateCard: number;
  paymentRateWallet: number;
  fixedPaymentFeeXof: number;
  fxFeeRate: number;
  roundingStepXof: number;
}

export interface ExchangeRates {
  EUR_XOF: number;
  USD_XOF: number;
  EUR_USD: number;
  source?: string;
  validAt?: string;
}

export interface PriceBreakdown {
  supplierCostXof: number;
  targetMarginXof: number;
  paymentFeeXof: number;
  fxFeeXof: number;
  rawPriceXof: number;
  sellingPriceXof: number;
  estimatedNetMarginXof: number;
  currency: Currency;
  sellingPriceMinor: number;
  sellingPriceFormatted: string;
  sellingPriceInCurrency: number;
  rateApplied: number;
  paymentRate: number;
}

export interface QuoteResponse {
  item: {
    id: string;
    countryCode: string;
    serviceId: string;
    type: NumberType;
  };
  price: PriceBreakdown;
}

export interface SmsMessage {
  id: string;
  orderId: string;
  sender: string;
  messageText: string;
  extractedOtpCode?: string | null;
  receivedAt: string;
}

export interface Payment {
  id: string;
  reference: string;
  purpose: PaymentPurpose;
  provider: PaymentProvider;
  paymentMethod: PaymentMethod;
  status: PaymentStatus;
  amountMinor: number;
  amount: number;
  currency: Currency;
  checkoutUrl: string | null;
  providerTransactionId?: string | null;
  orderId?: string | null;
  orderReference?: string | null;
  paidAt?: string | null;
  failureReason?: string | null;
  createdAt: string;
}

export interface Order {
  id: string;
  reference: string;
  userId: string;
  userEmail?: string;
  countryCode: string;
  countryName: string;
  prefix: string;
  serviceId: string;
  serviceName: string;
  phoneNumber?: string | null;
  type: NumberType;
  currency: Currency;
  supplierCostXof: number;
  exchangeRateUsed: number;
  sellingPriceXof: number;
  sellingPriceCurrency: number;
  paymentFeeXof: number;
  actualMarginXof: number;
  paymentMethod: PaymentMethod;
  paymentProvider: PaymentProvider;
  mobileMoneyOperator?: MobileMoneyOperator | null;
  mobileMoneyPhone?: string | null;
  status: OrderStatus;
  checkoutUrl?: string | null;
  failureReason?: string | null;
  cancellationReason?: string | null;
  createdAt: string;
  paidAt?: string | null;
  expiresAt: string;
  completedAt?: string | null;
  smsMessages: SmsMessage[];
  payment?: Payment | null;
}

export type WalletTransactionType = 'DEPOSIT' | 'PURCHASE' | 'REFUND' | 'ADJUSTMENT';

export interface WalletTransaction {
  id: string;
  reference: string;
  date: string;
  type: WalletTransactionType;
  currency: Currency;
  amount: number;
  amountMinor?: number;
  balanceAfter: number;
  balanceAfterMinor?: number;
  status: 'CONFIRMED' | 'PENDING' | 'CANCELLED';
  description: string;
  paymentMethod?: string;
  idempotencyKey?: string | null;
}

export interface WalletSummary {
  currency: Currency;
  balanceMinor: number;
  balance: number;
  updatedAt: string;
}

export interface UserWallet {
  userId: string;
  balances: Record<Currency, number>;
  transactions: WalletTransaction[];
}

export interface AuditLog {
  id: string;
  timestamp: string;
  actor: string;
  action: string;
  entityType: string;
  entityId: string;
  metadata?: string | null;
  ipAddress?: string | null;
}

export interface UltraSmsProviderConfig {
  apiKey: string;
  apiEndpoint: string;
  isSandbox: boolean;
  connected: boolean;
  balanceXof: number;
  balanceUsd?: number;
  mode?: string;
  lastPing: string;
}

export interface AppConfig {
  pricing: PricingConfig;
  exchangeRates: ExchangeRates;
  payments: {
    mode: 'mock' | 'sandbox' | 'live';
    currencies: Currency[];
    minTopUpXof: number;
    maxTopUpXof: number;
  };
  ultrasms: {
    mode: 'mock' | 'live';
  };
}

export interface AuthResponse {
  user: UserProfile;
  accessToken: string;
}

export interface AdminProviderBalance {
  balanceCents: number;
  balance: string;
  currency: string;
}

export interface AdminStats {
  totals: {
    users: number;
    orders: number;
    completed: number;
    pendingPayment: number;
    processing: number;
    refunds: number;
    revenueXof: number;
    supplierCostXof: number;
    marginXof: number;
  };
  walletLiabilitiesXof: number;
  daily: { day: string; count: number; revenueXof: number }[];
  recentOrders: Order[];
  manualRefunds: {
    id: string;
    orderReference: string | null;
    amountMinor: number;
    currency: Currency;
    reason: string | null;
    createdAt: string;
    provider: PaymentProvider;
  }[];
  provider: {
    name: string;
    mode: string;
    balance: AdminProviderBalance | null;
  };
}

export interface AdminCatalogItem {
  id: string;
  countryCode: string;
  countryName: string;
  prefix: string;
  serviceId: string;
  serviceName: string;
  type: NumberType;
  supplierCostXof: number;
  supplierPriceMinor: number | null;
  supplierCurrency: Currency;
  availableCount: number;
  enabled: boolean;
  lastSyncedAt: string | null;
}

export interface AdminCatalogResponse {
  items: AdminCatalogItem[];
  page: number;
  limit: number;
  total: number;
  hasMore: boolean;
}

export interface AdminUser {
  id: string;
  name: string;
  email: string;
  role: Exclude<UserRole, 'VISITOR'>;
  status: UserStatus;
  country: string | null;
  phone: string | null;
  preferredCurrency: Currency;
  createdAt: string;
  ordersCount: number;
  wallets: { currency: Currency; balanceMinor: number }[];
}

export interface Paginated<T> {
  total: number;
  page: number;
  limit: number;
  users?: T[];
  orders?: T[];
  logs?: T[];
}
