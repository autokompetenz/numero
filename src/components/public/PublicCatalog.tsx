/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import { calculateSellingPrice } from '../../services/pricingEngine';
import { Search, Filter, ShieldCheck, Zap, Sparkles, ShoppingCart, Info } from 'lucide-react';

interface PublicCatalogProps {
  onOpenBuyModal: (countryCode: string, serviceId: string) => void;
  onOpenPricingExplanation: () => void;
}

export const PublicCatalog: React.FC<PublicCatalogProps> = ({ onOpenBuyModal, onOpenPricingExplanation }) => {
  const { countries, services, currency, pricingConfig, exchangeRates } = useApp();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCountryCode, setSelectedCountryCode] = useState('ALL');
  const [selectedCategory, setSelectedCategory] = useState('ALL');

  const categories = [
    { id: 'ALL', label: 'Tous les services' },
    { id: 'messaging', label: 'Messagerie & Chat' },
    { id: 'ai', label: 'Intelligence Artificielle' },
    { id: 'social', label: 'Réseaux Sociaux' },
    { id: 'finance', label: 'Fintech & Crypto' },
    { id: 'transport', label: 'Transport & VTC' },
    { id: 'entertainment', label: 'Streaming' },
  ];

  // Filtered items
  const filteredServices = useMemo(() => {
    return services.filter((service) => {
      const matchesSearch =
        service.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        service.description.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesCategory = selectedCategory === 'ALL' || service.category === selectedCategory;
      return matchesSearch && matchesCategory;
    });
  }, [services, searchQuery, selectedCategory]);

  const activeCountry = selectedCountryCode === 'ALL' ? countries[0] : countries.find((c) => c.code === selectedCountryCode) || countries[0];

  return (
    <section className="py-12 bg-white dark:bg-neutral-900 border-b border-neutral-200 dark:border-neutral-800 transition-colors">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-8">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold text-emerald-600 dark:text-emerald-400 mb-1">
              <span>Catalogue officiel en temps réel</span>
              <span>·</span>
              <span>Réseau télécoms haute disponibilité</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-bold text-neutral-900 dark:text-white">
              Numéros disponibles à l'activation
            </h2>
            <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-1">
              Sélectionnez un pays et un service pour réserver votre numéro et recevoir votre SMS.
            </p>
          </div>

          <div className="flex items-center gap-2 text-xs font-semibold text-neutral-600 dark:text-neutral-300 bg-neutral-100 dark:bg-neutral-800 px-3.5 py-2 rounded-lg border border-neutral-200 dark:border-neutral-700">
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            <span>Garantie 20 min : Recrédit intégral si aucun code reçu</span>
          </div>
        </div>

        {/* Filter Controls Bar */}
        <div className="bg-neutral-50 dark:bg-neutral-850 p-4 rounded-xl border border-neutral-200 dark:border-neutral-800 mb-8 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
            {/* Search Input */}
            <div className="sm:col-span-7 relative">
              <Search className="w-4 h-4 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Rechercher WhatsApp, Telegram, ChatGPT, Google, Uber..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-xs bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg text-neutral-900 dark:text-white placeholder-neutral-400 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            {/* Country Selector Dropdown */}
            <div className="sm:col-span-5">
              <select
                value={selectedCountryCode}
                onChange={(e) => setSelectedCountryCode(e.target.value)}
                className="w-full py-2 px-3 text-xs font-medium bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg text-neutral-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 cursor-pointer"
              >
                <option value="ALL">🌍 Tous les pays disponibles ({countries.length} pays)</option>
                {countries.map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.flag} {c.name} ({c.dialCode}) - {c.availableServicesCount} services
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Category Filter Pills (Functional Buttons) */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
            {categories.map((cat) => (
              <button
                key={cat.id}
                onClick={() => setSelectedCategory(cat.id)}
                className={`px-3 py-1.5 rounded-lg whitespace-nowrap transition-colors cursor-pointer ${
                  selectedCategory === cat.id
                    ? 'bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 font-semibold shadow-xs'
                    : 'bg-white dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 border border-neutral-200 dark:border-neutral-700 hover:text-neutral-900 dark:hover:text-white'
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>
        </div>

        {/* Services Grid */}
        {filteredServices.length === 0 ? (
          <div className="text-center py-12 bg-neutral-50 dark:bg-neutral-850 rounded-xl border border-dashed border-neutral-300 dark:border-neutral-700">
            <p className="text-sm font-medium text-neutral-600 dark:text-neutral-400">
              Aucun service ne correspond à votre recherche "{searchQuery}".
            </p>
            <button
              onClick={() => {
                setSearchQuery('');
                setSelectedCategory('ALL');
              }}
              className="mt-3 text-xs font-semibold text-emerald-600 hover:underline cursor-pointer"
            >
              Réinitialiser les filtres
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {filteredServices.map((service) => {
              // Calculate default quote for Mobile Money
              const quoteMomo = calculateSellingPrice({
                supplierCostXof: service.baseSupplierCostXof,
                paymentMethod: 'MOBILE_MONEY',
                config: pricingConfig,
                targetCurrency: currency,
                rates: exchangeRates,
              });

              return (
                <div
                  key={service.id}
                  className="bg-neutral-50/70 dark:bg-neutral-850 border border-neutral-200 dark:border-neutral-800 rounded-xl p-5 hover:border-emerald-500/40 hover:shadow-md transition-all flex flex-col justify-between"
                >
                  <div>
                    {/* Header: Service Name & Category */}
                    <div className="flex items-start justify-between gap-3 mb-2.5">
                      <div>
                        <h3 className="text-base font-bold text-neutral-900 dark:text-white leading-tight">
                          {service.name}
                        </h3>
                        <div className="flex items-center gap-2 text-xs text-neutral-500 mt-0.5">
                          <span>{activeCountry.flag} {activeCountry.name} ({activeCountry.dialCode})</span>
                          <span>·</span>
                          <span className="text-emerald-600 dark:text-emerald-400 font-medium">
                            {service.successRate}% succès
                          </span>
                        </div>
                      </div>
                      {service.isHot && (
                        <span className="text-[10px] font-bold text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/60 border border-amber-200 dark:border-amber-800 px-2 py-0.5 rounded">
                          Populaire
                        </span>
                      )}
                    </div>

                    <p className="text-xs text-neutral-600 dark:text-neutral-400 leading-relaxed mb-4">
                      {service.description}
                    </p>

                    {/* Feature badge strip */}
                    <div className="bg-white dark:bg-neutral-800 rounded-lg p-2.5 border border-neutral-200 dark:border-neutral-700/80 mb-4 text-[11px] space-y-1">
                      <div className="flex justify-between text-neutral-500">
                        <span>Format de réception :</span>
                        <span className="font-medium text-neutral-700 dark:text-neutral-300">
                          Code OTP immédiat
                        </span>
                      </div>
                      <div className="flex justify-between text-neutral-500">
                        <span>Validité de session :</span>
                        <span className="font-medium text-emerald-600 dark:text-emerald-400">
                          20 min (Recrédit garanti)
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Card Bottom: Price & Action */}
                  <div className="pt-3 border-t border-neutral-200 dark:border-neutral-700/60 flex items-center justify-between gap-3">
                    <div>
                      <span className="text-[10px] text-neutral-400 block uppercase font-medium">Prix TTC</span>
                      <span className="text-xl font-bold font-mono text-neutral-900 dark:text-white tabular-nums">
                        {quoteMomo.displayFormatted}
                      </span>
                    </div>

                    <button
                      onClick={() => onOpenBuyModal(activeCountry.code, service.id)}
                      className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold px-4 py-2 rounded-lg shadow-2xs hover:shadow-xs transition-all flex items-center gap-1.5 cursor-pointer"
                    >
                      <ShoppingCart className="w-3.5 h-3.5" />
                      <span>Commander</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
};
