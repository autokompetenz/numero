/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { useApp } from '../../context/AppContext';
import { calculateSellingPrice, formatCurrency } from '../../services/pricingEngine';
import { ShieldCheck, Check, Clock, RefreshCw, ShoppingCart, Lock, ArrowRight } from 'lucide-react';

interface PricingExplanationViewProps {
  onOpenBuyModal: (countryCode?: string, serviceId?: string) => void;
}

export const PricingExplanationView: React.FC<PricingExplanationViewProps> = ({ onOpenBuyModal }) => {
  const { services, countries, currency, pricingConfig, exchangeRates } = useApp();

  // Highlight key popular services
  const popularServices = services.slice(0, 8);
  const beninCountry = countries.find((c) => c.code === 'BJ') || countries[0];

  return (
    <div className="py-12 bg-white dark:bg-neutral-900 border-b border-neutral-200 dark:border-neutral-800 transition-colors">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="max-w-3xl mb-12">
          <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 px-3 py-1 rounded-md mb-2">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Tarification transparente sans frais cachés</span>
          </div>
          <h1 className="text-3xl font-bold text-neutral-900 dark:text-white">
            Tarifs par service & Engagements Numivo
          </h1>
          <p className="text-sm text-neutral-600 dark:text-neutral-400 mt-2 leading-relaxed">
            Consultez les prix finaux TTC pour chaque application. Aucun frais caché, aucun abonnement contraignant. Vous ne payez que le numéro que vous utilisez, avec une garantie de recrédit immédiat à 100% si aucun code SMS n'est délivré.
          </p>
        </div>

        {/* 3 Pillars of Pricing */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
          <div className="p-6 bg-neutral-50 dark:bg-neutral-850 border border-neutral-200 dark:border-neutral-800 rounded-2xl">
            <div className="w-10 h-10 rounded-xl bg-emerald-100 dark:bg-emerald-950/80 flex items-center justify-center text-emerald-700 dark:text-emerald-300 font-bold mb-4">
              <Check className="w-5 h-5" />
            </div>
            <h3 className="text-base font-bold text-neutral-900 dark:text-white mb-1.5">
              Prix net à l'acte
            </h3>
            <p className="text-xs text-neutral-500 dark:text-neutral-400 leading-relaxed">
              Pas d’abonnement récurrent imposé. Chaque numéro virtuel est payé à l’unité en toute clarté.
            </p>
          </div>

          <div className="p-6 bg-neutral-50 dark:bg-neutral-850 border border-neutral-200 dark:border-neutral-800 rounded-2xl">
            <div className="w-10 h-10 rounded-xl bg-emerald-100 dark:bg-emerald-950/80 flex items-center justify-center text-emerald-700 dark:text-emerald-300 font-bold mb-4">
              <RefreshCw className="w-5 h-5" />
            </div>
            <h3 className="text-base font-bold text-neutral-900 dark:text-white mb-1.5">
              Garantie « Zéro SMS = Recrédit »
            </h3>
            <p className="text-xs text-neutral-500 dark:text-neutral-400 leading-relaxed">
              Si le SMS d’activation ne vous parvient pas dans les 20 minutes, 100% du montant est réinjecté sur votre portefeuille.
            </p>
          </div>

          <div className="p-6 bg-neutral-50 dark:bg-neutral-850 border border-neutral-200 dark:border-neutral-800 rounded-2xl">
            <div className="w-10 h-10 rounded-xl bg-emerald-100 dark:bg-emerald-950/80 flex items-center justify-center text-emerald-700 dark:text-emerald-300 font-bold mb-4">
              <Lock className="w-5 h-5" />
            </div>
            <h3 className="text-base font-bold text-neutral-900 dark:text-white mb-1.5">
              Mobile Money & Carte
            </h3>
            <p className="text-xs text-neutral-500 dark:text-neutral-400 leading-relaxed">
              Paiement instantané par MTN MoMo, Moov Money, Celtiis Cash ou carte bancaire Visa/Mastercard sécurisée.
            </p>
          </div>
        </div>

        {/* Pricing Table */}
        <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl overflow-hidden shadow-2xs mb-10">
          <div className="p-5 border-b border-neutral-200 dark:border-neutral-800 flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold text-neutral-900 dark:text-white">
                Grille des tarifs recommandés ({currency})
              </h3>
              <p className="text-xs text-neutral-500 mt-0.5">
                Tarifs calculés pour un numéro temporaire de 20 minutes avec réception SMS instantanée.
              </p>
            </div>
            <div className="text-xs font-mono font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 px-3 py-1.5 rounded-lg border border-emerald-200 dark:border-emerald-800">
              Devise : {currency}
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs min-w-[580px]">
              <thead className="bg-neutral-50 dark:bg-neutral-850 text-neutral-500 font-semibold uppercase text-[10px] tracking-wider border-b border-neutral-200 dark:border-neutral-800">
                <tr>
                  <th className="py-3 px-4">Service</th>
                  <th className="py-3 px-4">Catégorie</th>
                  <th className="py-3 px-4">Durée active</th>
                  <th className="py-3 px-4">Taux de succès</th>
                  <th className="py-3 px-4 text-right">Tarif Net TTC</th>
                  <th className="py-3 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800">
                {popularServices.map((service) => {
                  const quote = calculateSellingPrice({
                    supplierCostXof: service.baseSupplierCostXof,
                    paymentMethod: 'MOBILE_MONEY',
                    config: pricingConfig,
                    targetCurrency: currency,
                    rates: exchangeRates,
                  });

                  return (
                    <tr key={service.id} className="hover:bg-neutral-50/50 dark:hover:bg-neutral-850/50 transition-colors">
                      <td className="py-3.5 px-4 font-bold text-neutral-900 dark:text-white">
                        {service.name}
                      </td>
                      <td className="py-3.5 px-4 text-neutral-500 capitalize">
                        {service.category}
                      </td>
                      <td className="py-3.5 px-4 text-neutral-600 dark:text-neutral-400 font-mono">
                        20 minutes
                      </td>
                      <td className="py-3.5 px-4 text-emerald-600 dark:text-emerald-400 font-semibold">
                        {service.successRate}%
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono font-bold text-base text-neutral-900 dark:text-white tabular-nums">
                        {quote.displayFormatted}
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <button
                          onClick={() => onOpenBuyModal(beninCountry.code, service.id)}
                          className="bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs px-3 py-1.5 rounded-lg transition-colors cursor-pointer"
                        >
                          Commander
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* CTA banner */}
        <div className="bg-neutral-900 text-white rounded-2xl p-6 md:p-8 flex flex-col md:flex-row items-center justify-between gap-6">
          <div>
            <h3 className="text-lg font-bold">Besoin d'un numéro pour un autre service ou pays ?</h3>
            <p className="text-xs text-neutral-400 mt-1 max-w-xl">
              Nous proposons plus de 12 pays et 40+ plateformes disponibles 24h/24 avec attribution instantanée.
            </p>
          </div>
          <button
            onClick={() => onOpenBuyModal()}
            className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs px-6 py-3 rounded-xl transition-colors shrink-0 flex items-center gap-2 cursor-pointer"
          >
            <span>Choisir un numéro maintenant</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
