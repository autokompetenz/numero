/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { calculateSellingPrice } from '../../services/pricingEngine';
import { PaymentMethod } from '../../types';
import { Shield, Zap, RefreshCw, ArrowRight, CheckCircle2, ChevronRight, Lock } from 'lucide-react';

interface HeroSectionProps {
  onOpenBuyModal: (preselectedCountry?: string, preselectedService?: string) => void;
  onExploreCatalog: () => void;
  onOpenPricingExplanation: () => void;
}

export const HeroSection: React.FC<HeroSectionProps> = ({
  onOpenBuyModal,
  onExploreCatalog,
  onOpenPricingExplanation,
}) => {
  const { countries, services, currency, pricingConfig, exchangeRates } = useApp();

  const [selectedCountryCode, setSelectedCountryCode] = useState<string>('BJ');
  const [selectedServiceId, setSelectedServiceId] = useState<string>('whatsapp');
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<PaymentMethod>('MOBILE_MONEY');

  const selectedCountry = countries.find((c) => c.code === selectedCountryCode) || countries[0];
  const selectedService = services.find((s) => s.id === selectedServiceId) || services[0];

  // Dynamic price calculation
  const quote = calculateSellingPrice({
    supplierCostXof: selectedService.baseSupplierCostXof,
    paymentMethod: selectedPaymentMethod,
    config: pricingConfig,
    targetCurrency: currency,
    rates: exchangeRates,
  });

  return (
    <section className="relative overflow-hidden pt-6 pb-12 sm:pt-10 sm:pb-16 md:pt-14 md:pb-20 bg-linear-to-b from-emerald-50/40 via-white to-neutral-50 dark:from-neutral-900/60 dark:via-neutral-950 dark:to-neutral-950 border-b border-neutral-200 dark:border-neutral-800 transition-colors">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center">
          {/* Left Column: Value Proposition & Copy */}
          <div className="lg:col-span-7 space-y-5 sm:space-y-6">
            <div className="inline-flex items-center gap-2 text-xs font-semibold text-emerald-800 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800/80 px-3 py-1.5 rounded-lg max-w-full">
              <Shield className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
              <span className="leading-tight">Garantie Numivo : Remboursement automatique sous 20 min si aucun SMS reçu</span>
            </div>

            <h1 className="text-2xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-neutral-900 dark:text-white leading-[1.18] text-balance">
              Numéros virtuels fiables pour vos vérifications SMS & OTP.
            </h1>

            <p className="text-sm sm:text-base lg:text-lg text-neutral-600 dark:text-neutral-300 leading-relaxed max-w-2xl">
              Achetez des numéros pour WhatsApp, Telegram, Google, ChatGPT ou Uber. Payez instantanément par{' '}
              <strong className="text-neutral-900 dark:text-white font-semibold">MTN MoMo, Moov Money, Celtiis</strong> ou carte bancaire.
            </p>

            {/* Bullet Proof Points */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4 pt-1">
              <div className="flex items-start gap-2.5 p-2.5 sm:p-0 rounded-xl bg-white/60 dark:bg-neutral-900/50 sm:bg-transparent sm:dark:bg-transparent border border-neutral-200/50 dark:border-neutral-800/50 sm:border-0">
                <Zap className="w-4 h-4 text-emerald-600 dark:text-emerald-400 mt-0.5 shrink-0" />
                <div>
                  <h4 className="text-xs font-bold text-neutral-900 dark:text-white">Réception &lt; 15s</h4>
                  <p className="text-[11px] text-neutral-500 mt-0.5">Flux SMS en direct avec extraction automatique du code OTP.</p>
                </div>
              </div>
              <div className="flex items-start gap-2.5 p-2.5 sm:p-0 rounded-xl bg-white/60 dark:bg-neutral-900/50 sm:bg-transparent sm:dark:bg-transparent border border-neutral-200/50 dark:border-neutral-800/50 sm:border-0">
                <Lock className="w-4 h-4 text-emerald-600 dark:text-emerald-400 mt-0.5 shrink-0" />
                <div>
                  <h4 className="text-xs font-bold text-neutral-900 dark:text-white">Mobile Money & Cartes</h4>
                  <p className="text-[11px] text-neutral-500 mt-0.5">Intégration certifiée FedaPay & KKiaPay pour l’Afrique de l’Ouest.</p>
                </div>
              </div>
              <div className="flex items-start gap-2.5 p-2.5 sm:p-0 rounded-xl bg-white/60 dark:bg-neutral-900/50 sm:bg-transparent sm:dark:bg-transparent border border-neutral-200/50 dark:border-neutral-800/50 sm:border-0">
                <RefreshCw className="w-4 h-4 text-emerald-600 dark:text-emerald-400 mt-0.5 shrink-0" />
                <div>
                  <h4 className="text-xs font-bold text-neutral-900 dark:text-white">Garantie 100%</h4>
                  <p className="text-[11px] text-neutral-500 mt-0.5">Annulation & recrédit immédiats si aucun SMS n'arrive.</p>
                </div>
              </div>
            </div>

            {/* CTAs */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 pt-2">
              <button
                onClick={() => onOpenBuyModal(selectedCountryCode, selectedServiceId)}
                className="flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-sm px-6 py-3.5 rounded-xl shadow-xs hover:shadow-md transition-all cursor-pointer min-h-[48px]"
              >
                <span>Acheter ce numéro maintenant</span>
                <ArrowRight className="w-4 h-4" />
              </button>

              <button
                onClick={onExploreCatalog}
                className="flex items-center justify-center gap-2 bg-white dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 hover:bg-neutral-50 dark:hover:bg-neutral-750 text-neutral-700 dark:text-neutral-200 font-semibold text-sm px-5 py-3.5 rounded-xl transition-all cursor-pointer min-h-[48px]"
              >
                <span>Explorer les {countries.length} pays & {services.length}+ services</span>
              </button>
            </div>
          </div>

          {/* Right Column: Live Interactive Quick Simulator */}
          <div className="lg:col-span-5">
            <div className="bg-white dark:bg-neutral-900 rounded-2xl sm:rounded-3xl border border-neutral-200 dark:border-neutral-800 shadow-xl p-4 sm:p-6 transition-all">
              <div className="flex items-center justify-between pb-3.5 border-b border-neutral-100 dark:border-neutral-800">
                <div>
                  <span className="text-[10px] sm:text-[11px] uppercase tracking-wider font-bold text-emerald-600 dark:text-emerald-400">
                    Devis en direct
                  </span>
                  <h3 className="text-base sm:text-lg font-bold text-neutral-900 dark:text-white">
                    Simulateur de Numéro
                  </h3>
                </div>
                <div className="text-right">
                  <span className="text-[10px] text-neutral-400 block">Devise active</span>
                  <span className="text-xs font-mono font-bold text-neutral-700 dark:text-neutral-300">{currency}</span>
                </div>
              </div>

              <div className="space-y-3.5 sm:space-y-4 py-3 sm:py-4">
                {/* 1. Country Selection */}
                <div>
                  <label className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300 mb-1">
                    1. Choisissez le pays
                  </label>
                  <select
                    value={selectedCountryCode}
                    onChange={(e) => setSelectedCountryCode(e.target.value)}
                    className="w-full bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-xl p-2.5 text-sm sm:text-xs font-medium text-neutral-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 cursor-pointer min-h-[44px]"
                  >
                    {countries.map((c) => (
                      <option key={c.code} value={c.code}>
                        {c.flag} {c.name} ({c.dialCode}) - {c.availableServicesCount} services
                      </option>
                    ))}
                  </select>
                </div>

                {/* 2. Service Selection */}
                <div>
                  <label className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300 mb-1">
                    2. Service destinataire
                  </label>
                  <select
                    value={selectedServiceId}
                    onChange={(e) => setSelectedServiceId(e.target.value)}
                    className="w-full bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-xl p-2.5 text-sm sm:text-xs font-medium text-neutral-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 cursor-pointer min-h-[44px]"
                  >
                    {services.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name} (Taux succès {s.successRate}%)
                      </option>
                    ))}
                  </select>
                </div>

                {/* 3. Payment Method */}
                <div>
                  <label className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300 mb-1">
                    3. Mode de règlement
                  </label>
                  <div className="grid grid-cols-3 gap-1.5 sm:gap-2">
                    <button
                      type="button"
                      onClick={() => setSelectedPaymentMethod('MOBILE_MONEY')}
                      className={`p-2 rounded-xl text-xs font-medium border text-center transition-all cursor-pointer min-h-[48px] flex flex-col justify-center items-center ${
                        selectedPaymentMethod === 'MOBILE_MONEY'
                          ? 'border-emerald-600 bg-emerald-50/80 dark:bg-emerald-950/50 text-emerald-800 dark:text-emerald-300 font-bold shadow-2xs'
                          : 'border-neutral-200 dark:border-neutral-700 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-50 dark:hover:bg-neutral-800'
                      }`}
                    >
                      <span className="leading-tight">MoMo / Moov</span>
                      <span className="block text-[10px] text-neutral-500 font-normal">2.5% frais</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setSelectedPaymentMethod('CARD')}
                      className={`p-2 rounded-xl text-xs font-medium border text-center transition-all cursor-pointer min-h-[48px] flex flex-col justify-center items-center ${
                        selectedPaymentMethod === 'CARD'
                          ? 'border-emerald-600 bg-emerald-50/80 dark:bg-emerald-950/50 text-emerald-800 dark:text-emerald-300 font-bold shadow-2xs'
                          : 'border-neutral-200 dark:border-neutral-700 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-50 dark:hover:bg-neutral-800'
                      }`}
                    >
                      <span className="leading-tight">Carte Bancaire</span>
                      <span className="block text-[10px] text-neutral-500 font-normal">3.6% frais</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setSelectedPaymentMethod('WALLET')}
                      className={`p-2 rounded-xl text-xs font-medium border text-center transition-all cursor-pointer min-h-[48px] flex flex-col justify-center items-center ${
                        selectedPaymentMethod === 'WALLET'
                          ? 'border-emerald-600 bg-emerald-50/80 dark:bg-emerald-950/50 text-emerald-800 dark:text-emerald-300 font-bold shadow-2xs'
                          : 'border-neutral-200 dark:border-neutral-700 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-50 dark:hover:bg-neutral-800'
                      }`}
                    >
                      <span className="leading-tight">Portefeuille</span>
                      <span className="block text-[10px] text-neutral-500 font-normal">0% frais</span>
                    </button>
                  </div>
                </div>

                {/* Summary Card */}
                <div className="bg-neutral-50 dark:bg-neutral-850 rounded-xl p-3 sm:p-3.5 border border-neutral-200 dark:border-neutral-800 space-y-1.5 sm:space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-neutral-500">Disponibilité :</span>
                    <span className="text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5" /> Immédiate
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-neutral-500">Délai réception :</span>
                    <span className="font-mono tabular-nums text-neutral-700 dark:text-neutral-300 font-medium">
                      20 minutes
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-neutral-500">Garantie non-réception :</span>
                    <span className="text-neutral-700 dark:text-neutral-300 font-medium">
                      Recrédit automatique 100%
                    </span>
                  </div>

                  <div className="pt-2 border-t border-neutral-200 dark:border-neutral-700/60 flex items-baseline justify-between">
                    <div>
                      <span className="text-xs font-bold text-neutral-900 dark:text-white block">
                        Prix net TTC
                      </span>
                      <span className="text-[10px] text-neutral-400">Aucun frais caché</span>
                    </div>
                    <div className="text-right">
                      <span className="text-xl sm:text-2xl font-bold font-mono text-neutral-900 dark:text-white tabular-nums">
                        {quote.displayFormatted}
                      </span>
                      {currency !== 'XOF' && (
                        <span className="text-[11px] text-neutral-400 block font-mono">
                          ≈ {quote.sellingPriceXof.toLocaleString('fr-FR')} XOF
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Action Button inside Card */}
              <button
                onClick={() => onOpenBuyModal(selectedCountryCode, selectedServiceId)}
                className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs py-3.5 rounded-xl shadow-xs transition-colors flex items-center justify-center gap-2 cursor-pointer min-h-[48px]"
              >
                <span>Commander ce numéro {selectedCountry.flag}</span>
                <ChevronRight className="w-4 h-4" />
              </button>

              <button
                type="button"
                onClick={onExploreCatalog}
                className="w-full text-center text-xs text-neutral-500 hover:text-emerald-600 dark:hover:text-emerald-400 mt-2 py-1 transition-colors cursor-pointer"
              >
                Consulter tous les pays et services disponibles
              </button>
            </div>
          </div>
        </div>

        {/* Operator Trust Banner */}
        <div className="mt-10 sm:mt-14 pt-6 sm:pt-8 border-t border-neutral-200 dark:border-neutral-800">
          <p className="text-center text-[10px] sm:text-xs font-semibold uppercase tracking-wider text-neutral-500 mb-3 sm:mb-4">
            Opérateurs et passerelles de paiement partenaires
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3 sm:gap-6 text-neutral-600 dark:text-neutral-400 text-xs font-medium">
            <div className="flex items-center gap-2 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 px-3 py-1.5 rounded-lg shadow-2xs">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-400"></span>
              <span className="font-semibold text-neutral-800 dark:text-neutral-200">MTN Mobile Money</span>
            </div>
            <div className="flex items-center gap-2 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 px-3 py-1.5 rounded-lg shadow-2xs">
              <span className="w-2.5 h-2.5 rounded-full bg-blue-500"></span>
              <span className="font-semibold text-neutral-800 dark:text-neutral-200">Moov Money</span>
            </div>
            <div className="flex items-center gap-2 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 px-3 py-1.5 rounded-lg shadow-2xs">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
              <span className="font-semibold text-neutral-800 dark:text-neutral-200">Celtiis Cash Bénin</span>
            </div>
            <div className="flex items-center gap-2 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 px-3 py-1.5 rounded-lg shadow-2xs">
              <span className="w-2.5 h-2.5 rounded-full bg-sky-500"></span>
              <span className="font-semibold text-neutral-800 dark:text-neutral-200">Visa & Mastercard</span>
            </div>
            <div className="flex items-center gap-2 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 px-3 py-1.5 rounded-lg shadow-2xs">
              <span className="w-2.5 h-2.5 rounded-full bg-indigo-500"></span>
              <span className="font-semibold text-neutral-800 dark:text-neutral-200">FedaPay & KKiaPay</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
