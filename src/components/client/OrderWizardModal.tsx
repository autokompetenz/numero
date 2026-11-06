/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { calculateSellingPrice, formatCurrency } from '../../services/pricingEngine';
import { PaymentMethod, MobileMoneyOperator, Currency } from '../../types';
import {
  X,
  ShieldCheck,
  Check,
  ArrowRight,
  Smartphone,
  CreditCard,
  Wallet as WalletIcon,
  AlertCircle,
  Loader2,
  Lock,
} from 'lucide-react';

interface OrderWizardModalProps {
  initialCountryCode?: string;
  initialServiceId?: string;
  onClose: () => void;
  onOrderSuccess: (orderId: string) => void;
}

export const OrderWizardModal: React.FC<OrderWizardModalProps> = ({
  initialCountryCode = 'BJ',
  initialServiceId = 'whatsapp',
  onClose,
  onOrderSuccess,
}) => {
  const {
    countries,
    services,
    currency,
    pricingConfig,
    exchangeRates,
    wallets,
    currentUser,
    createOrder,
  } = useApp();

  const [step, setStep] = useState<number>(1);
  const [countryCode, setCountryCode] = useState<string>(initialCountryCode);
  const [serviceId, setServiceId] = useState<string>(initialServiceId);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('MOBILE_MONEY');
  const [momoOperator, setMomoOperator] = useState<MobileMoneyOperator>('MTN');
  const [momoPhone, setMomoPhone] = useState<string>('97 12 34 56');

  // Card form state
  const [cardNumber, setCardNumber] = useState<string>('4242 4242 4242 4242');
  const [cardExp, setCardExp] = useState<string>('12/28');
  const [cardCvv, setCardCvv] = useState<string>('821');

  // Loading & Simulation state
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [simulationStepText, setSimulationStepText] = useState<string>('');

  const selectedCountry = countries.find((c) => c.code === countryCode) || countries[0];
  const selectedService = services.find((s) => s.id === serviceId) || services[0];

  const currentWallet = wallets.find(
    (w) => w.userId === (currentUser?.id || 'user_client_1') && w.currency === currency
  );

  // Live price quote
  const quote = calculateSellingPrice({
    supplierCostXof: selectedService.baseSupplierCostXof,
    paymentMethod,
    config: pricingConfig,
    targetCurrency: currency,
    rates: exchangeRates,
  });

  const hasEnoughWalletBalance = currentWallet ? currentWallet.balanceMinor >= quote.displayPrice : false;

  const handleConfirmPayment = async () => {
    setIsProcessing(true);

    if (paymentMethod === 'MOBILE_MONEY') {
      setSimulationStepText(`Connexion à la passerelle FedaPay (${momoOperator})...`);
      await new Promise((r) => setTimeout(r, 1200));
      setSimulationStepText(`Envoi de la requête Push USSD au +229 ${momoPhone}...`);
      await new Promise((r) => setTimeout(r, 1500));
      setSimulationStepText(`Validation du code secret PIN reçue via Webhook sécurisé...`);
      await new Promise((r) => setTimeout(r, 1000));
    } else if (paymentMethod === 'CARD') {
      setSimulationStepText('Connexion sécurisée TLS 1.3 au serveur bancaire...');
      await new Promise((r) => setTimeout(r, 1200));
      setSimulationStepText('Validation du protocole 3D Secure / OTP SMS bancaire...');
      await new Promise((r) => setTimeout(r, 1500));
    } else {
      setSimulationStepText('Débit atomique du portefeuille multi-devises...');
      await new Promise((r) => setTimeout(r, 800));
    }

    setSimulationStepText('Attribution du numéro virtuel auprès de Num Fast...');
    const result = await createOrder({
      countryCode,
      serviceId,
      paymentMethod,
      paymentOperator: paymentMethod === 'MOBILE_MONEY' ? momoOperator : undefined,
      phoneInput: momoPhone,
    });

    setIsProcessing(false);

    if (result.success && result.order) {
      onOrderSuccess(result.order.id);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-neutral-950/75 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-white dark:bg-neutral-900 border-t sm:border border-neutral-200 dark:border-neutral-800 rounded-t-3xl sm:rounded-2xl max-w-xl w-full shadow-2xl overflow-hidden flex flex-col max-h-[92vh] sm:max-h-[88vh]">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-neutral-200 dark:border-neutral-800 flex items-center justify-between shrink-0">
          <div>
            <span className="text-[10px] sm:text-[11px] uppercase font-bold tracking-wider text-emerald-600 dark:text-emerald-400">
              Étape {step} sur 2 · Commande sécurisée
            </span>
            <h3 className="text-base sm:text-lg font-bold text-neutral-900 dark:text-white">
              {step === 1 ? 'Configuration du numéro' : 'Mode de paiement & confirmation'}
            </h3>
          </div>
          <button
            onClick={onClose}
            disabled={isProcessing}
            aria-label="Fermer la boîte de dialogue"
            className="w-10 h-10 rounded-xl text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 flex items-center justify-center hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-4 sm:space-y-5 text-xs flex-1">
          {isProcessing ? (
            <div className="py-12 sm:py-16 flex flex-col items-center justify-center text-center space-y-4">
              <div className="w-14 h-14 rounded-full border-3 border-emerald-600 border-t-transparent animate-spin flex items-center justify-center">
                <Lock className="w-6 h-6 text-emerald-600" />
              </div>
              <div>
                <h4 className="text-base sm:text-lg font-bold text-neutral-900 dark:text-white">
                  Traitement du paiement en cours...
                </h4>
                <p className="text-xs text-neutral-500 mt-1 font-mono">{simulationStepText}</p>
              </div>
              <div className="p-3 bg-neutral-50 dark:bg-neutral-800 rounded-xl text-[11px] text-neutral-500 max-w-sm">
                Vérification d’idempotence et attribution automatique du numéro virtuel auprès de l'API Num Fast.
              </div>
            </div>
          ) : step === 1 ? (
            /* STEP 1: SERVICE & COUNTRY */
            <div className="space-y-4">
              {/* Country Selection */}
              <div>
                <label className="block font-semibold text-neutral-800 dark:text-neutral-200 mb-1.5">
                  1. Choisissez le pays du numéro
                </label>
                <select
                  value={countryCode}
                  onChange={(e) => setCountryCode(e.target.value)}
                  className="w-full bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-xl p-3 text-base sm:text-xs font-medium text-neutral-900 dark:text-white focus:ring-2 focus:ring-emerald-500 focus:outline-none min-h-[44px]"
                >
                  {countries.map((c) => (
                    <option key={c.code} value={c.code}>
                      {c.flag} {c.name} ({c.dialCode}) — {c.availableServicesCount} services disponibles
                    </option>
                  ))}
                </select>
              </div>

              {/* Service Selection */}
              <div>
                <label className="block font-semibold text-neutral-800 dark:text-neutral-200 mb-1.5">
                  2. Service / Plateforme à valider
                </label>
                <select
                  value={serviceId}
                  onChange={(e) => setServiceId(e.target.value)}
                  className="w-full bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-xl p-3 text-base sm:text-xs font-medium text-neutral-900 dark:text-white focus:ring-2 focus:ring-emerald-500 focus:outline-none min-h-[44px]"
                >
                  {services.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} (Taux de succès {s.successRate}%)
                    </option>
                  ))}
                </select>
                <p className="text-[11px] text-neutral-500 mt-1.5">
                  {selectedService.description}
                </p>
              </div>

              {/* Summary Card */}
              <div className="bg-neutral-50 dark:bg-neutral-850 border border-neutral-200 dark:border-neutral-800 rounded-xl p-4 space-y-2.5 mt-4">
                <div className="flex justify-between items-center text-neutral-500">
                  <span>Activation :</span>
                  <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                    Immédiate (Stock garanti)
                  </span>
                </div>
                <div className="flex justify-between items-center text-neutral-500">
                  <span>Délai de validité :</span>
                  <span className="font-medium text-neutral-800 dark:text-neutral-200">
                    20 minutes
                  </span>
                </div>
                <div className="flex justify-between items-center text-neutral-500">
                  <span>Garantie :</span>
                  <span className="font-medium text-neutral-800 dark:text-neutral-200">
                    Recrédit 100% si aucun SMS reçu
                  </span>
                </div>
                <div className="pt-2.5 border-t border-neutral-200 dark:border-neutral-700 flex justify-between items-baseline">
                  <span className="font-bold text-neutral-900 dark:text-white">Prix total TTC ({currency}) :</span>
                  <span className="text-xl sm:text-2xl font-bold font-mono text-neutral-900 dark:text-white tabular-nums">
                    {quote.displayFormatted}
                  </span>
                </div>
              </div>
            </div>
          ) : (
            /* STEP 2: PAYMENT METHOD */
            <div className="space-y-4 sm:space-y-5">
              <div>
                <label className="block font-semibold text-neutral-800 dark:text-neutral-200 mb-2">
                  Choisissez votre méthode de règlement
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-2.5">
                  <button
                    type="button"
                    onClick={() => setPaymentMethod('MOBILE_MONEY')}
                    className={`p-3 rounded-xl border text-left transition-all cursor-pointer min-h-[52px] ${
                      paymentMethod === 'MOBILE_MONEY'
                        ? 'border-emerald-600 bg-emerald-50/70 dark:bg-emerald-950/60 ring-1 ring-emerald-600'
                        : 'border-neutral-200 dark:border-neutral-700 hover:bg-neutral-50 dark:hover:bg-neutral-800'
                    }`}
                  >
                    <Smartphone className="w-5 h-5 text-amber-500 mb-1" />
                    <div className="font-bold text-neutral-900 dark:text-white">Mobile Money</div>
                    <div className="text-[10px] text-neutral-500">MTN, Moov, Celtiis</div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setPaymentMethod('CARD')}
                    className={`p-3 rounded-xl border text-left transition-all cursor-pointer min-h-[52px] ${
                      paymentMethod === 'CARD'
                        ? 'border-emerald-600 bg-emerald-50/70 dark:bg-emerald-950/60 ring-1 ring-emerald-600'
                        : 'border-neutral-200 dark:border-neutral-700 hover:bg-neutral-50 dark:hover:bg-neutral-800'
                    }`}
                  >
                    <CreditCard className="w-5 h-5 text-sky-500 mb-1" />
                    <div className="font-bold text-neutral-900 dark:text-white">Carte Bancaire</div>
                    <div className="text-[10px] text-neutral-500">Visa / Mastercard 3DS</div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setPaymentMethod('WALLET')}
                    className={`p-3 rounded-xl border text-left transition-all cursor-pointer min-h-[52px] ${
                      paymentMethod === 'WALLET'
                        ? 'border-emerald-600 bg-emerald-50/70 dark:bg-emerald-950/60 ring-1 ring-emerald-600'
                        : 'border-neutral-200 dark:border-neutral-700 hover:bg-neutral-50 dark:hover:bg-neutral-800'
                    }`}
                  >
                    <WalletIcon className="w-5 h-5 text-purple-500 mb-1" />
                    <div className="font-bold text-neutral-900 dark:text-white">Portefeuille</div>
                    <div className="text-[10px] text-neutral-500">
                      Solde : {formatCurrency(currentWallet?.balanceMinor || 0, currency)}
                    </div>
                  </button>
                </div>
              </div>

              {/* Sub-form according to payment method */}
              {paymentMethod === 'MOBILE_MONEY' && (
                <div className="p-3.5 sm:p-4 bg-neutral-50 dark:bg-neutral-850 rounded-xl border border-neutral-200 dark:border-neutral-800 space-y-3">
                  <span className="font-semibold text-neutral-900 dark:text-white block">
                    Paiement Mobile Money (Passerelle FedaPay)
                  </span>
                  <div className="grid grid-cols-3 gap-1.5 sm:gap-2">
                    {(['MTN', 'MOOV', 'CELTIIS'] as MobileMoneyOperator[]).map((op) => (
                      <button
                        key={op}
                        type="button"
                        onClick={() => setMomoOperator(op)}
                        className={`p-2 rounded-lg border text-xs font-bold transition-all cursor-pointer min-h-[44px] ${
                          momoOperator === op
                            ? 'bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 border-neutral-900 dark:border-white'
                            : 'bg-white dark:bg-neutral-800 border-neutral-200 dark:border-neutral-700 text-neutral-600 dark:text-neutral-300'
                        }`}
                      >
                        {op === 'MTN' ? 'MTN MoMo' : op === 'MOOV' ? 'Moov Money' : 'Celtiis Cash'}
                      </button>
                    ))}
                  </div>

                  <div>
                    <label className="block text-[11px] font-medium text-neutral-500 mb-1">
                      Numéro de téléphone pour la validation PIN USSD
                    </label>
                    <div className="flex gap-2">
                      <span className="px-3 py-2 bg-neutral-200 dark:bg-neutral-700 rounded-lg font-mono text-sm sm:text-xs flex items-center">
                        +229
                      </span>
                      <input
                        type="tel"
                        value={momoPhone}
                        onChange={(e) => setMomoPhone(e.target.value)}
                        placeholder="97 00 00 00"
                        className="flex-1 px-3 py-2.5 bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg text-base sm:text-xs font-mono min-h-[44px]"
                      />
                    </div>
                  </div>
                </div>
              )}

              {paymentMethod === 'CARD' && (
                <div className="p-3.5 sm:p-4 bg-neutral-50 dark:bg-neutral-850 rounded-xl border border-neutral-200 dark:border-neutral-800 space-y-3">
                  <span className="font-semibold text-neutral-900 dark:text-white block">
                    Carte bancaire sécurisée (Visa / Mastercard)
                  </span>
                  <div>
                    <label className="block text-[11px] text-neutral-500 mb-1">Numéro de carte</label>
                    <input
                      type="text"
                      value={cardNumber}
                      onChange={(e) => setCardNumber(e.target.value)}
                      className="w-full px-3 py-2.5 bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg text-base sm:text-xs font-mono min-h-[44px]"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[11px] text-neutral-500 mb-1">Expiration</label>
                      <input
                        type="text"
                        value={cardExp}
                        onChange={(e) => setCardExp(e.target.value)}
                        className="w-full px-3 py-2.5 bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg text-base sm:text-xs font-mono min-h-[44px]"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] text-neutral-500 mb-1">CVV</label>
                      <input
                        type="password"
                        maxLength={4}
                        value={cardCvv}
                        onChange={(e) => setCardCvv(e.target.value)}
                        className="w-full px-3 py-2.5 bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg text-base sm:text-xs font-mono min-h-[44px]"
                      />
                    </div>
                  </div>
                </div>
              )}

              {paymentMethod === 'WALLET' && (
                <div className="p-3.5 sm:p-4 bg-neutral-50 dark:bg-neutral-850 rounded-xl border border-neutral-200 dark:border-neutral-800 space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-neutral-500">Solde disponible :</span>
                    <span className="font-mono font-bold text-neutral-900 dark:text-white">
                      {formatCurrency(currentWallet?.balanceMinor || 0, currency)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-neutral-500">Montant de la commande :</span>
                    <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">
                      - {quote.displayFormatted}
                    </span>
                  </div>

                  {!hasEnoughWalletBalance && (
                    <div className="mt-2 p-2.5 bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800 rounded-lg text-rose-700 dark:text-rose-300 flex items-start gap-2">
                      <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                      <span>
                        Solde insuffisant pour cette opération. Veuillez choisir Mobile Money, Carte ou recharger votre portefeuille.
                      </span>
                    </div>
                  )}
                </div>
              )}

              {/* Exact final amount breakdown */}
              <div className="p-3 bg-neutral-100 dark:bg-neutral-800 rounded-xl flex items-center justify-between">
                <div>
                  <span className="font-bold text-neutral-900 dark:text-white block">
                    Total débité TTC :
                  </span>
                  <span className="text-[10px] text-neutral-500">
                    Garantie remboursement 20 min incluse
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-xl sm:text-2xl font-bold font-mono text-neutral-900 dark:text-white tabular-nums">
                    {quote.displayFormatted}
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        {!isProcessing && (
          <div className="p-3.5 sm:p-4 bg-neutral-50 dark:bg-neutral-850 border-t border-neutral-200 dark:border-neutral-800 flex items-center justify-between gap-2 shrink-0">
            {step === 1 ? (
              <>
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2.5 text-xs font-semibold text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white cursor-pointer min-h-[44px]"
                >
                  Annuler
                </button>
                <button
                  type="button"
                  onClick={() => setStep(2)}
                  className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs px-5 py-2.5 rounded-xl shadow-xs transition-colors cursor-pointer min-h-[44px]"
                >
                  <span>Continuer vers le paiement</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="px-4 py-2.5 text-xs font-semibold text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white cursor-pointer min-h-[44px]"
                >
                  Retour
                </button>
                <button
                  type="button"
                  onClick={handleConfirmPayment}
                  disabled={paymentMethod === 'WALLET' && !hasEnoughWalletBalance}
                  className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold text-xs px-5 sm:px-6 py-2.5 rounded-xl shadow-xs transition-colors cursor-pointer min-h-[44px]"
                >
                  <Lock className="w-3.5 h-3.5" />
                  <span>Confirmer & Obtenir le numéro</span>
                </button>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
