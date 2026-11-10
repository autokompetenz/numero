import React, { useState, useEffect } from 'react';
import { useApp, resolveCheckoutRedirect } from '../../context/AppContext';
import { Currency, Order } from '../../types';
import {
  Smartphone,
  MessageSquare,
  Wallet,
  Clock,
  Copy,
  Check,
  RefreshCw,
  AlertTriangle,
  FileText,
  PlusCircle,
  HelpCircle,
  ShieldCheck,
  Send,
  Download,
  Printer,
  ChevronRight,
  Sparkles,
} from 'lucide-react';

interface ClientDashboardProps {
  onOpenBuyModal: () => void;
  selectedOrderId?: string;
}

export const ClientDashboard: React.FC<ClientDashboardProps> = ({
  onOpenBuyModal,
  selectedOrderId,
}) => {
  const {
    orders,
    wallet,
    currency,
    setCurrency,
    currentUser,
    appConfig,
    simulateSmsReception,
    resendSms,
    cancelAndRefundOrder,
    startTopUp,
    verifyTopUpPayment,
    refreshOrders,
  } = useApp();

  const [activeTab, setActiveTab] = useState<'numbers' | 'wallet' | 'history' | 'support'>('numbers');
  const [copiedText, setCopiedText] = useState<string | null>(null);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [invoiceModalOrder, setInvoiceModalOrder] = useState<Order | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  // Wallet deposit modal state (recharges FedaPay : XOF uniquement)
  const [depositModalOpen, setDepositModalOpen] = useState(false);
  const [depositAmount, setDepositAmount] = useState<number>(5000);
  const [depositPaymentMethod, setDepositPaymentMethod] = useState<'MOBILE_MONEY' | 'CARD'>(
    'MOBILE_MONEY',
  );
  const [depositStatus, setDepositStatus] = useState<'idle' | 'pending' | 'success' | 'error'>('idle');
  const [depositError, setDepositError] = useState('');
  const [topUpPaymentId, setTopUpPaymentId] = useState<string | null>(null);
  const [topUpCheckoutUrl, setTopUpCheckoutUrl] = useState<string | null>(null);
  const [isDepositing, setIsDepositing] = useState(false);

  const isMockMode = appConfig?.ultrasms.mode === 'mock';

  // Sync selectedOrderId if passed
  useEffect(() => {
    if (selectedOrderId) {
      const match = orders.find((o) => o.id === selectedOrderId);
      if (match) {
        setSelectedOrder(match);
        setActiveTab('numbers');
      }
    } else if (!selectedOrder && orders.length > 0) {
      setSelectedOrder(orders[0]);
    }
  }, [selectedOrderId, orders]);

  // Keep selectedOrder in sync with app context updates
  useEffect(() => {
    if (selectedOrder) {
      const updated = orders.find((o) => o.id === selectedOrder.id);
      if (updated) setSelectedOrder(updated);
    }
  }, [orders]);

  // Polling du rechargement FedaPay : confirmation dès que le webhook/statut passe.
  useEffect(() => {
    if (depositStatus !== 'pending' || !topUpPaymentId) return;
    let cancelled = false;

    const check = async () => {
      const payment = await verifyTopUpPayment(topUpPaymentId);
      if (cancelled || !payment) return;
      if (payment.status === 'APPROVED') {
        setDepositStatus('success');
        setTopUpPaymentId(null);
        setDepositError('');
      } else if (['DECLINED', 'CANCELED', 'FAILED'].includes(payment.status)) {
        setDepositStatus('error');
        setDepositError('Le rechargement a été refusé ou annulé.');
        setTopUpPaymentId(null);
      }
    };

    void check();
    const interval = window.setInterval(() => {
      if (document.visibilityState === 'visible') void check();
    }, 3000);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [depositStatus, topUpPaymentId, verifyTopUpPayment]);

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedText(text);
    setTimeout(() => setCopiedText(null), 2000);
  };

  const handleDepositSubmit = async () => {
    setDepositError('');
    if (!Number.isFinite(depositAmount) || depositAmount < 500) {
      setDepositError('Le montant minimum de rechargement est de 500 XOF.');
      return;
    }
    if (depositAmount > 1_000_000) {
      setDepositError('Le montant maximum de rechargement est de 1 000 000 XOF.');
      return;
    }

    setIsDepositing(true);
    const paymentTab = window.open('about:blank', '_blank');

    const result = await startTopUp(Math.round(depositAmount), depositPaymentMethod);
    setIsDepositing(false);

    if (!result.success || !result.payment) {
      paymentTab?.close();
      setDepositError(result.error ?? 'Impossible de démarrer le rechargement.');
      setDepositStatus('error');
      return;
    }

    const redirect = resolveCheckoutRedirect(result.checkoutUrl ?? null);
    setTopUpCheckoutUrl(redirect);
    setTopUpPaymentId(result.payment.id);
    setDepositStatus('pending');

    if (redirect) {
      if (paymentTab) paymentTab.location.href = redirect;
      else window.location.href = redirect;
    } else {
      paymentTab?.close();
    }
  };

  const openTopUp = () => {
    setDepositAmount(5000);
    setDepositPaymentMethod('MOBILE_MONEY');
    setDepositStatus('idle');
    setDepositError('');
    setTopUpPaymentId(null);
    setTopUpCheckoutUrl(null);
    setDepositModalOpen(true);
  };

  const handleSimulateSms = async (orderId: string) => {
    const ok = await simulateSmsReception(orderId);
    setActionMessage(
      ok ? 'SMS de test injecté avec succès.' : 'Impossible de simuler le SMS (mode production).',
    );
    window.setTimeout(() => setActionMessage(null), 4000);
  };

  const handleResendSms = async (orderId: string) => {
    const ok = await resendSms(orderId);
    setActionMessage(
      ok ? 'Relance de réception demandée.' : 'La relance a échoué ou la fenêtre est expirée.',
    );
    window.setTimeout(() => setActionMessage(null), 4000);
  };

  const handleCancelOrder = async (orderId: string) => {
    const ok = await cancelAndRefundOrder(orderId);
    setActionMessage(
      ok
        ? 'Commande annulée et montant recrédité sur votre portefeuille XOF.'
        : "Annulation impossible (la fenêtre d'annulation est peut-être expirée).",
    );
    window.setTimeout(() => setActionMessage(null), 5000);
    await refreshOrders();
  };

  const activeOrders = orders.filter(
    (o) => o.status === 'PROCESSING' || o.status === 'PAID' || o.status === 'COMPLETED',
  );
  const waitingSmsCount = orders.filter((o) => o.status === 'PROCESSING').length;

  const statusLabel = (status: Order['status']): string => {
    switch (status) {
      case 'PENDING_PAYMENT':
        return 'PAIEMENT EN ATTENTE';
      case 'PAID':
        return 'PAYÉ';
      case 'PROCESSING':
        return 'EN ATTENTE SMS';
      case 'COMPLETED':
        return 'SMS REÇU';
      case 'CANCELLED':
        return 'ANNULÉ';
      case 'REFUNDED':
        return 'REMBOURSÉ';
      case 'FAILED':
        return 'ÉCHEC';
      default:
        return status;
    }
  };

  const statusClass = (status: Order['status']): string => {
    switch (status) {
      case 'COMPLETED':
        return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400';
      case 'PROCESSING':
      case 'PAID':
        return 'bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300';
      case 'REFUNDED':
      case 'CANCELLED':
        return 'bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:text-rose-400';
      case 'FAILED':
        return 'bg-rose-100 text-rose-800 dark:bg-rose-950/40 dark:text-rose-300';
      default:
        return 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300';
    }
  };

  return (
    <div className="py-8 bg-slate-50 dark:bg-slate-950 min-h-[calc(100vh-4rem)]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6">
        
        {/* Workspace Top Banner */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-200 dark:border-slate-800">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
              <span>Espace Client Sécurisé</span>
              <span aria-hidden="true">·</span>
              <span>Compte : {currentUser?.email || '—'}</span>
              {currentUser?.name && (
                <>
                  <span aria-hidden="true">·</span>
                  <span>{currentUser.name}</span>
                </>
              )}
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white mt-1">
              Tableau de Bord Client
            </h1>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
            <button
              onClick={openTopUp}
              className="inline-flex items-center justify-center gap-1.5 min-h-10 px-3.5 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
            >
              <PlusCircle className="w-4 h-4 text-emerald-500" />
              <span>Recharger Portefeuille</span>
            </button>

            <button
              onClick={onOpenBuyModal}
              className="inline-flex items-center justify-center gap-1.5 min-h-10 px-4 py-2 text-xs font-bold text-white bg-emerald-700 hover:bg-emerald-800 rounded-lg transition-colors shadow-sm"
            >
              <Smartphone className="w-4 h-4" />
              <span>Acheter un Nouveau Numéro</span>
            </button>
          </div>
        </div>

        {/* Metric Cards Row */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          
          <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
            <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 text-xs">
              <span>Numéros Actifs</span>
              <Smartphone className="w-4 h-4 text-emerald-500" />
            </div>
            <div className="text-lg min-[420px]:text-xl sm:text-2xl font-black font-mono text-slate-900 dark:text-white mt-2">
              {activeOrders.length}
            </div>
            <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
              {waitingSmsCount} en attente de SMS
            </div>
          </div>

          <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
            <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 text-xs">
              <span>Solde Portefeuille (XOF)</span>
              <Wallet className="w-4 h-4 text-amber-500" />
            </div>
            <div className="text-lg min-[420px]:text-xl sm:text-2xl font-black font-mono text-slate-900 dark:text-white mt-2">
              {wallet.balances.XOF.toLocaleString('fr-FR')} CFA
            </div>
            <div className="text-[11px] text-emerald-700 dark:text-emerald-400 mt-1">
              Disponible pour achat 1-clic
            </div>
          </div>

          <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
            <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 text-xs">
              <span>Soldes Internationaux</span>
              <span className="font-mono text-xs text-blue-600 dark:text-blue-400 font-bold">EUR / USD</span>
            </div>
            <div className="text-xl font-bold font-mono text-slate-900 dark:text-white mt-2">
              {wallet.balances.EUR.toFixed(2)} € · ${wallet.balances.USD.toFixed(2)}
            </div>
            <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
              Comptes multi-devises cloisonnés
            </div>
          </div>

          <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
            <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 text-xs">
              <span>Total SMS Reçus</span>
              <MessageSquare className="w-4 h-4 text-indigo-500" />
            </div>
            <div className="text-lg min-[420px]:text-xl sm:text-2xl font-black font-mono text-slate-900 dark:text-white mt-2">
              {orders.reduce((acc, curr) => acc + curr.smsMessages.length, 0)}
            </div>
            <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
              Vérifications complétées
            </div>
          </div>

        </div>

        {actionMessage && (
          <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 dark:text-emerald-400 text-xs flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 shrink-0" />
            <span>{actionMessage}</span>
          </div>
        )}

        {/* Tab Navigation Controls */}
        <div className="-mx-4 px-4 sm:mx-0 sm:px-0 flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 overflow-x-auto scrollbar-none snap-x">
          {[
            { id: 'numbers', label: 'Mes Numéros & SMS en Direct', icon: Smartphone, count: activeOrders.length },
            { id: 'wallet', label: 'Portefeuille & Recharges', icon: Wallet },
            { id: 'history', label: 'Historique des Commandes & Factures', icon: FileText, count: orders.length },
            { id: 'support', label: 'Support & Assistance', icon: HelpCircle },
          ].map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center gap-2 px-3 sm:px-4 py-3 text-xs font-bold border-b-2 transition-all whitespace-nowrap shrink-0 snap-start ${
                  activeTab === tab.id
                    ? 'border-emerald-600 text-emerald-700 dark:text-emerald-400'
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

        {/* TAB 1: MES NUMÉROS & SMS EN DIRECT */}
        {activeTab === 'numbers' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            
            {/* Left list of active/recent orders */}
            <div className="lg:col-span-5 space-y-3">
              <div className="flex items-center justify-between text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">
                <span>Vos numéros commandés</span>
                <span>{orders.length} au total</span>
              </div>

              {orders.length === 0 ? (
                <div className="p-8 text-center rounded-xl border border-dashed border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
                  <Smartphone className="w-8 h-8 text-slate-500 dark:text-slate-400 mx-auto mb-2" />
                  <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">Aucun numéro commandé</p>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">Commandez un numéro virtuel pour commencer.</p>
                  <button
                    onClick={onOpenBuyModal}
                    className="mt-4 px-3 py-1.5 text-xs font-bold text-white bg-emerald-700 rounded-lg hover:bg-emerald-800 transition-colors"
                  >
                    Acheter maintenant
                  </button>
                </div>
              ) : (
                <div className="space-y-2">
                  {orders.map((ord) => (
                    <button
                      key={ord.id}
                      onClick={() => setSelectedOrder(ord)}
                      className={`w-full text-left p-3.5 rounded-xl border transition-all ${
                        selectedOrder?.id === ord.id
                          ? 'border-emerald-600 bg-emerald-50/40 dark:bg-emerald-950/20 shadow-xs'
                          : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800/50'
                      }`}
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-xs text-slate-900 dark:text-white">
                              {ord.serviceName}
                            </span>
                            <span className="text-[11px] text-slate-500 dark:text-slate-400">({ord.countryName})</span>
                          </div>
                          <div className="text-xs font-mono font-bold text-emerald-700 dark:text-emerald-400 mt-1">
                            {ord.phoneNumber || 'En cours d\'allocation...'}
                          </div>
                        </div>

                        {/* Status Badge */}
                        <div className="text-right">
                          <span
                            className={`text-[11px] font-mono font-semibold px-2 py-0.5 rounded-full ${statusClass(
                              ord.status,
                            )}`}
                          >
                            {statusLabel(ord.status)}
                          </span>
                          <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 font-mono">
                            {ord.smsMessages.length} SMS
                          </div>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Right: Live SMS Terminal for selected order */}
            <div className="lg:col-span-7">
              {selectedOrder ? (
                <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-md overflow-hidden">
                  
                  {/* Terminal Header */}
                  <div className="p-5 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-extrabold text-base text-slate-900 dark:text-white">
                          {selectedOrder.serviceName} - {selectedOrder.countryName}
                        </span>
                        <span className="text-xs font-mono text-slate-500 dark:text-slate-400">
                          Ref: {selectedOrder.reference}
                        </span>
                      </div>
                      
                      {/* Virtual Phone with Copy Button */}
                      <div className="flex items-center gap-3 mt-2">
                        <span className="text-xl font-black font-mono text-slate-900 dark:text-white tracking-wide">
                          {selectedOrder.phoneNumber || 'Allocation en cours…'}
                        </span>
                        <button
                          onClick={() => handleCopy(selectedOrder.phoneNumber || '')}
                          disabled={!selectedOrder.phoneNumber}
                          className="px-2.5 py-1 text-xs font-semibold rounded-md bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 transition-colors flex items-center gap-1 disabled:opacity-50"
                          title="Copier le numéro"
                        >
                          {copiedText === selectedOrder.phoneNumber ? (
                            <>
                              <Check className="w-3.5 h-3.5 text-emerald-500" />
                              <span className="text-emerald-700 dark:text-emerald-400">Copié</span>
                            </>
                          ) : (
                            <>
                              <Copy className="w-3.5 h-3.5" />
                              <span>Copier</span>
                            </>
                          )}
                        </button>
                      </div>
                    </div>

                    {/* Expiration Timer & Simulate button */}
                    <div className="flex flex-col sm:items-end gap-2">
                      <div className="flex items-center gap-1.5 text-xs text-amber-800 dark:text-amber-300 font-mono bg-amber-50 dark:bg-amber-950/30 px-2.5 py-1 rounded-md border border-amber-200 dark:border-amber-800/40">
                        <Clock className="w-3.5 h-3.5" />
                        <span>Fenêtre active : 20 min</span>
                      </div>

                      {selectedOrder.status === 'PROCESSING' && (
                        <div className="flex flex-wrap items-center gap-3 sm:justify-end">
                          {isMockMode && (
                            <button
                              onClick={() => handleSimulateSms(selectedOrder.id)}
                              className="text-[11px] font-semibold text-emerald-700 dark:text-emerald-400 hover:underline flex items-center gap-1"
                            >
                              <RefreshCw className="w-3 h-3" />
                              <span>Simuler réception SMS (test)</span>
                            </button>
                          )}
                          <button
                            onClick={() => handleResendSms(selectedOrder.id)}
                            className="text-[11px] font-semibold text-slate-600 dark:text-slate-300 hover:underline flex items-center gap-1"
                          >
                            <Send className="w-3 h-3" />
                            <span>Relancer la réception</span>
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* SMS Stream Body */}
                  <div className="p-6 space-y-4">
                    <div className="flex items-center justify-between text-xs font-bold text-slate-900 dark:text-white">
                      <span>Messages SMS reçus ({selectedOrder.smsMessages.length})</span>
                      <span className="text-[11px] text-slate-500 dark:text-slate-400 font-normal">
                        Mise à jour en temps réel via Webhook Ultra SMS
                      </span>
                    </div>

                    {selectedOrder.smsMessages.length === 0 ? (
                      <div className="py-12 text-center rounded-xl border border-dashed border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/40 p-6 space-y-3">
                        <div className="w-10 h-10 rounded-full bg-amber-500/10 text-amber-500 mx-auto flex items-center justify-center animate-spin">
                          <RefreshCw className="w-5 h-5" />
                        </div>
                        <div>
                          <p className="text-xs font-bold text-slate-800 dark:text-slate-200">
                            En attente du SMS de vérification...
                          </p>
                          <p className="text-[11px] text-slate-500 dark:text-slate-400 max-w-sm mx-auto mt-1">
                            Saisissez le numéro <strong className="font-mono text-slate-700 dark:text-slate-300">{selectedOrder.phoneNumber}</strong> dans l'application {selectedOrder.serviceName}. Le SMS s'affichera ici dès son arrivée.
                          </p>
                        </div>

                        {/* Guarantee / Cancel option */}
                        {['PENDING_PAYMENT', 'PAID', 'PROCESSING', 'FAILED'].includes(
                          selectedOrder.status,
                        ) && (
                          <div className="pt-2">
                            <button
                              onClick={() => handleCancelOrder(selectedOrder.id)}
                              className="px-3.5 py-1.5 text-xs font-semibold text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/20 rounded-lg transition-colors border border-rose-200 dark:border-rose-900"
                            >
                              Annuler et Recréditer mon Solde Immédiatement
                            </button>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {selectedOrder.smsMessages.map((sms) => (
                          <div
                            key={sms.id}
                            className="p-4 rounded-xl border border-emerald-500/30 bg-emerald-50/20 dark:bg-emerald-950/10 space-y-3"
                          >
                            <div className="flex items-center justify-between text-xs">
                              <span className="font-bold text-emerald-700 dark:text-emerald-400 flex items-center gap-1.5">
                                <ShieldCheck className="w-4 h-4 text-emerald-500" />
                                <span>Expéditeur : {sms.sender}</span>
                              </span>
                              <span className="text-[11px] text-slate-500 dark:text-slate-400 font-mono">
                                {new Date(sms.receivedAt).toLocaleTimeString('fr-FR')}
                              </span>
                            </div>

                            <p className="text-xs text-slate-700 dark:text-slate-300 font-mono bg-white dark:bg-slate-900 p-3 rounded-lg border border-slate-200 dark:border-slate-800">
                              {sms.messageText}
                            </p>

                            {/* Extracted OTP Code Highlight Box */}
                            {sms.extractedOtpCode && (
                              <div className="p-3 bg-white dark:bg-slate-900 rounded-lg border border-emerald-200 dark:border-emerald-800 flex items-center justify-between">
                                <div>
                                  <div className="text-[11px] text-slate-500 dark:text-slate-400 uppercase font-mono tracking-wider">
                                    Code de vérification extrait (OTP)
                                  </div>
                                  <div className="text-lg min-[420px]:text-xl sm:text-2xl font-black font-mono text-emerald-700 dark:text-emerald-400 tracking-wider">
                                    {sms.extractedOtpCode}
                                  </div>
                                </div>

                                <button
                                  onClick={() => handleCopy(sms.extractedOtpCode || '')}
                                  className="px-4 py-2 text-xs font-bold text-white bg-emerald-700 hover:bg-emerald-800 rounded-lg transition-colors flex items-center gap-1.5 shadow-xs"
                                >
                                  {copiedText === sms.extractedOtpCode ? (
                                    <>
                                      <Check className="w-3.5 h-3.5" />
                                      <span>Copié !</span>
                                    </>
                                  ) : (
                                    <>
                                      <Copy className="w-3.5 h-3.5" />
                                      <span>Copier le Code</span>
                                    </>
                                  )}
                                </button>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Order Financial Footnote */}
                    <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 font-mono">
                      <span>Facturé : {selectedOrder.sellingPriceCurrency} {selectedOrder.currency}</span>
                      <button
                        onClick={() => setInvoiceModalOrder(selectedOrder)}
                        className="text-emerald-700 dark:text-emerald-400 hover:underline flex items-center gap-1"
                      >
                        <FileText className="w-3 h-3" />
                        <span>Télécharger le reçu</span>
                      </button>
                    </div>

                  </div>

                </div>
              ) : (
                <div className="p-12 text-center rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
                  <p className="text-xs text-slate-500 dark:text-slate-400">Sélectionnez un numéro dans la liste pour voir les SMS reçus.</p>
                </div>
              )}
            </div>

          </div>
        )}

        {/* TAB 2: PORTEFEUILLE MULTI-DEVISES */}
        {activeTab === 'wallet' && (
          <div className="space-y-6">
            
            {/* 3 Wallets Cards (XOF, EUR, USD) */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              
              <div className="p-6 rounded-2xl border border-emerald-500/40 bg-white dark:bg-slate-900 shadow-sm relative overflow-hidden">
                <div className="flex justify-between items-start">
                  <div>
                    <span className="text-xs font-bold text-emerald-700 dark:text-emerald-400 uppercase tracking-wider">
                      Portefeuille Principal
                    </span>
                    <h3 className="text-base font-bold text-slate-900 dark:text-white mt-0.5">
                      Franc CFA (XOF)
                    </h3>
                  </div>
                  <div className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-700 flex items-center justify-center font-bold text-xs">
                    CFA
                  </div>
                </div>

                <div className="text-3xl font-black font-mono text-slate-900 dark:text-white my-4">
                  {wallet.balances.XOF.toLocaleString('fr-FR')} XOF
                </div>

                <button
                  onClick={openTopUp}
                  className="w-full py-2.5 text-xs font-bold text-white bg-emerald-700 hover:bg-emerald-800 rounded-lg transition-colors flex items-center justify-center gap-1.5"
                >
                  <PlusCircle className="w-4 h-4" />
                  <span>Recharger par Mobile Money (MTN/Moov)</span>
                </button>
              </div>

              <div className="p-6 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm">
                <div className="flex justify-between items-start">
                  <div>
                    <span className="text-xs font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wider">
                      Portefeuille International
                    </span>
                    <h3 className="text-base font-bold text-slate-900 dark:text-white mt-0.5">
                      Euro (EUR)
                    </h3>
                  </div>
                  <div className="w-8 h-8 rounded-lg bg-blue-500/10 text-blue-600 flex items-center justify-center font-bold text-xs">
                    €
                  </div>
                </div>

                <div className="text-3xl font-black font-mono text-slate-900 dark:text-white my-4">
                  {wallet.balances.EUR.toFixed(2)} €
                </div>

                <button
                  onClick={openTopUp}
                  className="w-full py-2.5 text-xs font-bold text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-colors flex items-center justify-center gap-1.5"
                >
                  <PlusCircle className="w-4 h-4" />
                  <span>Recharger par Carte Visa/Mastercard</span>
                </button>
              </div>

              <div className="p-6 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm">
                <div className="flex justify-between items-start">
                  <div>
                    <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider">
                      Portefeuille International
                    </span>
                    <h3 className="text-base font-bold text-slate-900 dark:text-white mt-0.5">
                      Dollar US (USD)
                    </h3>
                  </div>
                  <div className="w-8 h-8 rounded-lg bg-indigo-500/10 text-indigo-600 flex items-center justify-center font-bold text-xs">
                    $
                  </div>
                </div>

                <div className="text-3xl font-black font-mono text-slate-900 dark:text-white my-4">
                  ${wallet.balances.USD.toFixed(2)}
                </div>

                <button
                  onClick={openTopUp}
                  className="w-full py-2.5 text-xs font-bold text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-colors flex items-center justify-center gap-1.5"
                >
                  <PlusCircle className="w-4 h-4" />
                  <span>Créditer mon portefeuille (XOF)</span>
                </button>
              </div>

            </div>

            {/* Ledger Transactions Table */}
            <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden">
              <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                    Registre Comptable Immuable (Journal Financier)
                  </h3>
                  <p className="text-xs text-slate-500">
                    Traçabilité stricte : dépôts, achats et remboursements
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <div className="hidden sm:flex items-center gap-1 rounded-lg border border-slate-200 dark:border-slate-700 p-0.5">
                    {(['XOF', 'EUR', 'USD'] as Currency[]).map((code) => (
                      <button
                        key={code}
                        onClick={() => setCurrency(code)}
                        className={`px-2 py-1 text-[11px] font-bold rounded-md transition-colors ${
                          currency === code
                            ? 'bg-emerald-700 text-white'
                            : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                        }`}
                      >
                        {code}
                      </button>
                    ))}
                  </div>
                  <div className="text-xs font-mono text-emerald-700 dark:text-emerald-400">
                    {wallet.transactions.length} écritures
                  </div>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full min-w-[640px] text-xs text-left">
                  <thead className="bg-slate-50 dark:bg-slate-950/60 text-slate-500 font-semibold border-b border-slate-200 dark:border-slate-800">
                    <tr>
                      <th className="py-2.5 px-4">Date & Réf</th>
                      <th className="py-2.5 px-4">Type</th>
                      <th className="py-2.5 px-4">Description</th>
                      <th className="py-2.5 px-4">Mode</th>
                      <th className="py-2.5 px-4 text-right">Montant</th>
                      <th className="py-2.5 px-4 text-right">Solde Après</th>
                      <th className="py-2.5 px-4 text-center">Statut</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-mono">
                    {wallet.transactions.map((tx) => (
                      <tr key={tx.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                        <td className="py-3 px-4">
                          <div className="font-semibold text-slate-900 dark:text-white">
                            {tx.reference}
                          </div>
                          <div className="text-[11px] text-slate-500 dark:text-slate-400">
                            {new Date(tx.date).toLocaleDateString('fr-FR')} {new Date(tx.date).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <span
                            className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${
                              tx.type === 'DEPOSIT'
                                ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300'
                                : tx.type === 'REFUND'
                                ? 'bg-blue-100 text-blue-800 dark:bg-blue-950/40 dark:text-blue-300'
                                : 'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-300'
                            }`}
                          >
                            {tx.type}
                          </span>
                        </td>
                        <td className="py-3 px-4 font-sans text-slate-700 dark:text-slate-300">
                          {tx.description}
                        </td>
                        <td className="py-3 px-4 font-sans text-slate-500">
                          {tx.paymentMethod || '-'}
                        </td>
                        <td className={`py-3 px-4 text-right font-bold ${tx.amount > 0 ? 'text-emerald-700 dark:text-emerald-400' : 'text-slate-700 dark:text-slate-300'}`}>
                          {tx.amount > 0 ? `+${tx.amount.toLocaleString('fr-FR')}` : tx.amount.toLocaleString('fr-FR')} {tx.currency}
                        </td>
                        <td className="py-3 px-4 text-right text-slate-500">
                          {tx.balanceAfter.toLocaleString('fr-FR')} {tx.currency}
                        </td>
                        <td className="py-3 px-4 text-center">
                          <span className="text-[11px] font-semibold text-emerald-700 dark:text-emerald-400">
                            CONFIRMÉ ✓
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

            </div>

          </div>
        )}

        {/* TAB 3: HISTORIQUE DES COMMANDES */}
        {activeTab === 'history' && (
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden">
            <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  Historique Complet de vos Commandes
                </h3>
                <p className="text-xs text-slate-500">
                  Consultez vos numéros passés, reçus et factures d'achat
                </p>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-xs text-left">
                <thead className="bg-slate-50 dark:bg-slate-950/60 text-slate-500 font-semibold border-b border-slate-200 dark:border-slate-800">
                  <tr>
                    <th className="py-3 px-4">Commande</th>
                    <th className="py-3 px-4">Service</th>
                    <th className="py-3 px-4">Numéro Virtuel</th>
                    <th className="py-3 px-4">Montant Payé</th>
                    <th className="py-3 px-4">Moyen de Paiement</th>
                    <th className="py-3 px-4 text-center">Statut</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-mono">
                  {orders.map((ord) => (
                    <tr key={ord.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                      <td className="py-3 px-4">
                        <div className="font-bold text-slate-900 dark:text-white">{ord.reference}</div>
                        <div className="text-[11px] text-slate-500 dark:text-slate-400">
                          {new Date(ord.createdAt).toLocaleDateString('fr-FR')}
                        </div>
                      </td>
                      <td className="py-3 px-4 font-sans font-semibold text-slate-800 dark:text-slate-200">
                        {ord.serviceName} ({ord.countryName})
                      </td>
                      <td className="py-3 px-4 font-bold text-emerald-700 dark:text-emerald-400">
                        {ord.phoneNumber || 'En attente'}
                      </td>
                      <td className="py-3 px-4 font-bold text-slate-900 dark:text-white">
                        {ord.sellingPriceCurrency} {ord.currency}
                      </td>
                      <td className="py-3 px-4 font-sans text-slate-600 dark:text-slate-400">
                        {ord.paymentMethod === 'MOBILE_MONEY'
                          ? `Mobile Money (${ord.mobileMoneyOperator || 'MTN'})`
                          : ord.paymentMethod === 'CARD'
                          ? 'Carte Bancaire'
                          : 'Portefeuille'}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span
                          className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${
                            ord.status === 'COMPLETED'
                              ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300'
                              : ord.status === 'PROCESSING'
                              ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300'
                              : ord.status === 'REFUNDED'
                              ? 'bg-rose-100 text-rose-800 dark:bg-rose-950/40 dark:text-rose-300'
                              : 'bg-slate-100 text-slate-800'
                          }`}
                        >
                          {ord.status}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => {
                              setSelectedOrder(ord);
                              setActiveTab('numbers');
                            }}
                            className="px-2.5 py-1 text-xs font-semibold text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 rounded-md hover:bg-slate-200 font-sans"
                          >
                            Voir SMS
                          </button>
                          <button
                            onClick={() => setInvoiceModalOrder(ord)}
                            className="p-1 text-slate-500 dark:text-slate-400 hover:text-emerald-500 rounded"
                            title="Télécharger la facture"
                          >
                            <FileText className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 4: SUPPORT & TICKETS */}
        {activeTab === 'support' && (
          <div className="max-w-3xl mx-auto rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-8 space-y-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-700 flex items-center justify-center">
                <HelpCircle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  Centre d'Assistance Client Numivo
                </h3>
                <p className="text-xs text-slate-500">
                  Équipe disponible 7j/7 pour vous assister sur vos activations SMS et paiements
                </p>
              </div>
            </div>

            <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs space-y-2">
              <p className="font-semibold text-slate-900 dark:text-white">
                Rappel de la Politique de Remboursement Automatique :
              </p>
              <p className="text-slate-600 dark:text-slate-400">
                Si un numéro temporaire ne reçoit aucun SMS dans sa fenêtre de 20 minutes, vous pouvez cliquer sur <strong>"Annuler et Recréditer"</strong> directement depuis l'écran "Mes Numéros". Le montant intégral sera recrédité sur votre portefeuille sans intervention humaine.
              </p>
            </div>

            <div className="space-y-4 text-xs">
              <div>
                <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Commande concernée (optionnel) :
                </label>
                <select className="w-full text-xs font-mono rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 p-2.5">
                  <option value="">Sélectionner une commande...</option>
                  {orders.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.reference} - {o.serviceName} ({o.phoneNumber})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Message à l'équipe support :
                </label>
                <textarea
                  rows={4}
                  placeholder="Décrivez votre question ou le souci rencontré..."
                  className="w-full text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 p-3 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <button
                onClick={() => alert('Votre ticket de support a été transmis à l\'équipe Numivo. Un agent vous répondra sous 15 minutes.')}
                className="px-5 py-2.5 text-xs font-bold text-white bg-emerald-700 hover:bg-emerald-800 rounded-lg transition-colors flex items-center gap-2"
              >
                <Send className="w-4 h-4" />
                <span>Envoyer ma demande</span>
              </button>
            </div>
          </div>
        )}

      </div>

      {/* DEPOSIT MODAL */}
      {depositModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4 bg-slate-950/70 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-labelledby="deposit-modal-title"
        >
          <div className="w-full max-w-md max-h-[92dvh] overflow-y-auto rounded-t-2xl sm:rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl p-5 sm:p-6 space-y-4 safe-bottom">
            <h3 id="deposit-modal-title" className="text-sm font-bold text-slate-900 dark:text-white">
              Recharger mon Portefeuille Numivo
            </h3>
            <p className="text-xs text-slate-500">
              Les recharges FedaPay sont réglées en XOF et créditées sur votre portefeuille
              principal. Minimum 500 XOF, maximum 1 000 000 XOF.
            </p>

            {depositStatus === 'pending' ? (
              <div className="py-6 text-center space-y-4">
                <div className="w-14 h-14 rounded-2xl bg-amber-500/10 text-amber-500 mx-auto flex items-center justify-center animate-pulse">
                  <Wallet className="w-7 h-7" />
                </div>
                <div>
                  <p className="text-sm font-bold text-slate-900 dark:text-white">
                    Rechargement en attente
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                    Validez le paiement dans l’onglet sécurisé, la confirmation est automatique.
                  </p>
                </div>
                <div className="flex flex-wrap gap-2 justify-center">
                  {topUpCheckoutUrl && (
                    <a
                      href={topUpCheckoutUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-3.5 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
                    >
                      Rouvrir la page de paiement
                    </a>
                  )}
                  <button
                    onClick={() => {
                      setDepositStatus('idle');
                      setTopUpPaymentId(null);
                    }}
                    className="px-3.5 py-2 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg"
                  >
                    Annuler
                  </button>
                </div>
              </div>
            ) : depositStatus === 'success' ? (
              <div className="py-6 text-center space-y-4">
                <div className="w-14 h-14 rounded-full bg-emerald-500/10 text-emerald-500 mx-auto flex items-center justify-center">
                  <Check className="w-8 h-8" />
                </div>
                <div>
                  <p className="text-sm font-bold text-slate-900 dark:text-white">
                    Portefeuille rechargé
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                    Votre nouveau solde XOF est disponible immédiatement.
                  </p>
                </div>
                <button
                  onClick={() => setDepositModalOpen(false)}
                  className="px-4 py-2 text-xs font-bold text-white bg-emerald-700 hover:bg-emerald-800 rounded-lg"
                >
                  Fermer
                </button>
              </div>
            ) : (
              <>
                <div className="space-y-3 text-xs">
                  <div>
                    <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                      Montant à créditer (XOF) :
                    </label>
                    <input
                      type="number"
                      min="500"
                      max="1000000"
                      step="500"
                      value={depositAmount}
                      onChange={(e) => setDepositAmount(Number(e.target.value))}
                      className="w-full text-base font-bold font-mono rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 p-2.5 text-slate-900 dark:text-slate-100"
                    />
                  </div>

                  <div>
                    <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                      Mode de règlement du rechargement :
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setDepositPaymentMethod('MOBILE_MONEY')}
                        className={`p-2.5 rounded-lg border text-left text-xs font-semibold ${
                          depositPaymentMethod === 'MOBILE_MONEY'
                            ? 'border-emerald-600 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300'
                            : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'
                        }`}
                      >
                        Mobile Money
                        <div className="text-[11px] font-normal text-slate-500">MTN · Moov · Celtiis</div>
                      </button>
                      <button
                        type="button"
                        onClick={() => setDepositPaymentMethod('CARD')}
                        className={`p-2.5 rounded-lg border text-left text-xs font-semibold ${
                          depositPaymentMethod === 'CARD'
                            ? 'border-emerald-600 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300'
                            : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'
                        }`}
                      >
                        Carte bancaire
                        <div className="text-[11px] font-normal text-slate-500">Visa · Mastercard</div>
                      </button>
                    </div>
                  </div>

                  {depositError && (
                    <div className="p-2.5 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 shrink-0" />
                      <span>{depositError}</span>
                    </div>
                  )}
                </div>

                <div className="flex gap-2 justify-end pt-3 border-t border-slate-100 dark:border-slate-800">
                  <button
                    onClick={() => setDepositModalOpen(false)}
                    className="px-3.5 py-2 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg"
                  >
                    Annuler
                  </button>
                  <button
                    onClick={handleDepositSubmit}
                    disabled={isDepositing || depositAmount <= 0}
                    className="px-4 py-2 text-xs font-bold text-white bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 rounded-lg transition-colors"
                  >
                    {isDepositing
                      ? 'Traitement...'
                      : `Confirmer le rechargement (${depositAmount.toLocaleString('fr-FR')} XOF)`}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* INVOICE / RECEIPT MODAL */}
      {invoiceModalOrder && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4 bg-slate-950/70 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-labelledby="invoice-modal-title"
        >
          <div className="w-full max-w-lg max-h-[92dvh] overflow-y-auto rounded-t-2xl sm:rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl p-5 sm:p-6 space-y-5 safe-bottom">
            
            <div className="flex justify-between items-start border-b border-slate-200 dark:border-slate-800 pb-4">
              <div>
                <div id="invoice-modal-title" className="text-base font-bold text-slate-900 dark:text-white">Numivo Technologies</div>
                <div className="text-[11px] text-slate-500 dark:text-slate-400">Reçu Officiel d'Achat Télécom</div>
              </div>
              <div className="text-right font-mono text-xs">
                <div className="font-bold text-emerald-700">{invoiceModalOrder.reference}</div>
                <div className="text-[11px] text-slate-500 dark:text-slate-400">
                  {new Date(invoiceModalOrder.createdAt).toLocaleDateString('fr-FR')}
                </div>
              </div>
            </div>

            <div className="text-xs space-y-2 font-mono">
              <div className="flex justify-between text-slate-500">
                <span>Client :</span>
                <span className="text-slate-900 dark:text-white">{invoiceModalOrder.userEmail}</span>
              </div>
              <div className="flex justify-between text-slate-500">
                <span>Service :</span>
                <span className="text-slate-900 dark:text-white">{invoiceModalOrder.serviceName} ({invoiceModalOrder.countryName})</span>
              </div>
              <div className="flex justify-between text-slate-500">
                <span>Numéro alloué :</span>
                <span className="text-emerald-700 font-bold">{invoiceModalOrder.phoneNumber}</span>
              </div>
              <div className="flex justify-between text-slate-500">
                <span>Fournisseur grossiste :</span>
                <span className="text-slate-900 dark:text-white">Ultra SMS Infrastructure</span>
              </div>
              <div className="flex justify-between text-slate-500">
                <span>Mode de paiement :</span>
                <span className="text-slate-900 dark:text-white">{invoiceModalOrder.paymentMethod}</span>
              </div>
              <div className="flex justify-between text-slate-500 pt-2 border-t border-slate-200 dark:border-slate-800 font-bold text-sm">
                <span>Montant Net Débité :</span>
                <span className="text-emerald-700">{invoiceModalOrder.sellingPriceCurrency} {invoiceModalOrder.currency}</span>
              </div>
            </div>

            <div className="p-3 bg-slate-50 dark:bg-slate-950 rounded-lg text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
              Ce document atteste de la mise à disposition d'un numéro virtuel temporaire conformément aux CGU de Numivo. TVA non applicable ou acquittée à la source.
            </div>

            <div className="flex justify-between items-center pt-2">
              <button
                onClick={() => window.print()}
                className="px-3 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 rounded-lg flex items-center gap-1.5"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Imprimer</span>
              </button>
              <button
                onClick={() => setInvoiceModalOrder(null)}
                className="px-4 py-1.5 text-xs font-bold text-white bg-slate-900 dark:bg-slate-700 rounded-lg"
              >
                Fermer
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
};
