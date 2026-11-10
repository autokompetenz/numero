import React, { useEffect, useMemo, useState } from 'react';
import { useApp } from '../../context/AppContext';
import {
  Shield,
  TrendingUp,
  Smartphone,
  Settings,
  Server,
  FileText,
  RefreshCw,
  Sliders,
  CheckCircle2,
  AlertOctagon,
  Eye,
  RotateCcw,
  Users,
  Search,
  CloudDownload,
  Wallet,
  CircleAlert,
} from 'lucide-react';
import { AdminUser, Order, PricingConfig } from '../../types';

type AdminTab =
  | 'financials'
  | 'orders'
  | 'catalog'
  | 'users'
  | 'pricing'
  | 'provider'
  | 'audit';

const PAID_STATUSES: Order['status'][] = ['PAID', 'PROCESSING', 'COMPLETED'];
const REFUNDABLE_STATUSES: Order['status'][] = ['PAID', 'PROCESSING', 'COMPLETED', 'FAILED'];

const STATUS_LABELS: Record<Order['status'], string> = {
  PENDING_PAYMENT: 'Paiement en attente',
  PAID: 'Payé',
  PROCESSING: 'En attente SMS',
  COMPLETED: 'SMS reçu',
  CANCELLED: 'Annulé',
  REFUNDED: 'Remboursé',
  FAILED: 'Échec',
};

const STATUS_CLASSES: Record<Order['status'], string> = {
  PENDING_PAYMENT: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
  PAID: 'bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300',
  PROCESSING: 'bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300',
  COMPLETED: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300',
  CANCELLED: 'bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
  REFUNDED: 'bg-rose-100 text-rose-800 dark:bg-rose-950/40 dark:text-rose-300',
  FAILED: 'bg-rose-100 text-rose-800 dark:bg-rose-950/40 dark:text-rose-300',
};

function xof(value: number | null | undefined): string {
  return `${Math.round(value ?? 0).toLocaleString('fr-FR')} XOF`;
}

function shortId(value: string | null | undefined): string {
  if (!value) return '—';
  return value.length > 14 ? `${value.slice(0, 12)}…` : value;
}

export const AdminDashboard: React.FC = () => {
  const {
    pricingConfig,
    exchangeRates,
    providerConfig,
    appConfig,
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
    loadAdminData,
    updatePricingConfig,
    updateCatalogItem,
    syncCatalog,
    refundOrder,
    syncOrder,
    updateUser,
    resetUserPassword,
    currentUser,
    refreshProviderBalance,
  } = useApp();

  const [adminTab, setAdminTab] = useState<AdminTab>('financials');
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(
    null,
  );

  const [orderSearch, setOrderSearch] = useState('');
  const [orderStatus, setOrderStatus] = useState<'ALL' | Order['status']>('ALL');
  const [catalogSearchInput, setCatalogSearchInput] = useState(adminCatalogSearch);

  // Formulaire tarifaire
  const [targetMarginInput, setTargetMarginInput] = useState(pricingConfig.targetMarginXof);
  const [momoRateInput, setMomoRateInput] = useState(pricingConfig.paymentRateMobileMoney * 100);
  const [cardRateInput, setCardRateInput] = useState(pricingConfig.paymentRateCard * 100);
  const [walletRateInput, setWalletRateInput] = useState(pricingConfig.paymentRateWallet * 100);
  const [fixedFeeInput, setFixedFeeInput] = useState(pricingConfig.fixedPaymentFeeXof);
  const [roundingStepInput, setRoundingStepInput] = useState(pricingConfig.roundingStepXof);

  // Brouillons de coût fournisseur (édition au blur)
  const [costDrafts, setCostDrafts] = useState<Record<string, number>>({});

  // Mot de passe temporaire affiché une seule fois après réinitialisation.
  const [resetResult, setResetResult] = useState<{ email: string; password: string } | null>(null);

  useEffect(() => {
    setTargetMarginInput(pricingConfig.targetMarginXof);
    setMomoRateInput(pricingConfig.paymentRateMobileMoney * 100);
    setCardRateInput(pricingConfig.paymentRateCard * 100);
    setWalletRateInput(pricingConfig.paymentRateWallet * 100);
    setFixedFeeInput(pricingConfig.fixedPaymentFeeXof);
    setRoundingStepInput(pricingConfig.roundingStepXof);
  }, [pricingConfig]);

  useEffect(() => {
    setCostDrafts((previous) => {
      const next: Record<string, number> = {};
      for (const item of adminCatalog) {
        next[item.id] = previous[item.id] ?? item.supplierCostXof;
      }
      return next;
    });
  }, [adminCatalog]);

  // Recherche catalogue différée côté serveur.
  useEffect(() => {
    const timer = window.setTimeout(() => {
      const next = catalogSearchInput.trim();
      if (next !== adminCatalogSearch) {
        void searchAdminCatalog(next);
      }
    }, 400);
    return () => window.clearTimeout(timer);
  }, [catalogSearchInput, adminCatalogSearch, searchAdminCatalog]);

  const flash = (type: 'success' | 'error', message: string) => {
    setFeedback({ type, message });
    window.setTimeout(() => setFeedback(null), 5000);
  };

  const runAction = async (
    key: string,
    label: string,
    action: () => Promise<{ success: boolean; error?: string }>,
  ) => {
    setBusyAction(key);
    try {
      const result = await action();
      if (result.success) flash('success', `${label} : opération effectuée.`);
      else flash('error', result.error ?? `${label} : échec de l'opération.`);
    } finally {
      setBusyAction(null);
    }
  };

  const paidOrders = useMemo(
    () => adminOrders.filter((order) => PAID_STATUSES.includes(order.status)),
    [adminOrders],
  );

  const filteredOrders = useMemo(() => {
    const needle = orderSearch.trim().toLowerCase();
    return adminOrders.filter((order) => {
      if (orderStatus !== 'ALL' && order.status !== orderStatus) return false;
      if (!needle) return true;
      return [order.reference, order.userEmail, order.phoneNumber, order.serviceName, order.countryName]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(needle));
    });
  }, [adminOrders, orderSearch, orderStatus]);

  const totals = adminStats?.totals;
  const grossRevenueXof = totals?.revenueXof ?? 0;
  const supplierCostXof = totals?.supplierCostXof ?? 0;
  const netMarginXof = totals?.marginXof ?? 0;
  const paymentFeesXof = Math.max(0, grossRevenueXof - supplierCostXof - netMarginXof);
  const billedOrders = paidOrders.length;
  const averageMarginXof =
    billedOrders > 0
      ? Math.round(paidOrders.reduce((sum, order) => sum + order.actualMarginXof, 0) / billedOrders)
      : pricingConfig.targetMarginXof;
  const walletLiabilitiesXof = adminStats?.walletLiabilitiesXof ?? 0;

  const serviceRows = useMemo(() => {
    const map = new Map<
      string,
      { name: string; count: number; revenue: number; cost: number; margin: number }
    >();
    for (const order of paidOrders) {
      const current =
        map.get(order.serviceId) ?? {
          name: order.serviceName,
          count: 0,
          revenue: 0,
          cost: 0,
          margin: 0,
        };
      current.count += 1;
      current.revenue += order.sellingPriceXof;
      current.cost += order.supplierCostXof;
      current.margin += order.actualMarginXof;
      map.set(order.serviceId, current);
    }
    return [...map.values()].sort((a, b) => b.revenue - a.revenue).slice(0, 8);
  }, [paidOrders]);

  const handleSavePricing = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!Number.isFinite(targetMarginInput) || targetMarginInput < 2000) {
      flash('error', 'La marge nette cible doit être au minimum de 2 000 XOF.');
      return;
    }
    if ([momoRateInput, cardRateInput, walletRateInput].some((rate) => rate < 0 || rate > 20)) {
      flash('error', 'Les commissions de paiement doivent être comprises entre 0 et 20 %.');
      return;
    }

    const patch: Partial<PricingConfig> = {
      targetMarginXof: Math.round(targetMarginInput),
      paymentRateMobileMoney: momoRateInput / 100,
      paymentRateCard: cardRateInput / 100,
      paymentRateWallet: walletRateInput / 100,
      fixedPaymentFeeXof: Math.round(fixedFeeInput),
      roundingStepXof: Math.round(roundingStepInput),
    };
    await runAction('pricing', 'Règles tarifaires', () => updatePricingConfig(patch));
  };

  const handleCatalogCostBlur = async (itemId: string, previous: number) => {
    const value = costDrafts[itemId];
    if (!Number.isFinite(value) || value < 0) {
      setCostDrafts((current) => ({ ...current, [itemId]: previous }));
      flash('error', 'Le coût fournisseur doit être un nombre positif.');
      return;
    }
    const rounded = Math.round(value);
    if (rounded === previous) return;
    await runAction(`catalog-${itemId}`, 'Coût fournisseur', () =>
      updateCatalogItem(itemId, { supplierCostXofMinor: rounded }),
    );
  };

  const handleRefund = async (order: Order) => {
    const confirmed = window.confirm(
      `Rembourser la commande ${order.reference} (${xof(order.sellingPriceXof)}) sur le portefeuille du client ?`,
    );
    if (!confirmed) return;
    await runAction(`refund-${order.id}`, 'Remboursement', () =>
      refundOrder(order.id, 'Remboursement forcé par administrateur'),
    );
  };

  const handleSyncOrder = async (order: Order) => {
    await runAction(`sync-${order.id}`, 'Synchronisation commande', () => syncOrder(order.id));
  };

  const handleUserRole = async (user: AdminUser, role: string) => {
    await runAction(`user-role-${user.id}`, 'Rôle utilisateur', () =>
      updateUser(user.id, { role }),
    );
  };

  const handleUserStatus = async (user: AdminUser) => {
    const nextStatus = user.status === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE';
    await runAction(`user-status-${user.id}`, 'Statut utilisateur', () =>
      updateUser(user.id, { status: nextStatus }),
    );
  };

  const handleResetPassword = async (user: AdminUser) => {
    const confirmed = window.confirm(
      `Réinitialiser le mot de passe de ${user.email} ? Toutes ses sessions seront déconnectées.`,
    );
    if (!confirmed) return;
    setBusyAction(`user-reset-${user.id}`);
    try {
      const result = await resetUserPassword(user.id);
      if (result.success && result.temporaryPassword) {
        setResetResult({
          email: result.email ?? user.email,
          password: result.temporaryPassword,
        });
        flash('success', 'Mot de passe réinitialisé. Communiquez-le par un canal sûr.');
      } else {
        flash('error', result.error ?? 'Réinitialisation impossible.');
      }
    } finally {
      setBusyAction(null);
    }
  };

  const providerBalance = adminStats?.provider?.balance ?? null;
  const providerMode = adminStats?.provider?.mode ?? providerConfig.mode ?? appConfig?.ultrasms.mode;
  const webhookUrl =
    typeof window !== 'undefined'
      ? `${window.location.origin}/api/webhooks/ultrasms`
      : '/api/webhooks/ultrasms';

  const tabs: { id: AdminTab; label: string; icon: typeof TrendingUp; count?: number }[] = [
    { id: 'financials', label: 'Rapports & Rentabilité', icon: TrendingUp },
    { id: 'orders', label: 'Commandes', icon: FileText, count: adminOrders.length },
    { id: 'catalog', label: 'Catalogue & Coûts', icon: Smartphone, count: adminCatalog.length },
    { id: 'users', label: 'Utilisateurs', icon: Users, count: adminUsers.length },
    { id: 'pricing', label: 'Règles de Prix', icon: Sliders },
    { id: 'provider', label: 'Fournisseur Ultra SMS', icon: Server },
    { id: 'audit', label: "Journal d'Audit", icon: Shield, count: adminAudit.length },
  ];

  return (
    <div className="py-8 bg-slate-50 dark:bg-slate-950 min-h-[calc(100vh-4rem)]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6">
        {/* En-tête */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-200 dark:border-slate-800">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
              <Shield className="w-3.5 h-3.5" />
              <span>Console d'Administration & Pilotage</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white mt-1">
              Supervision Numivo & Rentabilité
            </h1>
          </div>

          <div className="flex flex-wrap items-center gap-2 font-mono text-xs">
            <span
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border font-bold ${
                providerMode === 'live'
                  ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-400'
                  : 'bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-400'
              }`}
            >
              <span
                className={`w-2 h-2 rounded-full ${
                  providerMode === 'live' ? 'bg-emerald-500' : 'bg-amber-500'
                }`}
              />
              Ultra SMS : {providerMode === 'live' ? 'LIVE' : 'MOCK / TEST'}
            </span>
            <button
              onClick={() => void runAction('refresh-all', 'Rafraîchissement', async () => {
                await Promise.all([loadAdminData(), refreshProviderBalance()]);
                return { success: true };
              })}
              disabled={adminLoading || busyAction === 'refresh-all'}
              className="p-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-50"
              title="Rafraîchir toutes les données"
              aria-label="Rafraîchir toutes les données"
            >
              <RefreshCw className={`w-4 h-4 ${adminLoading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {feedback && (
          <div
            className={`p-3 rounded-lg border text-xs flex items-center gap-2 ${
              feedback.type === 'success'
                ? 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300'
                : 'bg-rose-50 dark:bg-rose-950/30 border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300'
            }`}
            role="status"
          >
            {feedback.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 shrink-0" />
            ) : (
              <CircleAlert className="w-4 h-4 shrink-0" />
            )}
            <span>{feedback.message}</span>
          </div>
        )}

        {/* Onglets */}
        <div className="-mx-4 px-4 sm:mx-0 sm:px-0 flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 overflow-x-auto scrollbar-none snap-x">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setAdminTab(tab.id)}
                className={`flex items-center gap-2 px-3 sm:px-4 py-3 text-xs font-bold border-b-2 transition-all whitespace-nowrap shrink-0 snap-start ${
                  adminTab === tab.id
                    ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
                    : 'border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span>{tab.label}</span>
                {tab.count !== undefined && (
                  <span className="font-mono text-[11px] px-1.5 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800">
                    {tab.count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* TAB 1 : RENTABILITÉ */}
        {adminTab === 'financials' && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
              <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
                <span className="text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wider font-semibold">
                  Chiffre d'Affaires Brut
                </span>
                <div className="text-lg min-[420px]:text-xl sm:text-2xl font-black font-mono text-slate-900 dark:text-white mt-2">
                  {xof(grossRevenueXof)}
                </div>
                <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 font-mono">
                  {totals?.orders ?? 0} commandes · {totals?.completed ?? 0} terminées
                </div>
              </div>

              <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
                <span className="text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wider font-semibold">
                  Coût Fournisseur
                </span>
                <div className="text-lg min-[420px]:text-xl sm:text-2xl font-black font-mono text-rose-600 dark:text-rose-400 mt-2">
                  - {xof(supplierCostXof)}
                </div>
                <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 font-mono">
                  Achats Ultra SMS
                </div>
              </div>

              <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
                <span className="text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wider font-semibold">
                  Commissions Paiement
                </span>
                <div className="text-lg min-[420px]:text-xl sm:text-2xl font-black font-mono text-amber-700 dark:text-amber-400 mt-2">
                  - {xof(paymentFeesXof)}
                </div>
                <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 font-mono">
                  FedaPay · cartes · mobile money
                </div>
              </div>

              <div className="p-4 rounded-xl border border-emerald-500/40 bg-emerald-50/20 dark:bg-emerald-950/20">
                <span className="text-xs text-emerald-700 dark:text-emerald-400 uppercase tracking-wider font-bold">
                  Marge Nette Réalisée
                </span>
                <div className="text-lg min-[420px]:text-xl sm:text-2xl font-black font-mono text-emerald-700 dark:text-emerald-400 mt-2">
                  {xof(netMarginXof)}
                </div>
                <div className="text-[11px] text-emerald-700 dark:text-emerald-400 font-bold mt-1 font-mono">
                  Marge moy. : {xof(averageMarginXof)} / n° (cible ≥ {xof(pricingConfig.targetMarginXof)})
                </div>
              </div>
            </div>

            {/* Ségrégation des fonds clients */}
            <div className="p-5 rounded-2xl border border-amber-200 dark:border-amber-900/50 bg-amber-50/50 dark:bg-amber-950/20 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-xs font-bold text-amber-800 dark:text-amber-300">
                  <AlertOctagon className="w-4 h-4 text-amber-600" />
                  <span>Obligation comptable : ségrégation des fonds clients</span>
                </div>
                <p className="text-xs text-amber-700 dark:text-amber-400 max-w-2xl">
                  Les soldes des portefeuilles clients constituent une dette envers les clients et ne
                  doivent jamais être confondus avec le chiffre d'affaires ou le bénéfice de
                  l'entreprise.
                </p>
              </div>
              <div className="p-3 bg-white dark:bg-slate-900 rounded-xl border border-amber-200 dark:border-amber-800 text-right shrink-0">
                <div className="text-[11px] text-slate-500 dark:text-slate-400 uppercase font-mono">
                  Fonds clients cloisonnés (XOF)
                </div>
                <div className="text-lg font-black font-mono text-slate-900 dark:text-white">
                  {xof(walletLiabilitiesXof)}
                </div>
              </div>
            </div>

            {/* Volumes par statut */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { label: 'Paiements en attente', value: totals?.pendingPayment ?? 0 },
                { label: 'En attente SMS', value: totals?.processing ?? 0 },
                { label: 'Commandes terminées', value: totals?.completed ?? 0 },
                { label: 'Remboursements', value: totals?.refunds ?? 0 },
              ].map((entry) => (
                <div
                  key={entry.label}
                  className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900"
                >
                  <div className="text-[11px] uppercase tracking-wider text-slate-500 dark:text-slate-400 font-semibold">
                    {entry.label}
                  </div>
                  <div className="text-xl font-black font-mono text-slate-900 dark:text-white mt-1">
                    {entry.value}
                  </div>
                </div>
              ))}
            </div>

            {/* Revenus des 14 derniers jours */}
            <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden">
              <div className="p-4 border-b border-slate-200 dark:border-slate-800">
                <h2 className="text-sm font-bold text-slate-900 dark:text-white">
                  Revenus des 14 derniers jours
                </h2>
              </div>
              {adminStats?.daily?.length ? (
                <div className="p-4 flex items-end gap-2 h-40 overflow-x-auto">
                  {adminStats.daily.map((day) => {
                    const max = Math.max(
                      ...adminStats.daily.map((entry) => entry.revenueXof),
                      1,
                    );
                    const height = Math.max(4, Math.round((day.revenueXof / max) * 120));
                    return (
                      <div key={day.day} className="flex flex-col items-center gap-1 shrink-0">
                        <div
                          className="w-6 rounded-t bg-emerald-600/70 dark:bg-emerald-500/70"
                          style={{ height }}
                          title={`${day.day} · ${xof(day.revenueXof)} · ${day.count} commandes`}
                        />
                        <span className="text-[10px] font-mono text-slate-500 dark:text-slate-400">
                          {day.day.slice(5)}
                        </span>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="p-4 text-xs text-slate-500 dark:text-slate-400">
                  Aucune commande sur la période.
                </p>
              )}
            </div>

            {/* Rentabilité par service */}
            <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden">
              <div className="p-4 border-b border-slate-200 dark:border-slate-800">
                <h2 className="text-sm font-bold text-slate-900 dark:text-white">
                  Rentabilité par service
                </h2>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  Calculée sur les commandes payées chargées ({adminOrders.length} max).
                </p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[640px] text-xs text-left">
                  <thead className="bg-slate-50 dark:bg-slate-950/60 text-slate-500 dark:text-slate-400 font-semibold border-b border-slate-200 dark:border-slate-800">
                    <tr>
                      <th className="py-2.5 px-4">Service</th>
                      <th className="py-2.5 px-4 text-right">Commandes</th>
                      <th className="py-2.5 px-4 text-right">CA brut</th>
                      <th className="py-2.5 px-4 text-right">Coût Ultra SMS</th>
                      <th className="py-2.5 px-4 text-right">Marge nette</th>
                      <th className="py-2.5 px-4 text-center">Conformité</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-mono">
                    {serviceRows.length === 0 && (
                      <tr>
                        <td colSpan={6} className="py-6 px-4 text-center text-slate-500 dark:text-slate-400 font-sans">
                          Aucune commande payée pour le moment.
                        </td>
                      </tr>
                    )}
                    {serviceRows.map((row) => {
                      const average = row.count > 0 ? row.margin / row.count : 0;
                      const compliant = average >= pricingConfig.targetMarginXof;
                      return (
                        <tr key={row.name} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                          <td className="py-3 px-4 font-sans font-bold text-slate-900 dark:text-white">
                            {row.name}
                          </td>
                          <td className="py-3 px-4 text-right">{row.count}</td>
                          <td className="py-3 px-4 text-right font-semibold">{xof(row.revenue)}</td>
                          <td className="py-3 px-4 text-right text-rose-600 dark:text-rose-400">
                            {xof(row.cost)}
                          </td>
                          <td className="py-3 px-4 text-right font-bold text-emerald-700 dark:text-emerald-400">
                            {xof(row.margin)}
                          </td>
                          <td className="py-3 px-4 text-center">
                            <span
                              className={`text-[11px] font-bold ${
                                compliant
                                  ? 'text-emerald-700 dark:text-emerald-400'
                                  : 'text-amber-700 dark:text-amber-400'
                              }`}
                            >
                              {xof(average)} / n° {compliant ? '✓' : '⚠'}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Remboursements fournisseur manuels */}
            {adminStats?.manualRefunds?.length ? (
              <div className="rounded-xl border border-rose-200 dark:border-rose-900/50 bg-white dark:bg-slate-900 overflow-hidden">
                <div className="p-4 border-b border-rose-200 dark:border-rose-900/50">
                  <h2 className="text-sm font-bold text-slate-900 dark:text-white">
                    Remboursements fournisseur à traiter manuellement
                  </h2>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    FedaPay n'expose pas de remboursement par API : le client a été recrédité sur son
                    portefeuille, la régularisation FedaPay reste à effectuer depuis le tableau de bord.
                  </p>
                </div>
                <div className="divide-y divide-slate-100 dark:divide-slate-800/60 text-xs">
                  {adminStats.manualRefunds.map((refund) => (
                    <div
                      key={refund.id}
                      className="p-3.5 flex flex-wrap items-center justify-between gap-2 font-mono"
                    >
                      <span className="font-bold text-slate-900 dark:text-white">
                        {refund.orderReference ?? shortId(refund.id)}
                      </span>
                      <span className="text-rose-600 dark:text-rose-400">{xof(refund.amountMinor)}</span>
                      <span className="text-slate-500 dark:text-slate-400">
                        {refund.provider} · {new Date(refund.createdAt).toLocaleString('fr-FR')}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        )}

        {/* TAB 2 : COMMANDES */}
        {adminTab === 'orders' && (
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden">
            <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h2 className="text-sm font-bold text-slate-900 dark:text-white">
                  Supervision des commandes
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Synchronisation fournisseur et remboursements portefeuille
                </p>
              </div>
              <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
                <div className="relative">
                  <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="search"
                    value={orderSearch}
                    onChange={(event) => setOrderSearch(event.target.value)}
                    placeholder="Référence, e-mail, numéro…"
                    className="w-full sm:w-56 pl-8 pr-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                  />
                </div>
                <select
                  value={orderStatus}
                  onChange={(event) => setOrderStatus(event.target.value as typeof orderStatus)}
                  className="py-2 px-3 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                >
                  <option value="ALL">Tous les statuts</option>
                  {(Object.keys(STATUS_LABELS) as Order['status'][]).map((status) => (
                    <option key={status} value={status}>
                      {STATUS_LABELS[status]}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[880px] text-xs text-left">
                <thead className="bg-slate-50 dark:bg-slate-950/60 text-slate-500 dark:text-slate-400 font-semibold border-b border-slate-200 dark:border-slate-800">
                  <tr>
                    <th className="py-2.5 px-4">Réf & date</th>
                    <th className="py-2.5 px-4">Client</th>
                    <th className="py-2.5 px-4">Service & numéro</th>
                    <th className="py-2.5 px-4 text-right">Prix client</th>
                    <th className="py-2.5 px-4 text-right">Coût Ultra SMS</th>
                    <th className="py-2.5 px-4 text-right">Marge nette</th>
                    <th className="py-2.5 px-4 text-center">Statut</th>
                    <th className="py-2.5 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-mono">
                  {filteredOrders.length === 0 && (
                    <tr>
                      <td colSpan={8} className="py-6 px-4 text-center text-slate-500 dark:text-slate-400 font-sans">
                        Aucune commande ne correspond aux filtres.
                      </td>
                    </tr>
                  )}
                  {filteredOrders.map((order) => (
                    <tr key={order.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                      <td className="py-3 px-4">
                        <div className="font-bold text-slate-900 dark:text-white">{order.reference}</div>
                        <div className="text-[11px] text-slate-500 dark:text-slate-400">
                          {new Date(order.createdAt).toLocaleString('fr-FR')}
                        </div>
                      </td>
                      <td className="py-3 px-4 font-sans text-slate-600 dark:text-slate-400">
                        {order.userEmail ?? shortId(order.userId)}
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-sans font-semibold text-slate-900 dark:text-white">
                          {order.serviceName} ({order.countryName})
                        </div>
                        <div className="text-emerald-700 dark:text-emerald-400 font-bold">
                          {order.phoneNumber ?? 'Non alloué'}
                        </div>
                      </td>
                      <td className="py-3 px-4 text-right font-bold text-slate-900 dark:text-white">
                        {xof(order.sellingPriceXof)}
                      </td>
                      <td className="py-3 px-4 text-right text-rose-600 dark:text-rose-400">
                        {xof(order.supplierCostXof)}
                      </td>
                      <td className="py-3 px-4 text-right font-bold text-emerald-700 dark:text-emerald-400">
                        +{xof(order.actualMarginXof)}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span
                          className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${STATUS_CLASSES[order.status]}`}
                        >
                          {STATUS_LABELS[order.status]}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center justify-end gap-2 font-sans">
                          <button
                            onClick={() => void handleSyncOrder(order)}
                            disabled={busyAction === `sync-${order.id}`}
                            className="p-1.5 rounded border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-50"
                            title="Synchroniser avec Ultra SMS"
                            aria-label={`Synchroniser ${order.reference}`}
                          >
                            <RotateCcw
                              className={`w-3.5 h-3.5 ${
                                busyAction === `sync-${order.id}` ? 'animate-spin' : ''
                              }`}
                            />
                          </button>
                          {REFUNDABLE_STATUSES.includes(order.status) && (
                            <button
                              onClick={() => void handleRefund(order)}
                              disabled={busyAction === `refund-${order.id}`}
                              className="px-2.5 py-1 text-[11px] font-semibold text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/20 rounded border border-rose-200 dark:border-rose-900 disabled:opacity-50"
                            >
                              Rembourser
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 3 : CATALOGUE */}
        {adminTab === 'catalog' && (
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden">
            <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
              <div>
                <h2 className="text-sm font-bold text-slate-900 dark:text-white">
                  Catalogue & coûts fournisseur
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {adminCatalogTotal.toLocaleString('fr-FR')} offre
                  {adminCatalogTotal > 1 ? 's' : ''} · prix client recalculés côté serveur.
                </p>
              </div>
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />
                  <input
                    type="text"
                    value={catalogSearchInput}
                    onChange={(event) => setCatalogSearchInput(event.target.value)}
                    placeholder="Pays, préfixe ou service…"
                    className="w-full sm:w-64 min-h-9 pl-8 pr-3 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <button
                  onClick={() =>
                    void runAction('catalog-sync', 'Synchronisation catalogue', () => syncCatalog())
                  }
                  disabled={busyAction === 'catalog-sync'}
                  className="px-3 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 rounded-lg flex items-center justify-center gap-2"
                >
                  <CloudDownload
                    className={`w-4 h-4 ${busyAction === 'catalog-sync' ? 'animate-bounce' : ''}`}
                  />
                  Synchroniser avec Ultra SMS
                </button>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[840px] text-xs text-left">
                <thead className="bg-slate-50 dark:bg-slate-950/60 text-slate-500 dark:text-slate-400 font-semibold border-b border-slate-200 dark:border-slate-800">
                  <tr>
                    <th className="py-2.5 px-4">Pays</th>
                    <th className="py-2.5 px-4">Service</th>
                    <th className="py-2.5 px-4">Type</th>
                    <th className="py-2.5 px-4">Stock</th>
                    <th className="py-2.5 px-4 text-right">Coût fournisseur (XOF)</th>
                    <th className="py-2.5 px-4 text-center">État</th>
                    <th className="py-2.5 px-4 text-right">Dernière synchro</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-mono">
                  {adminCatalog.length === 0 && (
                    <tr>
                      <td colSpan={7} className="py-6 px-4 text-center text-slate-500 dark:text-slate-400 font-sans">
                        Catalogue vide : lancez une synchronisation fournisseur.
                      </td>
                    </tr>
                  )}
                  {adminCatalog.map((item) => (
                    <tr key={item.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                      <td className="py-3 px-4 font-sans font-medium text-slate-800 dark:text-slate-200">
                        {item.countryName} ({item.prefix})
                      </td>
                      <td className="py-3 px-4 font-sans font-bold text-slate-900 dark:text-white">
                        {item.serviceName}
                      </td>
                      <td className="py-3 px-4 text-slate-500 dark:text-slate-400">
                        {item.type === 'TEMPORARY' ? 'Temporaire' : 'Location'}
                      </td>
                      <td className="py-3 px-4 text-slate-500 dark:text-slate-400">
                        {item.availableCount}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <input
                          type="number"
                          min="0"
                          step="50"
                          value={costDrafts[item.id] ?? item.supplierCostXof}
                          onChange={(event) =>
                            setCostDrafts((current) => ({
                              ...current,
                              [item.id]: Number(event.target.value),
                            }))
                          }
                          onBlur={() => void handleCatalogCostBlur(item.id, item.supplierCostXof)}
                          disabled={busyAction === `catalog-${item.id}`}
                          className="w-28 px-2 py-1 text-right font-mono text-xs rounded border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 disabled:opacity-50"
                          aria-label={`Coût fournisseur ${item.countryName} ${item.serviceName}`}
                        />
                      </td>
                      <td className="py-3 px-4 text-center">
                        <button
                          onClick={() =>
                            void runAction(`catalog-toggle-${item.id}`, 'État du catalogue', () =>
                              updateCatalogItem(item.id, { enabled: !item.enabled }),
                            )
                          }
                          disabled={busyAction === `catalog-toggle-${item.id}`}
                          className={`text-[11px] font-bold px-2 py-0.5 rounded-full disabled:opacity-50 ${
                            item.enabled
                              ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400'
                              : 'bg-slate-200 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
                          }`}
                        >
                          {item.enabled ? 'ACTIF' : 'SUSPENDU'}
                        </button>
                      </td>
                      <td className="py-3 px-4 text-right text-slate-500 dark:text-slate-400">
                        {item.lastSyncedAt
                          ? new Date(item.lastSyncedAt).toLocaleString('fr-FR')
                          : 'Jamais'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {adminCatalogHasMore && (
              <div className="p-4 border-t border-slate-200 dark:border-slate-800 flex justify-center">
                <button
                  onClick={() => void loadMoreAdminCatalog()}
                  disabled={adminCatalogLoadingMore}
                  className="px-4 py-2 text-xs font-semibold text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-950/40 hover:bg-indigo-100 dark:hover:bg-indigo-950/70 border border-indigo-200 dark:border-indigo-800 rounded-lg disabled:opacity-60"
                >
                  {adminCatalogLoadingMore
                    ? 'Chargement…'
                    : `Charger plus (${adminCatalog.length} / ${adminCatalogTotal})`}
                </button>
              </div>
            )}
          </div>
        )}

        {/* TAB 4 : UTILISATEURS */}
        {adminTab === 'users' && (
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden">
            <div className="p-4 border-b border-slate-200 dark:border-slate-800">
              <h2 className="text-sm font-bold text-slate-900 dark:text-white">Utilisateurs</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Rôles, suspension et réinitialisation des mots de passe. Vous ne pouvez pas
                modifier votre propre compte.
              </p>
            </div>
            {resetResult && (
              <div
                role="status"
                aria-live="polite"
                className="m-4 p-3 rounded-lg border border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-200 text-xs space-y-2"
              >
                <div className="font-bold">
                  Mot de passe temporaire pour {resetResult.email}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <code className="px-2 py-1 rounded bg-white/70 dark:bg-slate-900 font-mono text-sm select-all">
                    {resetResult.password}
                  </code>
                  <button
                    type="button"
                    onClick={() => {
                      void navigator.clipboard?.writeText(resetResult.password);
                      flash('success', 'Mot de passe copié dans le presse-papiers.');
                    }}
                    className="px-2.5 py-1 rounded-md bg-amber-600 text-white text-[11px] font-bold hover:bg-amber-700"
                  >
                    Copier
                  </button>
                  <button
                    type="button"
                    onClick={() => setResetResult(null)}
                    className="px-2.5 py-1 rounded-md border border-amber-400 dark:border-amber-700 text-[11px] font-bold hover:bg-amber-100 dark:hover:bg-amber-900/40"
                  >
                    Masquer
                  </button>
                </div>
                <p className="text-[11px]">
                  Affiché une seule fois : il ne sera plus visible après fermeture. Toutes les
                  sessions de ce compte ont été révoquées.
                </p>
              </div>
            )}
            <div className="overflow-x-auto">
              <table className="w-full min-w-[820px] text-xs text-left">
                <thead className="bg-slate-50 dark:bg-slate-950/60 text-slate-500 dark:text-slate-400 font-semibold border-b border-slate-200 dark:border-slate-800">
                  <tr>
                    <th className="py-2.5 px-4">Utilisateur</th>
                    <th className="py-2.5 px-4">Pays</th>
                    <th className="py-2.5 px-4 text-right">Commandes</th>
                    <th className="py-2.5 px-4 text-right">Solde XOF</th>
                    <th className="py-2.5 px-4">Rôle</th>
                    <th className="py-2.5 px-4 text-center">Statut</th>
                    <th className="py-2.5 px-4 text-right">Inscription</th>
                    <th className="py-2.5 px-4 text-right">Sécurité</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                  {adminUsers.length === 0 && (
                    <tr>
                      <td colSpan={8} className="py-6 px-4 text-center text-slate-500 dark:text-slate-400">
                        Aucun utilisateur chargé.
                      </td>
                    </tr>
                  )}
                  {adminUsers.map((user) => {
                    const walletXof =
                      user.wallets.find((entry) => entry.currency === 'XOF')?.balanceMinor ?? 0;
                    return (
                      <tr key={user.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                        <td className="py-3 px-4">
                          <div className="font-bold text-slate-900 dark:text-white">{user.name}</div>
                          <div className="font-mono text-[11px] text-slate-500 dark:text-slate-400">
                            {user.email}
                          </div>
                        </td>
                        <td className="py-3 px-4 text-slate-600 dark:text-slate-300">
                          {user.country ?? '—'}
                        </td>
                        <td className="py-3 px-4 text-right font-mono">{user.ordersCount}</td>
                        <td className="py-3 px-4 text-right font-mono">{xof(walletXof)}</td>
                        <td className="py-3 px-4">
                          <select
                            value={user.role}
                            onChange={(event) => void handleUserRole(user, event.target.value)}
                            disabled={busyAction === `user-role-${user.id}`}
                            className="text-xs rounded border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-2 py-1 text-slate-900 dark:text-slate-100 disabled:opacity-50"
                            aria-label={`Rôle de ${user.email}`}
                          >
                            <option value="CLIENT">Client</option>
                            <option value="SUPPORT">Support</option>
                            <option value="ADMIN">Admin</option>
                          </select>
                        </td>
                        <td className="py-3 px-4 text-center">
                          <button
                            onClick={() => void handleUserStatus(user)}
                            disabled={busyAction === `user-status-${user.id}`}
                            className={`text-[11px] font-bold px-2 py-0.5 rounded-full disabled:opacity-50 ${
                              user.status === 'ACTIVE'
                                ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400'
                                : 'bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:text-rose-400'
                            }`}
                          >
                            {user.status === 'ACTIVE' ? 'ACTIF' : 'SUSPENDU'}
                          </button>
                        </td>
                        <td className="py-3 px-4 text-right font-mono text-slate-500 dark:text-slate-400">
                          {new Date(user.createdAt).toLocaleDateString('fr-FR')}
                        </td>
                        <td className="py-3 px-4 text-right">
                          {currentUser?.id === user.id ? (
                            <span className="text-[11px] text-slate-400">Compte courant</span>
                          ) : (
                            <button
                              type="button"
                              onClick={() => void handleResetPassword(user)}
                              disabled={busyAction === `user-reset-${user.id}`}
                              className="text-[11px] font-bold px-2.5 py-1 rounded-md border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-50"
                            >
                              {busyAction === `user-reset-${user.id}`
                                ? 'Réinitialisation...'
                                : 'Réinitialiser'}
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 5 : RÈGLES DE PRIX */}
        {adminTab === 'pricing' && (
          <div className="max-w-2xl mx-auto rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 sm:p-8 space-y-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-indigo-500/10 text-indigo-600 flex items-center justify-center">
                <Sliders className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-base font-bold text-slate-900 dark:text-white">
                  Règle de marge & commissions
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  P = (C + F + FX + M) / (1 − r), appliqué côté serveur.
                </p>
              </div>
            </div>

            <form onSubmit={handleSavePricing} className="space-y-4 text-xs">
              <div>
                <label className="block font-bold text-slate-900 dark:text-white mb-1">
                  Marge nette cible par numéro vendu (M)
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min="2000"
                    step="100"
                    value={targetMarginInput}
                    onChange={(event) => setTargetMarginInput(Number(event.target.value))}
                    className="w-full text-base font-bold font-mono rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 p-2.5 text-slate-900 dark:text-slate-100"
                  />
                  <span className="font-mono text-slate-500 dark:text-slate-400 font-bold shrink-0">
                    XOF
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                  Minimum imposé : 2 000 XOF nets par vente.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Commission Mobile Money (%)
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    max="20"
                    value={momoRateInput}
                    onChange={(event) => setMomoRateInput(Number(event.target.value))}
                    className="w-full text-xs font-mono rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 p-2.5"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Commission Cartes (%)
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    max="20"
                    value={cardRateInput}
                    onChange={(event) => setCardRateInput(Number(event.target.value))}
                    className="w-full text-xs font-mono rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 p-2.5"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Commission Portefeuille (%)
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    max="20"
                    value={walletRateInput}
                    onChange={(event) => setWalletRateInput(Number(event.target.value))}
                    className="w-full text-xs font-mono rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 p-2.5"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Frais fixes par paiement (XOF)
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="50"
                    value={fixedFeeInput}
                    onChange={(event) => setFixedFeeInput(Number(event.target.value))}
                    className="w-full text-xs font-mono rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 p-2.5"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Pas d'arrondi supérieur
                  </label>
                  <select
                    value={roundingStepInput}
                    onChange={(event) => setRoundingStepInput(Number(event.target.value))}
                    className="w-full text-xs font-mono rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 p-2.5"
                  >
                    <option value="50">50 XOF</option>
                    <option value="100">100 XOF (conseillé)</option>
                    <option value="500">500 XOF</option>
                  </select>
                </div>
              </div>

              <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 font-mono text-[11px] text-slate-600 dark:text-slate-300 space-y-1">
                <div className="flex justify-between">
                  <span>Taux EUR → XOF</span>
                  <span>{exchangeRates.EUR_XOF.toLocaleString('fr-FR')}</span>
                </div>
                <div className="flex justify-between">
                  <span>Taux USD → XOF</span>
                  <span>{exchangeRates.USD_XOF.toLocaleString('fr-FR')}</span>
                </div>
                <div className="flex justify-between">
                  <span>Source</span>
                  <span>{exchangeRates.source ?? 'BCEAO / manuel'}</span>
                </div>
              </div>

              <button
                type="submit"
                disabled={busyAction === 'pricing'}
                className="w-full py-3 px-4 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 rounded-lg transition-colors shadow-sm"
              >
                {busyAction === 'pricing' ? 'Enregistrement…' : 'Sauvegarder les règles'}
              </button>
            </form>
          </div>
        )}

        {/* TAB 6 : FOURNISSEUR */}
        {adminTab === 'provider' && (
          <div className="max-w-2xl mx-auto rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 sm:p-8 space-y-6">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-500/10 text-blue-600 flex items-center justify-center">
                  <Server className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-slate-900 dark:text-white">
                    Fournisseur Ultra SMS
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Configuration serveur et solde revendeur
                  </p>
                </div>
              </div>
              <button
                onClick={() => void runAction('provider-refresh', 'Solde fournisseur', async () => {
                  await refreshProviderBalance();
                  return { success: true };
                })}
                disabled={busyAction === 'provider-refresh'}
                className="p-2 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-50"
                title="Rafraîchir le solde"
                aria-label="Rafraîchir le solde fournisseur"
              >
                <RefreshCw
                  className={`w-4 h-4 ${busyAction === 'provider-refresh' ? 'animate-spin' : ''}`}
                />
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 space-y-1">
                <div className="text-[11px] uppercase tracking-wider text-slate-500 dark:text-slate-400 font-semibold">
                  Mode
                </div>
                <div className="text-sm font-bold font-mono text-slate-900 dark:text-white">
                  {providerMode === 'live' ? 'PRODUCTION LIVE' : 'MOCK / TEST'}
                </div>
                <div className="text-[11px] text-slate-500 dark:text-slate-400">
                  Défini par <span className="font-mono">ULTRASMS_MODE</span> côté serveur.
                </div>
              </div>

              <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 space-y-1">
                <div className="text-[11px] uppercase tracking-wider text-slate-500 dark:text-slate-400 font-semibold">
                  Solde revendeur
                </div>
                <div className="text-sm font-bold font-mono text-emerald-700 dark:text-emerald-400">
                  {providerBalance
                    ? `${providerBalance.balance} ${providerBalance.currency}`
                    : 'Indisponible'}
                </div>
                <div className="text-[11px] text-slate-500 dark:text-slate-400">
                  {providerBalance
                    ? `${(providerBalance.balanceCents / 100).toFixed(2)} USD`
                    : 'Vérifiez la clé API et la connexion réseau.'}
                </div>
              </div>
            </div>

            <div className="space-y-2 text-xs">
              <label className="block font-medium text-slate-700 dark:text-slate-300">
                URL webhook de réception SMS
              </label>
              <input
                type="text"
                readOnly
                value={webhookUrl}
                className="w-full font-mono text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800/50 p-2.5 text-slate-500 dark:text-slate-400"
              />
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                À déclarer dans la console Ultra SMS. La signature HMAC est vérifiée côté serveur.
              </p>
            </div>

            <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-xs text-slate-600 dark:text-slate-300">
              La clé API Ultra SMS n'est jamais exposée au navigateur : elle est lue depuis{' '}
              <span className="font-mono">.env</span> par l'API. Pour la modifier, mettez à jour le
              secret serveur puis redémarrez l'API.
            </div>

            <button
              onClick={() =>
                void runAction('provider-sync-catalog', 'Synchronisation catalogue', () => syncCatalog())
              }
              disabled={busyAction === 'provider-sync-catalog'}
              className="w-full py-2.5 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 rounded-lg transition-colors flex items-center justify-center gap-2"
            >
              <CloudDownload className="w-4 h-4" />
              {busyAction === 'provider-sync-catalog'
                ? 'Synchronisation…'
                : 'Synchroniser le catalogue fournisseur'}
            </button>
          </div>
        )}

        {/* TAB 7 : AUDIT */}
        {adminTab === 'audit' && (
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden">
            <div className="p-4 border-b border-slate-200 dark:border-slate-800">
              <h2 className="text-sm font-bold text-slate-900 dark:text-white">
                Journal d'audit système & sécurité
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Traçabilité des opérations critiques, modifications tarifaires et commandes.
              </p>
            </div>

            <div className="divide-y divide-slate-100 dark:divide-slate-800/60 font-mono text-xs">
              {adminAudit.length === 0 && (
                <p className="p-4 text-slate-500 dark:text-slate-400 font-sans">
                  Aucune entrée d'audit.
                </p>
              )}
              {adminAudit.map((log) => (
                <div
                  key={log.id}
                  className="p-3.5 hover:bg-slate-50/50 dark:hover:bg-slate-800/30 flex items-start justify-between gap-4"
                >
                  <div className="space-y-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-bold text-indigo-600 dark:text-indigo-400">
                        {log.action}
                      </span>
                      <span className="text-[11px] text-slate-500 dark:text-slate-400">
                        [{log.entityType}]
                      </span>
                      <span className="text-slate-500 dark:text-slate-400 text-[11px]">
                        par {log.actor}
                      </span>
                      {log.ipAddress && (
                        <span className="text-[11px] text-slate-400 dark:text-slate-500">
                          {log.ipAddress}
                        </span>
                      )}
                    </div>
                    {log.metadata && (
                      <p className="font-sans text-[11px] text-slate-600 dark:text-slate-300 break-words">
                        {log.metadata}
                      </p>
                    )}
                  </div>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400 shrink-0">
                    {new Date(log.timestamp).toLocaleString('fr-FR')}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Pied de page discret */}
        <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 font-mono">
          <span className="flex items-center gap-1.5">
            <Wallet className="w-3.5 h-3.5" />
            Passerelle : {appConfig?.payments.mode ?? 'mock'}
          </span>
          <span className="flex items-center gap-1.5">
            <Eye className="w-3.5 h-3.5" />
            Données serveur actualisées
          </span>
        </div>
      </div>
    </div>
  );
};
