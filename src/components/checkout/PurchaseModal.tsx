import React, { useCallback, useEffect, useState } from 'react';
import { useModalBehavior } from '../../hooks/useModalBehavior';
import { useApp } from '../../context/AppContext';
import { resolveCheckoutRedirect } from '../../context/AppContext';
import {
  CatalogItem,
  MobileMoneyOperator,
  NumberType,
  PaymentMethod,
  PriceBreakdown,
  ServiceItem,
} from '../../types';
import {
  X,
  Smartphone,
  CreditCard,
  Wallet,
  ShieldCheck,
  CheckCircle2,
  ArrowRight,
  Loader2,
  AlertCircle,
  ExternalLink,
} from 'lucide-react';

interface PurchaseModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialCountryCode?: string;
  initialServiceId?: string;
  initialType?: NumberType;
  onSuccess: (orderId: string) => void;
  onRequireAuth?: () => void;
}

const PAID_STATUSES = ['PAID', 'PROCESSING', 'COMPLETED'];

export const PurchaseModal: React.FC<PurchaseModalProps> = ({
  isOpen,
  onClose,
  initialCountryCode = 'BJ',
  initialServiceId = 'whatsapp',
  initialType = 'TEMPORARY',
  onSuccess,
  onRequireAuth,
}) => {
  useModalBehavior(isOpen, onClose);

  const {
    countries,
    currency,
    wallet,
    quote,
    createOrder,
    verifyOrderPayment,
    getServicesForCountry,
    resolveCatalogItem,
    isAuthenticated,
  } = useApp();

  const [countryCode, setCountryCode] = useState(initialCountryCode);
  const [serviceId, setServiceId] = useState(initialServiceId);
  const [type, setType] = useState<NumberType>(initialType);
  const [serviceOptions, setServiceOptions] = useState<ServiceItem[]>([]);
  const [catalogItem, setCatalogItem] = useState<CatalogItem | null>(null);

  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('MOBILE_MONEY');
  const [mobileOperator, setMobileOperator] = useState<MobileMoneyOperator>('MTN');
  const [mobilePhone, setMobilePhone] = useState('');

  const [price, setPrice] = useState<PriceBreakdown | null>(null);
  const [priceLoading, setPriceLoading] = useState(false);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [step, setStep] = useState<'CONFIG' | 'GATEWAY_PROMPT' | 'SUCCESS'>('CONFIG');
  const [pendingOrderId, setPendingOrderId] = useState<string | null>(null);
  const [checkoutUrl, setCheckoutUrl] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState('');

  // Réinitialise la sélection quand la modale s'ouvre pour un autre produit.
  useEffect(() => {
    if (!isOpen) return;
    setCountryCode(initialCountryCode);
    setServiceId(initialServiceId);
    setType(initialType);
  }, [isOpen, initialCountryCode, initialServiceId, initialType]);

  // Les services dépendent du pays : on ne propose que des offres réelles.
  useEffect(() => {
    if (!isOpen || !countryCode) {
      setServiceOptions([]);
      return;
    }
    let cancelled = false;

    void getServicesForCountry(countryCode).then((list) => {
      if (cancelled) return;
      setServiceOptions(list);
      setServiceId((previous) =>
        list.some((service) => service.id === previous) ? previous : (list[0]?.id ?? ''),
      );
    });

    return () => {
      cancelled = true;
    };
  }, [isOpen, countryCode, getServicesForCountry]);

  // L'offre et son prix sont résolus côté serveur.
  useEffect(() => {
    if (!isOpen || !countryCode || !serviceId) {
      setCatalogItem(null);
      return;
    }
    let cancelled = false;

    void resolveCatalogItem({ countryCode, serviceId, type }).then((item) => {
      if (!cancelled) setCatalogItem(item);
    });

    return () => {
      cancelled = true;
    };
  }, [isOpen, countryCode, serviceId, type, resolveCatalogItem]);

  const quoteCurrency = paymentMethod === 'WALLET' ? 'XOF' : currency;

  // Le prix est toujours calculé côté serveur : aucun calcul local.
  useEffect(() => {
    if (!isOpen || !catalogItem) {
      setPrice(null);
      return;
    }
    let cancelled = false;
    setPriceLoading(true);
    quote(catalogItem.id, paymentMethod, quoteCurrency)
      .then((result) => {
        if (!cancelled) setPrice(result);
      })
      .catch(() => {
        if (!cancelled) setPrice(null);
      })
      .finally(() => {
        if (!cancelled) setPriceLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [isOpen, catalogItem, paymentMethod, quoteCurrency, quote]);

  const walletBalanceXof = wallet.balances.XOF;
  const walletCostXof = price?.sellingPriceXof ?? 0;
  const hasEnoughWalletBalance = walletBalanceXof >= walletCostXof;

  const finishSuccess = useCallback(
    (orderId: string) => {
      setStep('SUCCESS');
      setPendingOrderId(null);
      setIsSubmitting(false);
      window.setTimeout(() => {
        onSuccess(orderId);
        onClose();
      }, 1500);
    },
    [onClose, onSuccess],
  );

  // Polling : confirme le paiement dès que le fournisseur (ou la page mock)
  // a traité la transaction. Aucune simulation en production.
  useEffect(() => {
    if (step !== 'GATEWAY_PROMPT' || !pendingOrderId) return;
    let cancelled = false;

    const check = async () => {
      const result = await verifyOrderPayment(pendingOrderId);
      if (cancelled) return;
      if (result.success && result.order) {
        if (PAID_STATUSES.includes(result.order.status)) {
          finishSuccess(result.order.id);
          return;
        }
        if (result.order.status === 'CANCELLED' || result.order.status === 'FAILED') {
          setErrorMessage(
            result.order.failureReason ??
              result.order.cancellationReason ??
              'Le paiement a échoué. Vous pouvez réessayer.',
          );
          setPendingOrderId(null);
          setStep('CONFIG');
          setIsSubmitting(false);
        }
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
  }, [step, pendingOrderId, verifyOrderPayment, finishSuccess]);

  if (!isOpen) return null;

  const handleStartPayment = async () => {
    setErrorMessage('');

    if (!isAuthenticated) {
      onRequireAuth?.();
      onClose();
      return;
    }

    if (!catalogItem) {
      setErrorMessage("Ce numéro n'est pas disponible dans le catalogue actuel.");
      return;
    }

    if (paymentMethod === 'WALLET' && !hasEnoughWalletBalance) {
      setErrorMessage(
        `Solde XOF insuffisant. Solde : ${walletBalanceXof.toLocaleString('fr-FR')} XOF — ` +
          `montant requis : ${walletCostXof.toLocaleString('fr-FR')} XOF. Rechargez votre portefeuille.`,
      );
      return;
    }

    setIsSubmitting(true);

    // Ouvre un onglet vide immédiatement (sinon le navigateur bloque la popup
    // après l'appel réseau asynchrone).
    let paymentTab: Window | null = null;
    if (paymentMethod !== 'WALLET') {
      paymentTab = window.open('about:blank', '_blank');
    }

    try {
      const result = await createOrder({
        catalogItemId: catalogItem.id,
        paymentMethod,
        currency,
        mobileMoneyOperator: paymentMethod === 'MOBILE_MONEY' ? mobileOperator : undefined,
        mobileMoneyPhone: paymentMethod === 'MOBILE_MONEY' && mobilePhone ? mobilePhone : undefined,
      });

      if (!result.success || !result.order) {
        paymentTab?.close();
        setErrorMessage(result.error ?? 'Erreur lors du traitement.');
        setIsSubmitting(false);
        return;
      }

      const order = result.order;

      if (paymentMethod === 'WALLET') {
        finishSuccess(order.id);
        return;
      }

      const redirect = resolveCheckoutRedirect(result.checkoutUrl ?? order.checkoutUrl ?? null);
      if (!redirect) {
        paymentTab?.close();
        setErrorMessage(
          "La page de paiement n'a pas pu être ouverte. Réessayez depuis votre tableau de bord.",
        );
        setPendingOrderId(order.id);
        setStep('GATEWAY_PROMPT');
        setIsSubmitting(false);
        return;
      }

      setCheckoutUrl(redirect);
      setPendingOrderId(order.id);
      setStep('GATEWAY_PROMPT');
      if (paymentTab) paymentTab.location.href = redirect;
      else window.location.href = redirect;
    } catch {
      paymentTab?.close();
      setErrorMessage('Une erreur imprévue est survenue.');
      setIsSubmitting(false);
    }
  };

  const handleManualVerify = async () => {
    if (!pendingOrderId) return;
    setIsSubmitting(true);
    const result = await verifyOrderPayment(pendingOrderId);
    setIsSubmitting(false);
    if (result.success && result.order) {
      if (PAID_STATUSES.includes(result.order.status)) {
        finishSuccess(result.order.id);
        return;
      }
      setErrorMessage('Paiement toujours en attente de confirmation par l’opérateur.');
    } else {
      setErrorMessage(result.error ?? 'Impossible de vérifier le paiement pour le moment.');
    }
  };

  const currentCountry = countries.find((country) => country.code === countryCode);
  const currentService = serviceOptions.find((service) => service.id === serviceId);
  const displayTotal = price?.sellingPriceFormatted ?? '—';

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4 bg-slate-950/70 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="purchase-modal-title"
    >
      <div className="w-full max-w-xl rounded-t-2xl sm:rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden flex flex-col max-h-[92dvh] sm:max-h-[90vh] safe-bottom">
        <div className="sm:hidden mx-auto mt-2.5 mb-1 h-1 w-10 rounded-full bg-slate-300 dark:bg-slate-700 shrink-0" />

        {/* Modal Header */}
        <div className="sticky top-0 z-10 px-4 sm:px-6 py-3.5 sm:py-4 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-700 text-white flex items-center justify-center font-bold text-sm">
              <Smartphone className="w-4 h-4" />
            </div>
            <div>
              <h3
                id="purchase-modal-title"
                className="text-sm font-bold text-slate-900 dark:text-white"
              >
                Commande de Numéro Virtuel
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Fournisseur Ultra SMS · Durée de réception : 20 min
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 -mr-1 rounded-lg text-slate-500 dark:text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors disabled:opacity-50"
            aria-label="Fermer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Content */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-5 text-xs text-slate-600 dark:text-slate-300">
          {step === 'CONFIG' && (
            <>
              {/* Product Summary Box */}
              <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[11px] font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider block mb-1">
                    Pays
                  </label>
                  <select
                    value={countryCode}
                    onChange={(event) => setCountryCode(event.target.value)}
                    className="w-full text-xs font-semibold rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 p-2"
                  >
                    {countries.map((country) => (
                      <option key={country.code} value={country.code}>
                        {country.flag} {country.name} ({country.prefix})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-[11px] font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider block mb-1">
                    Service
                  </label>
                  <select
                    value={serviceId}
                    onChange={(event) => setServiceId(event.target.value)}
                    className="w-full text-xs font-semibold rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 p-2"
                  >
                    {serviceOptions.length === 0 && (
                      <option value="">Aucun service disponible</option>
                    )}
                    {serviceOptions.map((service) => (
                      <option key={service.id} value={service.id}>
                        {service.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {!catalogItem && (
                <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-700 dark:text-amber-400 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>
                    Aucune offre active pour {currentCountry?.name ?? countryCode} /{' '}
                    {currentService?.name ?? serviceId}. Choisissez une autre combinaison.
                  </span>
                </div>
              )}

              {/* Payment Method Selector */}
              <div>
                <label className="block text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider mb-2">
                  Choisissez votre mode de paiement
                </label>
                <div className="grid grid-cols-3 gap-2.5">
                  <button
                    onClick={() => setPaymentMethod('MOBILE_MONEY')}
                    className={`p-3 rounded-xl border text-left transition-all ${
                      paymentMethod === 'MOBILE_MONEY'
                        ? 'border-emerald-600 bg-emerald-50/50 dark:bg-emerald-950/20 text-slate-900 dark:text-white ring-1 ring-emerald-600'
                        : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/50'
                    }`}
                  >
                    <Smartphone className="w-5 h-5 text-amber-500 mb-1.5" />
                    <div className="font-bold text-xs">Mobile Money</div>
                    <div className="text-[11px] text-slate-500 dark:text-slate-400 font-mono mt-0.5">
                      MTN, Moov, Celtiis
                    </div>
                  </button>

                  <button
                    onClick={() => setPaymentMethod('CARD')}
                    className={`p-3 rounded-xl border text-left transition-all ${
                      paymentMethod === 'CARD'
                        ? 'border-emerald-600 bg-emerald-50/50 dark:bg-emerald-950/20 text-slate-900 dark:text-white ring-1 ring-emerald-600'
                        : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/50'
                    }`}
                  >
                    <CreditCard className="w-5 h-5 text-blue-500 mb-1.5" />
                    <div className="font-bold text-xs">Carte Bancaire</div>
                    <div className="text-[11px] text-slate-500 dark:text-slate-400 font-mono mt-0.5">
                      Visa, Mastercard (3DS)
                    </div>
                  </button>

                  <button
                    onClick={() => setPaymentMethod('WALLET')}
                    className={`p-3 rounded-xl border text-left transition-all ${
                      paymentMethod === 'WALLET'
                        ? 'border-emerald-600 bg-emerald-50/50 dark:bg-emerald-950/20 text-slate-900 dark:text-white ring-1 ring-emerald-600'
                        : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/50'
                    }`}
                  >
                    <Wallet className="w-5 h-5 text-emerald-500 mb-1.5" />
                    <div className="font-bold text-xs">Portefeuille</div>
                    <div className="text-[11px] text-slate-500 dark:text-slate-400 font-mono mt-0.5">
                      {walletBalanceXof.toLocaleString('fr-FR')} XOF
                    </div>
                  </button>
                </div>
              </div>

              {/* Sub-form based on chosen payment method */}
              {paymentMethod === 'MOBILE_MONEY' && (
                <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-slate-800 dark:text-slate-200">
                      Opérateur Mobile Money
                    </span>
                    <span className="text-[11px] font-mono text-emerald-700 dark:text-emerald-400">
                      Paiement sécurisé FedaPay
                    </span>
                  </div>

                  <div className="grid grid-cols-3 gap-2">
                    {(['MTN', 'MOOV', 'CELTIIS'] as MobileMoneyOperator[]).map((operator) => (
                      <button
                        key={operator}
                        type="button"
                        onClick={() => setMobileOperator(operator)}
                        className={`py-2 px-3 rounded-lg border text-xs font-semibold text-center transition-colors ${
                          mobileOperator === operator
                            ? 'border-amber-500 bg-amber-500/10 text-amber-800 dark:text-amber-300 font-bold'
                            : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300'
                        }`}
                      >
                        {operator === 'MTN'
                          ? '🟡 MTN MoMo'
                          : operator === 'MOOV'
                            ? '🔵 Moov Flooz'
                            : '🟢 Celtiis SBIN'}
                      </button>
                    ))}
                  </div>

                  <div>
                    <label className="block text-[11px] font-medium text-slate-500 dark:text-slate-400 mb-1">
                      Numéro Mobile Money (optionnel, pour la notification)
                    </label>
                    <input
                      type="tel"
                      value={mobilePhone}
                      onChange={(event) => setMobilePhone(event.target.value)}
                      placeholder="+229 97 00 00 00"
                      className="w-full text-xs font-mono rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-2.5 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                </div>
              )}

              {paymentMethod === 'CARD' && (
                <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-slate-800 dark:text-slate-200">
                      Carte Bancaire Sécurisée
                    </span>
                    <span className="text-[11px] font-mono text-blue-500">3D Secure v2</span>
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    Les informations de votre carte sont saisies exclusivement sur la page
                    sécurisée FedaPay. Numivo ne stocke aucune donnée bancaire.
                  </p>
                </div>
              )}

              {paymentMethod === 'WALLET' && (
                <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-slate-800 dark:text-slate-200">
                      Paiement par Solde Interne (XOF)
                    </span>
                    <span className="text-[11px] font-mono text-emerald-700 font-bold">
                      Sans frais de commission
                    </span>
                  </div>
                  <div className="flex items-baseline justify-between text-xs pt-1">
                    <span className="text-slate-500 dark:text-slate-400">Votre solde disponible :</span>
                    <span className="font-bold font-mono text-slate-900 dark:text-white">
                      {walletBalanceXof.toLocaleString('fr-FR')} XOF
                    </span>
                  </div>
                  {!hasEnoughWalletBalance && (
                    <p className="text-[11px] text-rose-500 pt-1">
                      Votre solde est insuffisant pour finaliser cet achat. Rechargez votre
                      portefeuille ou utilisez Mobile Money / carte bancaire.
                    </p>
                  )}
                </div>
              )}

              {/* Price Breakdown Summary (serveur) */}
              <div className="p-4 rounded-xl bg-slate-100 dark:bg-slate-950/80 border border-slate-200 dark:border-slate-800 flex items-center justify-between">
                <div>
                  <div className="text-[11px] text-slate-600 dark:text-slate-400 font-mono uppercase">
                    Total à payer ({price?.currency ?? quoteCurrency})
                  </div>
                  <div className="text-xl font-black font-mono text-emerald-700 dark:text-emerald-400">
                    {priceLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : displayTotal}
                  </div>
                  {paymentMethod === 'WALLET' && price && (
                    <div className="text-[10px] text-slate-500 dark:text-slate-400 font-mono">
                      Débit de {price.sellingPriceXof.toLocaleString('fr-FR')} XOF
                    </div>
                  )}
                </div>
                <div className="text-right text-[11px] text-slate-600 dark:text-slate-400 font-mono">
                  <div>Prix calculé côté serveur</div>
                  <div className="text-emerald-700 dark:text-emerald-400">
                    Garantie remboursement 100%
                  </div>
                </div>
              </div>

              {errorMessage && (
                <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{errorMessage}</span>
                </div>
              )}

              {/* Submit CTA */}
              <button
                onClick={handleStartPayment}
                disabled={isSubmitting || priceLoading || !catalogItem || !price}
                className="w-full py-3.5 px-4 text-xs font-bold text-white bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 rounded-xl transition-all shadow-md flex items-center justify-center gap-2"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Création de la commande...</span>
                  </>
                ) : (
                  <>
                    <span>Confirmer et Payer {displayTotal}</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>

              <p className="flex items-center justify-center gap-1.5 text-[11px] text-slate-500 dark:text-slate-400">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                Paiement traité par FedaPay · Aucune donnée bancaire stockée par Numivo
              </p>
            </>
          )}

          {/* STEP 2: PAIEMENT EN COURS */}
          {step === 'GATEWAY_PROMPT' && (
            <div className="py-8 text-center space-y-5">
              <div className="w-16 h-16 rounded-2xl bg-amber-500/10 text-amber-500 mx-auto flex items-center justify-center animate-pulse">
                <Smartphone className="w-8 h-8" />
              </div>
              <div>
                <h4 className="text-base font-bold text-slate-900 dark:text-white">
                  Finalisez le paiement
                </h4>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-2 max-w-sm mx-auto">
                  Une page de paiement sécurisée a été ouverte dans un nouvel onglet. Validez le
                  débit, puis revenez ici : la commande sera confirmée automatiquement.
                </p>
              </div>

              <div className="p-4 rounded-xl bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs space-y-2 max-w-sm mx-auto text-left">
                <div className="flex justify-between font-mono text-[11px] text-slate-500 dark:text-slate-400">
                  <span>Commande</span>
                  <span>{pendingOrderId?.slice(0, 12)}…</span>
                </div>
                <div className="font-semibold text-slate-900 dark:text-white">
                  Montant : {displayTotal}
                </div>
                <div className="flex items-center gap-1.5 text-[11px] text-amber-600 dark:text-amber-400">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  En attente de la confirmation du prestataire…
                </div>
              </div>

              {errorMessage && (
                <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 text-xs flex items-center gap-2 max-w-sm mx-auto text-left">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{errorMessage}</span>
                </div>
              )}

              <div className="flex flex-wrap gap-3 justify-center pt-2">
                {checkoutUrl && (
                  <a
                    href={checkoutUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-4 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors inline-flex items-center gap-2"
                  >
                    <ExternalLink className="w-4 h-4" />
                    Rouvrir la page de paiement
                  </a>
                )}
                <button
                  onClick={handleManualVerify}
                  disabled={isSubmitting}
                  className="px-5 py-2 text-xs font-bold text-white bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 rounded-lg transition-colors flex items-center gap-2 shadow-sm"
                >
                  {isSubmitting ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <CheckCircle2 className="w-4 h-4" />
                  )}
                  J’ai payé, vérifier
                </button>
              </div>
            </div>
          )}

          {/* STEP 3: SUCCESS */}
          {step === 'SUCCESS' && (
            <div className="py-12 text-center space-y-4">
              <div className="w-16 h-16 rounded-full bg-emerald-500/10 text-emerald-500 mx-auto flex items-center justify-center">
                <CheckCircle2 className="w-10 h-10" />
              </div>
              <h4 className="text-lg font-bold text-slate-900 dark:text-white">
                Paiement confirmé !
              </h4>
              <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
                Votre numéro virtuel est en cours d’allocation par Ultra SMS. Redirection vers
                votre espace client…
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
