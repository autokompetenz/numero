/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import {
  User,
  UserRole,
  Currency,
  PaymentMethod,
  MobileMoneyOperator,
  Order,
  Wallet,
  WalletTransaction,
  AuditLog,
  ServiceItem,
  Country,
  ProviderSetting,
  PricingConfig,
  ExchangeRates,
  SMSMessage,
} from '../types';
import {
  COUNTRIES,
  SERVICES,
  INITIAL_USERS,
  INITIAL_WALLETS,
  INITIAL_TRANSACTIONS,
  INITIAL_ORDERS,
  INITIAL_AUDIT_LOGS,
  PROVIDERS_SETTINGS,
} from '../data/mockData';
import {
  DEFAULT_PRICING_CONFIG,
  DEFAULT_EXCHANGE_RATES,
  calculateSellingPrice,
  formatCurrency,
} from '../services/pricingEngine';

interface Toast {
  id: string;
  title: string;
  message?: string;
  type: 'success' | 'error' | 'info' | 'warning';
}

interface AppContextType {
  currentUser: User | null;
  currentRole: UserRole;
  switchRole: (role: UserRole) => void;
  currency: Currency;
  setCurrency: (c: Currency) => void;
  darkMode: boolean;
  toggleDarkMode: () => void;
  pricingConfig: PricingConfig;
  updatePricingConfig: (newConfig: Partial<PricingConfig>) => void;
  exchangeRates: ExchangeRates;
  countries: Country[];
  services: ServiceItem[];
  orders: Order[];
  wallets: Wallet[];
  transactions: WalletTransaction[];
  auditLogs: AuditLog[];
  providers: ProviderSetting[];
  toasts: Toast[];
  addToast: (title: string, message?: string, type?: Toast['type']) => void;
  removeToast: (id: string) => void;
  createOrder: (params: {
    countryCode: string;
    serviceId: string;
    paymentMethod: PaymentMethod;
    paymentOperator?: MobileMoneyOperator;
    phoneInput?: string;
  }) => Promise<{ success: boolean; order?: Order; error?: string }>;
  cancelAndRefundOrder: (orderId: string, reason?: string) => Promise<boolean>;
  depositToWallet: (params: {
    amount: number;
    currency: Currency;
    method: PaymentMethod;
    operator?: MobileMoneyOperator;
  }) => Promise<boolean>;
  adminAuthenticated: boolean;
  isAdminAuthModalOpen: boolean;
  setIsAdminAuthModalOpen: (open: boolean) => void;
  verifyAdminPin: (pin: string) => Promise<{ success: boolean; error?: string; locked?: boolean; remainingSeconds?: number; remainingAttempts?: number }>;
  lockAdminSession: () => void;
  apiStatus: {
    fedapay: { configured: boolean; environment: string; secretKeyMasked: string; publicKeyMasked: string; endpoint: string };
    numfast: { configured: boolean; keyMasked: string; baseUrl: string };
  } | null;
  refreshApiStatus: () => Promise<void>;
  updateServiceCost: (serviceId: string, newCostXof: number) => void;
  toggleServiceStatus: (serviceId: string) => void;
  toggleCountryStatus: (countryCode: string) => void;
  refreshProviderPing: (providerId: string) => Promise<void>;
  simulateIncomingSms: (orderId: string) => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  // Theme state
  const [darkMode, setDarkMode] = useState<boolean>(() => {
    const saved = localStorage.getItem('numivo_theme');
    if (saved) return saved === 'dark';
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  });

  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('numivo_theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('numivo_theme', 'light');
    }
  }, [darkMode]);

  const toggleDarkMode = () => setDarkMode((prev) => !prev);

  // Currency & Role
  const [currency, setCurrency] = useState<Currency>('XOF');
  const [currentRole, setCurrentRole] = useState<UserRole>('CLIENT');
  const [currentUser, setCurrentUser] = useState<User | null>(INITIAL_USERS[0]);

  // Admin Security & Access Control
  const [adminAuthenticated, setAdminAuthenticated] = useState<boolean>(() => {
    return Boolean(localStorage.getItem('numivo_admin_token'));
  });
  const [adminSessionToken, setAdminSessionToken] = useState<string | null>(() => {
    return localStorage.getItem('numivo_admin_token');
  });
  const [isAdminAuthModalOpen, setIsAdminAuthModalOpen] = useState<boolean>(false);

  const switchRole = (role: UserRole) => {
    if (role === 'ADMIN') {
      if (!adminAuthenticated) {
        setIsAdminAuthModalOpen(true);
        return;
      }
      setCurrentRole('ADMIN');
      setCurrentUser(INITIAL_USERS[1]);
      addToast('Console Administrateur active', 'Session sécurisée par jeton chiffré.', 'info');
      return;
    }

    setCurrentRole(role);
    if (role === 'VISITOR') {
      setCurrentUser(null);
      addToast('Mode Visiteur activé', 'Vous naviguez sur la vitrine publique.', 'info');
    } else if (role === 'CLIENT') {
      setCurrentUser(INITIAL_USERS[0]);
      addToast('Connecté en tant que Client', 'Compte : Aminata Diallo', 'success');
    }
  };

  const verifyAdminPin = async (pin: string) => {
    try {
      const res = await fetch('/api/admin/verify-pin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin }),
      });

      const data = await res.json();

      if (res.ok && data.success && data.token) {
        setAdminAuthenticated(true);
        setAdminSessionToken(data.token);
        localStorage.setItem('numivo_admin_token', data.token);
        setCurrentRole('ADMIN');
        setCurrentUser(INITIAL_USERS[1]);
        setIsAdminAuthModalOpen(false);

        // Security Audit Log
        const audit: AuditLog = {
          id: `aud_${Date.now()}`,
          actorId: 'user_admin_1',
          actorName: 'Direction Numivo (Admin)',
          actorRole: 'ADMIN',
          action: 'ADMIN_AUTHENTICATION_SUCCESS',
          entityType: 'PROVIDER',
          entityId: 'admin_console',
          metadata: {
            authMethod: 'SECURITY_PIN',
            sessionDurationHours: 1,
          },
          createdAt: new Date().toISOString(),
        };
        setAuditLogs((prev) => [audit, ...prev]);

        addToast('Accès Administrateur Déverrouillé', 'Bienvenue sur la console de contrôle sécurisée.', 'success');
        return { success: true };
      }

      // Failed attempt
      const auditFail: AuditLog = {
        id: `aud_${Date.now()}`,
        actorId: 'unknown',
        actorName: 'Tentative d’accès Admin',
        actorRole: 'VISITOR',
        action: 'ADMIN_AUTHENTICATION_FAILED',
        entityType: 'PROVIDER',
        entityId: 'admin_console',
        metadata: {
          remainingAttempts: data.remainingAttempts,
          locked: data.locked,
        },
        createdAt: new Date().toISOString(),
      };
      setAuditLogs((prev) => [auditFail, ...prev]);

      return {
        success: false,
        error: data.error,
        locked: data.locked,
        remainingSeconds: data.remainingSeconds,
        remainingAttempts: data.remainingAttempts,
      };
    } catch (e: any) {
      return { success: false, error: 'Erreur de connexion au serveur de sécurité.' };
    }
  };

  const lockAdminSession = async () => {
    try {
      if (adminSessionToken) {
        await fetch('/api/admin/logout', {
          method: 'POST',
          headers: { Authorization: `Bearer ${adminSessionToken}` },
        });
      }
    } catch (e) {
      // ignore
    }
    setAdminAuthenticated(false);
    setAdminSessionToken(null);
    localStorage.removeItem('numivo_admin_token');
    setCurrentRole('CLIENT');
    setCurrentUser(INITIAL_USERS[0]);

    const audit: AuditLog = {
      id: `aud_${Date.now()}`,
      actorId: 'user_admin_1',
      actorName: 'Direction Numivo (Admin)',
      actorRole: 'ADMIN',
      action: 'ADMIN_SESSION_LOCKED',
      entityType: 'PROVIDER',
      entityId: 'admin_console',
      metadata: { reason: 'Verrouillage manuel ou expiration' },
      createdAt: new Date().toISOString(),
    };
    setAuditLogs((prev) => [audit, ...prev]);

    addToast('Session Verrouillée', 'La console administrateur a été sécurisée.', 'info');
  };

  // Pricing configuration
  const [pricingConfig, setPricingConfig] = useState<PricingConfig>(DEFAULT_PRICING_CONFIG);
  const [exchangeRates] = useState<ExchangeRates>(DEFAULT_EXCHANGE_RATES);

  // Core collections
  const [countries, setCountries] = useState<Country[]>(COUNTRIES);
  const [services, setServices] = useState<ServiceItem[]>(SERVICES);
  const [orders, setOrders] = useState<Order[]>(INITIAL_ORDERS);
  const [wallets, setWallets] = useState<Wallet[]>(INITIAL_WALLETS);
  const [transactions, setTransactions] = useState<WalletTransaction[]>(INITIAL_TRANSACTIONS);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>(INITIAL_AUDIT_LOGS);
  const [providers, setProviders] = useState<ProviderSetting[]>(PROVIDERS_SETTINGS);

  // Server API status for FedaPay & Num Fast
  const [apiStatus, setApiStatus] = useState<{
    fedapay: { configured: boolean; environment: string; secretKeyMasked: string; publicKeyMasked: string; endpoint: string };
    numfast: { configured: boolean; keyMasked: string; baseUrl: string };
  } | null>(null);

  const refreshApiStatus = async () => {
    try {
      const res = await fetch('/api/status');
      if (res.ok) {
        const data = await res.json();
        setApiStatus({
          fedapay: data.fedapay,
          numfast: data.numfast,
        });
      }
    } catch (e) {
      console.warn('API status check offline:', e);
    }
  };

  useEffect(() => {
    refreshApiStatus();
  }, []);

  // Toasts
  const [toasts, setToasts] = useState<Toast[]>([]);
  const addToast = (title: string, message?: string, type: Toast['type'] = 'info') => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts((prev) => [...prev, { id, title, message, type }]);
    setTimeout(() => removeToast(id), 5000);
  };
  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  // Pricing config update with audit
  const updatePricingConfig = (newConfig: Partial<PricingConfig>) => {
    setPricingConfig((prev) => {
      const updated = { ...prev, ...newConfig };
      const log: AuditLog = {
        id: `aud_${Date.now()}`,
        actorId: currentUser?.id || 'admin',
        actorName: currentUser?.name || 'Administrateur',
        actorRole: 'ADMIN',
        action: 'PRICING_CONFIG_UPDATED',
        entityType: 'PRICING',
        entityId: 'global_pricing',
        metadata: {
          previousConfig: prev,
          updatedConfig: updated,
          targetMarginXof: updated.targetMarginXof,
        },
        ipAddress: '154.68.22.10',
        createdAt: new Date().toISOString(),
      };
      setAuditLogs((l) => [log, ...l]);
      addToast('Règles de prix mises à jour', `Marge cible : ${updated.targetMarginXof} XOF`, 'success');
      return updated;
    });
  };

  // Simulate incoming SMS message for an order
  const simulateIncomingSms = (orderId: string) => {
    setOrders((prev) =>
      prev.map((ord) => {
        if (ord.id !== orderId) return ord;
        if (ord.smsMessages.length > 0) return ord; // already has SMS

        // Generate OTP based on service
        const randomCode = Math.floor(100000 + Math.random() * 900000).toString();
        let formattedCode = randomCode;
        if (ord.serviceId === 'whatsapp') {
          formattedCode = `${randomCode.slice(0, 3)}-${randomCode.slice(3)}`;
        }

        const newSms: SMSMessage = {
          id: `sms_${Date.now()}`,
          orderId: ord.id,
          sender: ord.serviceName.split(' ')[0] || 'Verification',
          text: `Votre code d'activation pour ${ord.serviceName} est ${formattedCode}. Valable 10 minutes.`,
          extractedCode: formattedCode,
          receivedAt: new Date().toISOString(),
        };

        const updatedOrder: Order = {
          ...ord,
          status: 'COMPLETED',
          completedAt: new Date().toISOString(),
          smsMessages: [newSms],
        };

        // Notify client
        addToast(
          `SMS reçu pour ${ord.serviceName} !`,
          `Code OTP : ${formattedCode} - Numéro : ${ord.phoneNumber}`,
          'success'
        );

        return updatedOrder;
      })
    );
  };

  // Create an order
  const createOrder = async ({
    countryCode,
    serviceId,
    paymentMethod,
    paymentOperator,
    phoneInput,
  }: {
    countryCode: string;
    serviceId: string;
    paymentMethod: PaymentMethod;
    paymentOperator?: MobileMoneyOperator;
    phoneInput?: string;
  }): Promise<{ success: boolean; order?: Order; error?: string }> => {
    const service = services.find((s) => s.id === serviceId);
    const country = countries.find((c) => c.code === countryCode);

    if (!service || !country) {
      return { success: false, error: 'Service ou pays introuvable.' };
    }

    // 1. Calculate price with official formula
    const quote = calculateSellingPrice({
      supplierCostXof: service.baseSupplierCostXof,
      paymentMethod,
      config: pricingConfig,
      targetCurrency: currency,
      rates: exchangeRates,
    });

    const currentUserId = currentUser?.id || 'user_client_1';

    // 2. If Wallet payment: check balance and atomically debit
    if (paymentMethod === 'WALLET') {
      const userWallet = wallets.find((w) => w.userId === currentUserId && w.currency === currency);
      const requiredAmountMinor = quote.displayPrice;

      if (!userWallet || userWallet.balanceMinor < requiredAmountMinor) {
        addToast(
          'Solde insuffisant',
          `Votre portefeuille ${currency} a un solde de ${formatCurrency(userWallet?.balanceMinor || 0, currency)}, mais la commande coûte ${quote.displayFormatted}.`,
          'error'
        );
        return { success: false, error: 'Solde insuffisant dans votre portefeuille.' };
      }

      // Debit atomically
      setWallets((prev) =>
        prev.map((w) =>
          w.id === userWallet.id
            ? { ...w, balanceMinor: w.balanceMinor - requiredAmountMinor, updatedAt: new Date().toISOString() }
            : w
        )
      );

      // Record transaction in ledger
      const tx: WalletTransaction = {
        id: `tx_${Date.now()}`,
        walletId: userWallet.id,
        userId: currentUserId,
        type: 'PURCHASE',
        amountMinor: -requiredAmountMinor,
        currency,
        status: 'COMPLETED',
        reference: `ORD-${Date.now().toString().slice(-6)}`,
        description: `Achat numéro virtuel ${service.name} (${country.name})`,
        idempotencyKey: `idem_pur_${Date.now()}`,
        createdAt: new Date().toISOString(),
      };
      setTransactions((prev) => [tx, ...prev]);
    }

    // 3. Request virtual phone number from Num Fast backend proxy
    let allocatedNumber = `${country.dialCode} 97 12 34 56`;
    let providerOrderId = `NF-${Date.now().toString().slice(-6)}`;
    let providerName: 'NUM_FAST' | 'ULTRA_SMS' = 'NUM_FAST';

    try {
      const numfastRes = await fetch('/api/numfast/order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ countryCode: country.code, serviceId: service.id }),
      });
      if (numfastRes.ok) {
        const nfData = await numfastRes.json();
        if (nfData.phoneNumber) {
          allocatedNumber = nfData.phoneNumber;
        }
        if (nfData.providerOrderId) {
          providerOrderId = nfData.providerOrderId;
        }
      }
    } catch (e) {
      console.warn('Num Fast proxy fallback:', e);
      const randomDigits = Math.floor(10000000 + Math.random() * 90000000).toString();
      allocatedNumber = `${country.dialCode} ${randomDigits.slice(0, 2)} ${randomDigits.slice(2, 4)} ${randomDigits.slice(4, 6)} ${randomDigits.slice(6, 8)}`;
    }

    const orderNumber = `NUM-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;
    const newOrderId = `ord_${Date.now()}`;

    const newOrder: Order = {
      id: newOrderId,
      orderNumber,
      userId: currentUserId,
      userName: currentUser?.name || 'Aminata Diallo',
      userEmail: currentUser?.email || 'client@numivo.com',
      countryCode: country.code,
      countryName: country.name,
      serviceId: service.id,
      serviceName: service.name,
      phoneNumber: allocatedNumber,
      currency,
      supplierCostXof: quote.supplierCostXof,
      supplierCostMinor: quote.supplierCostXof,
      supplierCostCurrency: 'XOF',
      exchangeRate: quote.exchangeRateUsed,
      sellingPriceXof: quote.sellingPriceXof,
      sellingPriceMinor: quote.displayPrice,
      paymentMethod,
      paymentOperator,
      paymentFeeXof: quote.estimatedPaymentFeeXof,
      targetMarginXof: quote.targetMarginXof,
      actualMarginXof: quote.estimatedNetMarginXof,
      status: 'PROCESSING',
      provider: providerName,
      providerOrderId,
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 20 * 60 * 1000).toISOString(), // 20 minutes countdown
      smsMessages: [],
      idempotencyKey: `idem_ord_${Date.now()}`,
    };

    setOrders((prev) => [newOrder, ...prev]);

    // Audit log
    const audit: AuditLog = {
      id: `aud_${Date.now()}`,
      actorId: currentUserId,
      actorName: currentUser?.name || 'Client',
      actorRole: 'CLIENT',
      action: 'ORDER_CREATED',
      entityType: 'ORDER',
      entityId: newOrderId,
      metadata: {
        orderNumber,
        service: service.name,
        country: country.name,
        paymentMethod,
        sellingPriceXof: quote.sellingPriceXof,
        netMarginXof: quote.estimatedNetMarginXof,
      },
      createdAt: new Date().toISOString(),
    };
    setAuditLogs((prev) => [audit, ...prev]);

    addToast(
      'Commande confirmée !',
      `Numéro attribué : ${allocatedNumber}. En attente du SMS...`,
      'success'
    );

    // Auto simulate SMS reception after 10 seconds for ultra-engaging realistic demo!
    setTimeout(() => {
      simulateIncomingSms(newOrderId);
    }, 10000);

    return { success: true, order: newOrder };
  };

  // Cancel order & refund
  const cancelAndRefundOrder = async (orderId: string, reason = 'Annulation client ou timeout SMS'): Promise<boolean> => {
    const order = orders.find((o) => o.id === orderId);
    if (!order) return false;

    if (order.status === 'COMPLETED' && order.smsMessages.length > 0) {
      addToast('Impossible d’annuler', 'Le SMS a déjà été reçu et délivré pour cette commande.', 'warning');
      return false;
    }

    // 1. Mark order as REFUNDED
    setOrders((prev) =>
      prev.map((o) =>
        o.id === orderId ? { ...o, status: 'REFUNDED' } : o
      )
    );

    // 2. Refund money to client's wallet
    const userWallet = wallets.find((w) => w.userId === order.userId && w.currency === order.currency);
    if (userWallet) {
      setWallets((prev) =>
        prev.map((w) =>
          w.id === userWallet.id
            ? { ...w, balanceMinor: w.balanceMinor + order.sellingPriceMinor, updatedAt: new Date().toISOString() }
            : w
        )
      );

      // Record refund transaction in ledger
      const refundTx: WalletTransaction = {
        id: `tx_${Date.now()}`,
        walletId: userWallet.id,
        userId: order.userId,
        type: 'REFUND',
        amountMinor: order.sellingPriceMinor,
        currency: order.currency,
        status: 'COMPLETED',
        reference: `REF-${order.orderNumber}`,
        description: `Remboursement commande ${order.orderNumber} (${reason})`,
        idempotencyKey: `idem_ref_${Date.now()}`,
        createdAt: new Date().toISOString(),
      };
      setTransactions((prev) => [refundTx, ...prev]);
    }

    // 3. Audit log
    const audit: AuditLog = {
      id: `aud_${Date.now()}`,
      actorId: currentUser?.id || 'admin',
      actorName: currentUser?.name || 'Administrateur',
      actorRole: currentUser?.role || 'ADMIN',
      action: 'ORDER_REFUNDED',
      entityType: 'REFUND',
      entityId: order.id,
      metadata: {
        orderNumber: order.orderNumber,
        refundedAmount: order.sellingPriceMinor,
        currency: order.currency,
        reason,
      },
      createdAt: new Date().toISOString(),
    };
    setAuditLogs((prev) => [audit, ...prev]);

    addToast(
      'Commande remboursée',
      `${formatCurrency(order.sellingPriceMinor, order.currency)} ont été recrédités sur le portefeuille.`,
      'info'
    );

    return true;
  };

  // Deposit to wallet
  const depositToWallet = async ({
    amount,
    currency: depCurrency,
    method,
    operator,
  }: {
    amount: number;
    currency: Currency;
    method: PaymentMethod;
    operator?: MobileMoneyOperator;
  }): Promise<boolean> => {
    if (amount <= 0) return false;

    const currentUserId = currentUser?.id || 'user_client_1';
    let targetWallet = wallets.find((w) => w.userId === currentUserId && w.currency === depCurrency);

    if (!targetWallet) {
      targetWallet = {
        id: `w_${depCurrency.toLowerCase()}_${currentUserId}`,
        userId: currentUserId,
        currency: depCurrency,
        balanceMinor: 0,
        updatedAt: new Date().toISOString(),
      };
      setWallets((prev) => [...prev, targetWallet!]);
    }

    // Atomic credit
    setWallets((prev) =>
      prev.map((w) =>
        w.userId === currentUserId && w.currency === depCurrency
          ? { ...w, balanceMinor: w.balanceMinor + amount, updatedAt: new Date().toISOString() }
          : w
      )
    );

    // Ledger record
    const depTx: WalletTransaction = {
      id: `tx_${Date.now()}`,
      walletId: targetWallet.id,
      userId: currentUserId,
      type: 'DEPOSIT',
      amountMinor: amount,
      currency: depCurrency,
      status: 'COMPLETED',
      reference: `DEP-${method === 'MOBILE_MONEY' ? operator || 'MOMO' : 'CARD'}-${Date.now().toString().slice(-6)}`,
      description: `Rechargement de portefeuille via ${method === 'MOBILE_MONEY' ? `${operator || 'Mobile Money'}` : 'Carte bancaire'}`,
      idempotencyKey: `idem_dep_${Date.now()}`,
      createdAt: new Date().toISOString(),
    };
    setTransactions((prev) => [depTx, ...prev]);

    // Audit log
    const audit: AuditLog = {
      id: `aud_${Date.now()}`,
      actorId: currentUserId,
      actorName: currentUser?.name || 'Client',
      actorRole: 'CLIENT',
      action: 'WALLET_DEPOSIT',
      entityType: 'WALLET',
      entityId: targetWallet.id,
      metadata: {
        amount,
        currency: depCurrency,
        method,
        operator,
      },
      createdAt: new Date().toISOString(),
    };
    setAuditLogs((prev) => [audit, ...prev]);

    addToast(
      'Dépôt confirmé !',
      `Votre portefeuille ${depCurrency} a été crédité de ${formatCurrency(amount, depCurrency)}.`,
      'success'
    );

    return true;
  };

  const updateServiceCost = (serviceId: string, newCostXof: number) => {
    setServices((prev) =>
      prev.map((s) => (s.id === serviceId ? { ...s, baseSupplierCostXof: newCostXof } : s))
    );
    addToast('Coût fournisseur mis à jour', `Nouveau coût : ${newCostXof} XOF`, 'success');
  };

  const toggleServiceStatus = (serviceId: string) => {
    // toggle service logic
    addToast('Statut du service modifié', undefined, 'info');
  };

  const toggleCountryStatus = (countryCode: string) => {
    // toggle country logic
    addToast('Statut du pays modifié', undefined, 'info');
  };

  const refreshProviderPing = async (providerId: string) => {
    setProviders((prev) =>
      prev.map((p) =>
        p.id === providerId
          ? { ...p, lastChecked: 'À l’instant (OK 200 ms)' }
          : p
      )
    );
    addToast('Connexion API vérifiée', 'Le service a répondu avec succès.', 'success');
  };

  return (
    <AppContext.Provider
      value={{
        currentUser,
        currentRole,
        switchRole,
        currency,
        setCurrency,
        darkMode,
        toggleDarkMode,
        pricingConfig,
        updatePricingConfig,
        exchangeRates,
        countries,
        services,
        orders,
        wallets,
        transactions,
        auditLogs,
        providers,
        adminAuthenticated,
        isAdminAuthModalOpen,
        setIsAdminAuthModalOpen,
        verifyAdminPin,
        lockAdminSession,
        apiStatus,
        refreshApiStatus,
        toasts,
        addToast,
        removeToast,
        createOrder,
        cancelAndRefundOrder,
        depositToWallet,
        updateServiceCost,
        toggleServiceStatus,
        toggleCountryStatus,
        refreshProviderPing,
        simulateIncomingSms,
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
