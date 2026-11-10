import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import {
  AdminCatalogItem,
  AdminStats,
  AdminUser,
  AppConfig,
  AuditLog,
  CatalogFilters,
  CatalogItem,
  Country,
  Currency,
  ExchangeRates,
  MobileMoneyOperator,
  NumberType,
  Order,
  Payment,
  PaymentMethod,
  PriceBreakdown,
  PricingConfig,
  ServiceItem,
  UltraSmsProviderConfig,
  UserProfile,
  UserRole,
  UserWallet,
  WalletTransaction,
} from '../types';
import {
  adminApi,
  authApi,
  catalogApi,
  devApi,
  ordersApi,
  paymentsApi,
  resolveCheckoutUrl,
  setAccessToken,
  setUnauthorizedHandler,
  walletApi,
} from '../lib/api';
import {
  DEFAULT_EXCHANGE_RATES,
  DEFAULT_PRICING_CONFIG,
} from '../utils/pricing';
import { countryDisplayFlag, countryDisplayName } from '../utils/country';

type CreateOrderParams = {
  catalogItemId?: string;
  countryCode?: string;
  serviceId?: string;
  type?: NumberType;
  paymentMethod: PaymentMethod;
  currency?: Currency;
  mobileMoneyOperator?: MobileMoneyOperator;
  mobileMoneyPhone?: string;
  idempotencyKey?: string;
};

type ActionResult<T = undefined> =
  | ({ success: true; error?: undefined } & (T extends undefined ? unknown : T))
  | { success: false; error: string };

interface AppContextType {
  // Session & préférences
  role: UserRole;
  currentUser: UserProfile | null;
  isAuthenticated: boolean;
  sessionLoading: boolean;
  currency: Currency;
  setCurrency: (currency: Currency) => void;
  theme: 'dark' | 'light';
  toggleTheme: () => void;

  // Référentiels & configuration
  profile: UserProfile | null;
  appConfig: AppConfig | null;
  catalog: CatalogItem[];
  countries: Country[];
  countriesLoading: boolean;
  countriesError: string | null;
  refreshCountries: () => Promise<void>;
  services: ServiceItem[];
  catalogLoading: boolean;
  catalogLoadingMore: boolean;
  catalogFilters: CatalogFilters;
  catalogTotal: number;
  catalogHasMore: boolean;
  catalogServiceTotal: number;
  setCatalogFilters: (patch: Partial<CatalogFilters>) => void;
  loadMoreCatalog: () => Promise<void>;
  getServicesForCountry: (countryCode: string) => Promise<ServiceItem[]>;
  resolveCatalogItem: (params: {
    countryCode: string;
    serviceId: string;
    type?: NumberType;
  }) => Promise<CatalogItem | null>;
  pricingConfig: PricingConfig;
  exchangeRates: ExchangeRates;
  providerConfig: UltraSmsProviderConfig;

  // Données client
  orders: Order[];
  wallet: UserWallet;
  auditLogs: AuditLog[];

  // Données admin
  adminStats: AdminStats | null;
  adminOrders: Order[];
  adminUsers: AdminUser[];
  adminCatalog: AdminCatalogItem[];
  adminCatalogTotal: number;
  adminCatalogHasMore: boolean;
  adminCatalogLoadingMore: boolean;
  adminCatalogSearch: string;
  loadMoreAdminCatalog: () => Promise<void>;
  searchAdminCatalog: (term: string) => Promise<void>;
  adminAudit: AuditLog[];
  adminLoading: boolean;

  // Actions client
  quote: (
    itemId: string,
    paymentMethod: PaymentMethod,
    currencyOverride?: Currency,
  ) => Promise<PriceBreakdown>;
  createOrder: (params: CreateOrderParams) => Promise<
    ActionResult<{
      order?: Order;
      checkoutUrl?: string | null;
      payment?: Payment;
    }>
  >;
  verifyOrderPayment: (orderId: string) => Promise<
    ActionResult<{ order?: Order; payment?: Payment }>
  >;
  refreshOrder: (orderId: string) => Promise<Order | null>;
  cancelAndRefundOrder: (orderId: string, reason?: string) => Promise<boolean>;
  simulateSmsReception: (orderId: string) => Promise<boolean>;
  resendSms: (orderId: string) => Promise<boolean>;
  refreshOrders: () => Promise<void>;
  refreshWallet: () => Promise<void>;
  startTopUp: (
    amountXof: number,
    paymentMethod: 'MOBILE_MONEY' | 'CARD',
  ) => Promise<ActionResult<{ payment?: Payment; checkoutUrl?: string }>>;
  verifyTopUpPayment: (paymentId: string) => Promise<Payment | null>;
  verifyPaymentByReference: (reference: string) => Promise<
    ActionResult<{
      payment?: Payment;
      orderId?: string | null;
      orderStatus?: string | null;
    }>
  >;

  // Authentification
  login: (
    email: string,
    password: string,
  ) => Promise<{ success: boolean; user?: UserProfile; error?: string }>;
  register: (data: {
    name: string;
    email: string;
    password: string;
    country?: string;
    phone?: string;
    preferredCurrency?: Currency;
  }) => Promise<{ success: boolean; user?: UserProfile; error?: string }>;
  logout: () => Promise<void>;

  // Actions admin
  loadAdminData: () => Promise<void>;
  updatePricingConfig: (patch: Partial<PricingConfig>) => Promise<ActionResult>;
  updateCatalogItem: (
    id: string,
    patch: { enabled?: boolean; availableCount?: number; supplierCostXofMinor?: number },
  ) => Promise<ActionResult>;
  syncCatalog: () => Promise<ActionResult>;
  refundOrder: (orderId: string, reason?: string) => Promise<ActionResult>;
  syncOrder: (orderId: string) => Promise<ActionResult>;
  updateUser: (
    id: string,
    patch: { role?: string; status?: string },
  ) => Promise<ActionResult>;
  resetUserPassword: (
    id: string,
  ) => Promise<{ success: boolean; temporaryPassword?: string; email?: string; error?: string }>;
  refreshProviderBalance: () => Promise<void>;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

const SUPPORTED_CURRENCIES: Currency[] = ['XOF', 'EUR', 'USD'];

const EMPTY_BALANCES: Record<Currency, number> = { XOF: 0, EUR: 0, USD: 0 };

export function resolveCheckoutRedirect(url: string | null | undefined): string | null {
  return resolveCheckoutUrl(url);
}

function toErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message) return error.message;
  return 'Une erreur est survenue. Veuillez réessayer.';
}

/** Remplace le nom de pays fournisseur par son libellé français. */
function localizeOrder(order: Order): Order {
  return {
    ...order,
    countryName: countryDisplayName(order.countryCode, order.countryName),
  };
}

function currencyFromStorage(): Currency {
  const stored = localStorage.getItem('numivo_currency');
  return stored === 'EUR' || stored === 'USD' || stored === 'XOF' ? stored : 'XOF';
}

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    return (localStorage.getItem('numivo_theme') as 'dark' | 'light') || 'dark';
  });

  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'dark') root.classList.add('dark');
    else root.classList.remove('dark');
    localStorage.setItem('numivo_theme', theme);
  }, [theme]);

  const toggleTheme = () =>
    setTheme((previous) => (previous === 'dark' ? 'light' : 'dark'));

  const [currency, setCurrencyState] = useState<Currency>(currencyFromStorage);
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const [sessionLoading, setSessionLoading] = useState(true);

  const [appConfig, setAppConfig] = useState<AppConfig | null>(null);
  const [catalog, setCatalog] = useState<CatalogItem[]>([]);
  const [countries, setCountries] = useState<Country[]>([]);
  const [countriesLoading, setCountriesLoading] = useState(true);
  const [countriesError, setCountriesError] = useState<string | null>(null);
  const [services, setServices] = useState<ServiceItem[]>([]);
  const [catalogLoading, setCatalogLoading] = useState(true);
  const [catalogLoadingMore, setCatalogLoadingMore] = useState(false);
  const [catalogFilters, setCatalogFiltersState] = useState<CatalogFilters>({
    type: 'TEMPORARY',
  });
  const [catalogPage, setCatalogPage] = useState(1);
  const [catalogTotal, setCatalogTotal] = useState(0);
  const [catalogHasMore, setCatalogHasMore] = useState(false);
  const [catalogServiceTotal, setCatalogServiceTotal] = useState(0);

  const [orders, setOrders] = useState<Order[]>([]);
  const [balances, setBalances] = useState<Record<Currency, number>>(EMPTY_BALANCES);
  const [transactions, setTransactions] = useState<WalletTransaction[]>([]);

  const [adminStats, setAdminStats] = useState<AdminStats | null>(null);
  const [adminOrders, setAdminOrders] = useState<Order[]>([]);
  const [adminUsers, setAdminUsers] = useState<AdminUser[]>([]);
  const [adminCatalog, setAdminCatalog] = useState<AdminCatalogItem[]>([]);
  const [adminCatalogTotal, setAdminCatalogTotal] = useState(0);
  const [adminCatalogHasMore, setAdminCatalogHasMore] = useState(false);
  const [adminCatalogLoadingMore, setAdminCatalogLoadingMore] = useState(false);
  const [adminCatalogSearch, setAdminCatalogSearch] = useState('');
  const [adminCatalogPage, setAdminCatalogPage] = useState(1);
  const [adminAudit, setAdminAudit] = useState<AuditLog[]>([]);
  const [adminProvider, setAdminProvider] =
    useState<Awaited<ReturnType<typeof adminApi.providerBalance>> | null>(null);
  const [adminLoading, setAdminLoading] = useState(false);

  const role: UserRole = currentUser
    ? currentUser.role === 'ADMIN'
      ? 'ADMIN'
      : 'CLIENT'
    : 'VISITOR';

  const setCurrency = (next: Currency) => {
    setCurrencyState(next);
    localStorage.setItem('numivo_currency', next);
  };

  const refreshConfig = useCallback(async () => {
    try {
      const config = await catalogApi.config();
      setAppConfig(config);
    } catch {
      // La configuration de repli reste disponible pour l'affichage.
    }
  }, []);

  const refreshCountries = useCallback(async () => {
    setCountriesLoading(true);
    setCountriesError(null);
    try {
      const data = await catalogApi.countries();
      setCountries(
        data.countries.map((country) => ({
          ...country,
          name: countryDisplayName(country.code, country.name),
          flag: countryDisplayFlag(country.code, country.flag),
        })),
      );
    } catch (error) {
      setCountries([]);
      setCountriesError(toErrorMessage(error));
    } finally {
      setCountriesLoading(false);
    }
  }, []);

  const refreshCatalog = useCallback(async () => {
    setCatalogLoading(true);
    try {
      const data = await catalogApi.list({
        currency,
        paymentMethod: 'MOBILE_MONEY',
        ...catalogFilters,
        page: 1,
        limit: 24,
      });
      setCatalog(data.items);
      setServices(data.services);
      setCatalogPage(1);
      setCatalogTotal(data.total);
      setCatalogHasMore(data.hasMore);
      setCatalogServiceTotal(data.serviceTotal);
    } catch {
      setCatalog([]);
      setCatalogTotal(0);
      setCatalogHasMore(false);
    } finally {
      setCatalogLoading(false);
    }
  }, [currency, catalogFilters]);

  const setCatalogFilters = useCallback((patch: Partial<CatalogFilters>) => {
    setCatalogFiltersState((previous) => {
      const next: CatalogFilters = { ...previous, ...patch };
      // Un nouveau pays invalide le service sélectionné.
      if ('countryCode' in patch && !('serviceId' in patch)) {
        next.serviceId = undefined;
      }
      return next;
    });
  }, []);

  const loadMoreCatalog = useCallback(async () => {
    if (catalogLoading || catalogLoadingMore || !catalogHasMore) return;
    setCatalogLoadingMore(true);
    try {
      const nextPage = catalogPage + 1;
      const data = await catalogApi.list({
        currency,
        paymentMethod: 'MOBILE_MONEY',
        ...catalogFilters,
        page: nextPage,
        limit: 24,
      });
      setCatalog((previous) => {
        const seen = new Set(previous.map((item) => item.id));
        return [...previous, ...data.items.filter((item) => !seen.has(item.id))];
      });
      setServices((previous) => {
        const seen = new Set(previous.map((service) => service.id));
        return [...previous, ...data.services.filter((service) => !seen.has(service.id))];
      });
      setCatalogPage(nextPage);
      setCatalogTotal(data.total);
      setCatalogHasMore(data.hasMore);
    } catch {
      // Le bouton reste disponible pour réessayer.
    } finally {
      setCatalogLoadingMore(false);
    }
  }, [catalogLoading, catalogLoadingMore, catalogHasMore, catalogPage, currency, catalogFilters]);

  const getServicesForCountry = useCallback(
    async (countryCode: string) => {
      try {
        const data = await catalogApi.list({
          currency,
          paymentMethod: 'MOBILE_MONEY',
          countryCode,
          type: 'TEMPORARY',
          page: 1,
          limit: 1,
        });
        return data.serviceOptions;
      } catch {
        return [];
      }
    },
    [currency],
  );

  const resolveCatalogItem = useCallback(
    async (params: { countryCode: string; serviceId: string; type?: NumberType }) => {
      try {
        const data = await catalogApi.list({
          currency,
          paymentMethod: 'MOBILE_MONEY',
          countryCode: params.countryCode,
          serviceId: params.serviceId,
          type: params.type ?? 'TEMPORARY',
          page: 1,
          limit: 1,
        });
        return data.items[0] ?? null;
      } catch {
        return null;
      }
    },
    [currency],
  );

  const refreshOrders = useCallback(async () => {
    if (!currentUser) {
      setOrders([]);
      return;
    }
    try {
      const data = await ordersApi.list();
      setOrders(data.orders.map(localizeOrder));
    } catch {
      // Le rafraîchissement silencieux ne doit pas interrompre l'interface.
    }
  }, [currentUser]);

  const refreshWallet = useCallback(async () => {
    if (!currentUser) {
      setBalances(EMPTY_BALANCES);
      setTransactions([]);
      return;
    }
    try {
      const [walletData, txData] = await Promise.all([
        walletApi.list(),
        walletApi.transactions(currency),
      ]);
      const next: Record<Currency, number> = { ...EMPTY_BALANCES };
      for (const entry of walletData.wallets) next[entry.currency] = entry.balance;
      setBalances(next);
      setTransactions(txData.transactions);
    } catch {
      // Idem : ne pas casser l'écran en cas d'échec réseau ponctuel.
    }
  }, [currentUser, currency]);

  const loadAdminData = useCallback(async () => {
    if (currentUser?.role !== 'ADMIN') return;
    setAdminLoading(true);
    try {
      const results = await Promise.allSettled([
        adminApi.stats(),
        adminApi.orders({ page: 1, limit: 100 }),
        adminApi.users(1, 100),
        adminApi.catalog({ page: 1, limit: 50 }),
        adminApi.audit(1, 100),
        adminApi.providerBalance(),
      ]);
      const [stats, ordersResult, usersResult, catalogResult, auditResult, providerResult] =
        results;
      if (stats.status === 'fulfilled') setAdminStats(stats.value);
      if (ordersResult.status === 'fulfilled')
        setAdminOrders(ordersResult.value.orders.map(localizeOrder));
      if (usersResult.status === 'fulfilled') setAdminUsers(usersResult.value.users);
      if (catalogResult.status === 'fulfilled') {
        setAdminCatalog(
          catalogResult.value.items.map((item) => ({
            ...item,
            countryName: countryDisplayName(item.countryCode, item.countryName),
          })),
        );
        setAdminCatalogTotal(catalogResult.value.total);
        setAdminCatalogHasMore(catalogResult.value.hasMore);
        setAdminCatalogPage(1);
        setAdminCatalogSearch('');
      }
      if (auditResult.status === 'fulfilled') setAdminAudit(auditResult.value.logs);
      if (providerResult.status === 'fulfilled') setAdminProvider(providerResult.value);
    } finally {
      setAdminLoading(false);
    }
  }, [currentUser]);

  const loadMoreAdminCatalog = useCallback(async () => {
    if (!adminCatalogHasMore || adminCatalogLoadingMore) return;
    setAdminCatalogLoadingMore(true);
    try {
      const nextPage = adminCatalogPage + 1;
      const data = await adminApi.catalog({
        page: nextPage,
        limit: 50,
        search: adminCatalogSearch || undefined,
      });
      setAdminCatalog((previous) => {
        const seen = new Set(previous.map((item) => item.id));
        return [
          ...previous,
          ...data.items
            .filter((item) => !seen.has(item.id))
            .map((item) => ({
              ...item,
              countryName: countryDisplayName(item.countryCode, item.countryName),
            })),
        ];
      });
      setAdminCatalogPage(nextPage);
      setAdminCatalogTotal(data.total);
      setAdminCatalogHasMore(data.hasMore);
    } catch {
      // Réessai possible via le bouton.
    } finally {
      setAdminCatalogLoadingMore(false);
    }
  }, [adminCatalogHasMore, adminCatalogLoadingMore, adminCatalogPage, adminCatalogSearch]);

  const searchAdminCatalog = useCallback(async (term: string) => {
    const search = term.trim();
    setAdminCatalogLoadingMore(true);
    try {
      const data = await adminApi.catalog({ page: 1, limit: 50, search: search || undefined });
      setAdminCatalog(
        data.items.map((item) => ({
          ...item,
          countryName: countryDisplayName(item.countryCode, item.countryName),
        })),
      );
      setAdminCatalogSearch(search);
      setAdminCatalogPage(1);
      setAdminCatalogTotal(data.total);
      setAdminCatalogHasMore(data.hasMore);
    } catch {
      // On conserve la liste existante en cas d'échec réseau.
    } finally {
      setAdminCatalogLoadingMore(false);
    }
  }, []);

  const refreshProviderBalance = useCallback(async () => {
    try {
      const data = await adminApi.providerBalance();
      setAdminProvider(data);
    } catch {
      // Silencieux : le fournisseur peut être momentanément indisponible.
    }
  }, []);

  /* ---------------------------------------------------------------------- */
  /* Bootstrap : configuration, catalogue, restauration de session           */
  /* ---------------------------------------------------------------------- */

  useEffect(() => {
    void refreshConfig();
  }, [refreshConfig]);

  useEffect(() => {
    void refreshCountries();
  }, [refreshCountries]);

  useEffect(() => {
    void refreshCatalog();
  }, [refreshCatalog]);

  useEffect(() => {
    let mounted = true;

    setUnauthorizedHandler(() => {
      setCurrentUser(null);
      setOrders([]);
      setBalances(EMPTY_BALANCES);
      setTransactions([]);
      setAdminStats(null);
      setAdminOrders([]);
      setAdminUsers([]);
      setAdminCatalog([]);
      setAdminAudit([]);
    });

    (async () => {
      try {
        const restored = await authApi.refresh();
        if (mounted && restored?.user) {
          setAccessToken(restored.accessToken);
          setCurrentUser(restored.user);
        }
      } catch {
        // Aucun cookie de session valide : visiteur.
      } finally {
        if (mounted) setSessionLoading(false);
      }
    })();

    return () => {
      mounted = false;
      setUnauthorizedHandler(null);
    };
  }, []);

  /* ---------------------------------------------------------------------- */
  /* Chargement des données privées                                          */
  /* ---------------------------------------------------------------------- */

  useEffect(() => {
    if (!currentUser) {
      setOrders([]);
      setBalances(EMPTY_BALANCES);
      setTransactions([]);
      return;
    }

    void refreshOrders();
    void refreshWallet();

    const ordersInterval = window.setInterval(() => {
      if (document.visibilityState === 'visible') void refreshOrders();
    }, 10_000);

    const walletInterval = window.setInterval(() => {
      if (document.visibilityState === 'visible') void refreshWallet();
    }, 30_000);

    return () => {
      window.clearInterval(ordersInterval);
      window.clearInterval(walletInterval);
    };
  }, [currentUser, refreshOrders, refreshWallet]);

  useEffect(() => {
    if (currentUser?.role === 'ADMIN') void loadAdminData();
  }, [currentUser, loadAdminData]);

  /* ---------------------------------------------------------------------- */
  /* Authentification                                                       */
  /* ---------------------------------------------------------------------- */

  const login = async (email: string, password: string) => {
    try {
      const result = await authApi.login(email, password);
      setAccessToken(result.accessToken);
      setCurrentUser(result.user);
      if (SUPPORTED_CURRENCIES.includes(result.user.preferredCurrency)) {
        setCurrency(result.user.preferredCurrency);
      }
      return { success: true, user: result.user };
    } catch (error) {
      return { success: false, error: toErrorMessage(error) };
    }
  };

  const register = async (data: {
    name: string;
    email: string;
    password: string;
    country?: string;
    phone?: string;
    preferredCurrency?: Currency;
  }) => {
    try {
      const result = await authApi.register(data);
      setAccessToken(result.accessToken);
      setCurrentUser(result.user);
      if (SUPPORTED_CURRENCIES.includes(result.user.preferredCurrency)) {
        setCurrency(result.user.preferredCurrency);
      }
      return { success: true, user: result.user };
    } catch (error) {
      return { success: false, error: toErrorMessage(error) };
    }
  };

  const logout = async () => {
    try {
      await authApi.logout();
    } catch {
      // La session locale est nettoyée dans tous les cas.
    }
    setAccessToken(null);
    setCurrentUser(null);
    setOrders([]);
    setBalances(EMPTY_BALANCES);
    setTransactions([]);
    setAdminStats(null);
    setAdminOrders([]);
    setAdminUsers([]);
    setAdminCatalog([]);
    setAdminAudit([]);
    setAdminProvider(null);
  };

  /* ---------------------------------------------------------------------- */
  /* Catalogue & commandes                                                  */
  /* ---------------------------------------------------------------------- */

  const quote = useCallback(
    async (
      itemId: string,
      paymentMethod: PaymentMethod,
      currencyOverride: Currency = currency,
    ) => {
      const result = await catalogApi.quote(itemId, currencyOverride, paymentMethod);
      return result.price;
    },
    [currency],
  );

  const upsertOrder = useCallback((order: Order) => {
    const localized = localizeOrder(order);
    setOrders((previous) => {
      const index = previous.findIndex((entry) => entry.id === localized.id);
      if (index === -1) return [localized, ...previous];
      const next = [...previous];
      next[index] = localized;
      return next;
    });
  }, []);

  const createOrder = async (
    params: CreateOrderParams,
  ): Promise<
    ActionResult<{ order?: Order; checkoutUrl?: string | null; payment?: Payment }>
  > => {
    if (!currentUser) {
      return { success: false, error: 'Connectez-vous pour commander un numéro.' };
    }

    let itemId = params.catalogItemId;
    if (!itemId) {
      if (!params.countryCode || !params.serviceId) {
        return {
          success: false,
          error: "Ce numéro n'est pas disponible dans le catalogue actuel.",
        };
      }
      const resolved = await resolveCatalogItem({
        countryCode: params.countryCode,
        serviceId: params.serviceId,
        type: params.type ?? 'TEMPORARY',
      });
      if (!resolved) {
        return {
          success: false,
          error: "Ce numéro n'est pas disponible dans le catalogue actuel.",
        };
      }
      itemId = resolved.id;
    }

    try {
      const result = await ordersApi.create({
        catalogItemId: itemId,
        paymentMethod: params.paymentMethod,
        currency: params.currency ?? currency,
        mobileMoneyOperator:
          params.paymentMethod === 'MOBILE_MONEY'
            ? params.mobileMoneyOperator
            : undefined,
        mobileMoneyPhone:
          params.paymentMethod === 'MOBILE_MONEY'
            ? params.mobileMoneyPhone
            : undefined,
        idempotencyKey: params.idempotencyKey,
      });

      upsertOrder(result.order);
      if (params.paymentMethod === 'WALLET') {
        await refreshWallet();
      }

      return {
        success: true,
        order: result.order,
        checkoutUrl: result.checkoutUrl ?? null,
        payment: result.payment,
      };
    } catch (error) {
      return { success: false, error: toErrorMessage(error) };
    }
  };

  const verifyOrderPayment = async (
    orderId: string,
  ): Promise<ActionResult<{ order?: Order; payment?: Payment }>> => {
    try {
      const result = await ordersApi.verifyPayment(orderId);
      upsertOrder(result.order);
      await refreshWallet();
      return { success: true, order: result.order, payment: result.payment };
    } catch (error) {
      return { success: false, error: toErrorMessage(error) };
    }
  };

  const refreshOrder = useCallback(
    async (orderId: string) => {
      try {
        const result = await ordersApi.refresh(orderId);
        upsertOrder(result.order);
        return result.order;
      } catch {
        return null;
      }
    },
    [upsertOrder],
  );

  const cancelAndRefundOrder = async (orderId: string, reason?: string) => {
    try {
      const result = await ordersApi.cancel(orderId);
      upsertOrder(result.order);
      await refreshWallet();
      return true;
    } catch {
      return false;
    }
  };

  const simulateSmsReception = async (orderId: string) => {
    try {
      await devApi.simulateSms(orderId);
      await refreshOrder(orderId);
      return true;
    } catch {
      return false;
    }
  };

  const resendSms = async (orderId: string) => {
    try {
      const result = await ordersApi.resendSms(orderId);
      upsertOrder(result.order);
      return true;
    } catch {
      return false;
    }
  };

  const startTopUp = async (
    amountXof: number,
    paymentMethod: 'MOBILE_MONEY' | 'CARD',
  ): Promise<ActionResult<{ payment?: Payment; checkoutUrl?: string }>> => {
    if (!currentUser) {
      return { success: false, error: 'Connectez-vous pour recharger votre portefeuille.' };
    }
    try {
      const result = await walletApi.topUp(amountXof, paymentMethod);
      return {
        success: true,
        payment: result.payment,
        checkoutUrl: result.checkoutUrl,
      };
    } catch (error) {
      return { success: false, error: toErrorMessage(error) };
    }
  };

  const verifyTopUpPayment = async (paymentId: string) => {
    try {
      const result = await walletApi.payment(paymentId);
      if (result.payment.status === 'APPROVED') {
        await refreshWallet();
      }
      return result.payment;
    } catch {
      return null;
    }
  };

  const verifyPaymentByReference = async (
    reference: string,
  ): Promise<
    ActionResult<{
      payment?: Payment;
      orderId?: string | null;
      orderStatus?: string | null;
    }>
  > => {
    try {
      const result = await paymentsApi.byReference(reference);
      if (result.payment.status === 'APPROVED') {
        await refreshWallet();
      }
      if (result.orderId) await refreshOrders();
      return {
        success: true,
        payment: result.payment,
        orderId: result.orderId,
        orderStatus: result.orderStatus,
      };
    } catch (error) {
      return { success: false, error: toErrorMessage(error) };
    }
  };

  /* ---------------------------------------------------------------------- */
  /* Actions administrateur                                                 */
  /* ---------------------------------------------------------------------- */

  const updatePricingConfig = async (
    patch: Partial<PricingConfig>,
  ): Promise<ActionResult> => {
    try {
      const result = await adminApi.updatePricing(patch);
      setAppConfig((previous) =>
        previous ? { ...previous, pricing: result.pricing } : previous,
      );
      await Promise.all([refreshCatalog(), loadAdminData()]);
      return { success: true };
    } catch (error) {
      return { success: false, error: toErrorMessage(error) };
    }
  };

  const updateCatalogItem = async (
    id: string,
    patch: { enabled?: boolean; availableCount?: number; supplierCostXofMinor?: number },
  ): Promise<ActionResult> => {
    try {
      await adminApi.updateCatalog(id, patch);
      await Promise.all([refreshCatalog(), loadAdminData()]);
      return { success: true };
    } catch (error) {
      return { success: false, error: toErrorMessage(error) };
    }
  };

  const syncCatalog = async (): Promise<ActionResult> => {
    try {
      await adminApi.syncCatalog();
      await Promise.all([refreshCatalog(), refreshCountries(), loadAdminData()]);
      return { success: true };
    } catch (error) {
      return { success: false, error: toErrorMessage(error) };
    }
  };

  const refundOrder = async (
    orderId: string,
    reason?: string,
  ): Promise<ActionResult> => {
    try {
      await adminApi.refundOrder(orderId, reason);
      await Promise.all([loadAdminData(), refreshOrders()]);
      return { success: true };
    } catch (error) {
      return { success: false, error: toErrorMessage(error) };
    }
  };

  const syncOrder = async (orderId: string): Promise<ActionResult> => {
    try {
      await adminApi.syncOrder(orderId);
      await Promise.all([loadAdminData(), refreshOrders()]);
      return { success: true };
    } catch (error) {
      return { success: false, error: toErrorMessage(error) };
    }
  };

  const updateUser = async (
    id: string,
    patch: { role?: string; status?: string },
  ): Promise<ActionResult> => {
    try {
      await adminApi.updateUser(id, patch);
      await loadAdminData();
      return { success: true };
    } catch (error) {
      return { success: false, error: toErrorMessage(error) };
    }
  };

  const resetUserPassword = async (
    id: string,
  ): Promise<{ success: boolean; temporaryPassword?: string; email?: string; error?: string }> => {
    try {
      const result = await adminApi.resetUserPassword(id);
      return {
        success: true,
        temporaryPassword: result.temporaryPassword,
        email: result.user.email,
      };
    } catch (error) {
      return { success: false, error: toErrorMessage(error) };
    }
  };

  /* ---------------------------------------------------------------------- */
  /* Valeurs dérivées                                                       */
  /* ---------------------------------------------------------------------- */

  const pricingConfig = appConfig?.pricing ?? DEFAULT_PRICING_CONFIG;
  const exchangeRates = appConfig?.exchangeRates ?? DEFAULT_EXCHANGE_RATES;

  const providerConfig: UltraSmsProviderConfig = useMemo(() => {
    const mode = adminProvider?.mode ?? appConfig?.ultrasms.mode ?? 'mock';
    const balanceCents = adminProvider?.balance?.balanceCents ?? 0;
    return {
      apiKey: '',
      apiEndpoint: '',
      isSandbox: mode !== 'live',
      connected: Boolean(adminProvider),
      balanceXof: 0,
      balanceUsd: balanceCents / 100,
      mode,
      lastPing: new Date().toISOString(),
    };
  }, [adminProvider, appConfig]);

  const wallet: UserWallet = useMemo(
    () => ({
      userId: currentUser?.id ?? 'guest',
      balances,
      transactions,
    }),
    [currentUser, balances, transactions],
  );

  return (
    <AppContext.Provider
      value={{
        role,
        currentUser,
        isAuthenticated: Boolean(currentUser),
        sessionLoading,
        currency,
        setCurrency,
        theme,
        toggleTheme,
        profile: currentUser,
        appConfig,
        catalog,
        countries,
        countriesLoading,
        countriesError,
        refreshCountries,
        services,
        catalogLoading,
        catalogLoadingMore,
        catalogFilters,
        catalogTotal,
        catalogHasMore,
        catalogServiceTotal,
        setCatalogFilters,
        loadMoreCatalog,
        getServicesForCountry,
        resolveCatalogItem,
        pricingConfig,
        exchangeRates,
        providerConfig,
        orders,
        wallet,
        auditLogs: adminAudit,
        adminStats,
        adminOrders,
        adminUsers,
        adminCatalog,
        adminCatalogTotal,
        adminCatalogHasMore,
        adminCatalogLoadingMore,
        adminCatalogSearch,
        loadMoreAdminCatalog,
        searchAdminCatalog,
        adminAudit,
        adminLoading,
        quote,
        createOrder,
        verifyOrderPayment,
        refreshOrder,
        cancelAndRefundOrder,
        simulateSmsReception,
        resendSms,
        refreshOrders,
        refreshWallet,
        startTopUp,
        verifyTopUpPayment,
        verifyPaymentByReference,
        login,
        register,
        logout,
        loadAdminData,
        updatePricingConfig,
        updateCatalogItem,
        syncCatalog,
        refundOrder,
        syncOrder,
        updateUser,
        resetUserPassword,
        refreshProviderBalance,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
};
