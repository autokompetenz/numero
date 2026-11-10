import React, { useEffect, useState } from 'react';
import { useApp } from '../../context/AppContext';
import { Search, MessageCircle, Send, Bot, Mail, Video, Camera, AppWindow, Flame, Car, Tv, Coins, CreditCard, Loader2 } from 'lucide-react';
import { NumberType } from '../../types';

interface CatalogSectionProps {
  onSelectProduct: (countryCode: string, serviceId: string, type: NumberType) => void;
}

export const CatalogSection: React.FC<CatalogSectionProps> = ({ onSelectProduct }) => {
  const {
    catalog,
    countries,
    countriesLoading,
    countriesError,
    refreshCountries,
    services,
    currency,
    catalogFilters,
    setCatalogFilters,
    catalogTotal,
    catalogHasMore,
    catalogLoading,
    catalogLoadingMore,
    loadMoreCatalog,
  } = useApp();

  const [searchInput, setSearchInput] = useState(catalogFilters.search ?? '');

  const selectedCountry = catalogFilters.countryCode ?? 'ALL';
  const selectedCategory = catalogFilters.category ?? 'all';
  const selectedType = catalogFilters.type ?? 'TEMPORARY';

  // Recherche différée : évite une requête serveur à chaque frappe.
  useEffect(() => {
    const timer = window.setTimeout(() => {
      const next = searchInput.trim();
      if ((catalogFilters.search ?? '') !== next) {
        setCatalogFilters({ search: next || undefined });
      }
    }, 350);
    return () => window.clearTimeout(timer);
  }, [searchInput, catalogFilters.search, setCatalogFilters]);

  // Service icon resolver helper
  const renderServiceIcon = (iconName: string) => {
    switch (iconName) {
      case 'MessageCircle': return <MessageCircle className="w-5 h-5" />;
      case 'Send': return <Send className="w-5 h-5" />;
      case 'Bot': return <Bot className="w-5 h-5" />;
      case 'Mail': return <Mail className="w-5 h-5" />;
      case 'Video': return <Video className="w-5 h-5" />;
      case 'Camera': return <Camera className="w-5 h-5" />;
      case 'Flame': return <Flame className="w-5 h-5" />;
      case 'Car': return <Car className="w-5 h-5" />;
      case 'Tv': return <Tv className="w-5 h-5" />;
      case 'Coins': return <Coins className="w-5 h-5" />;
      case 'CreditCard': return <CreditCard className="w-5 h-5" />;
      default: return <AppWindow className="w-5 h-5" />;
    }
  };

  const resetFilters = () => {
    setSearchInput('');
    setCatalogFilters({
      countryCode: undefined,
      category: undefined,
      search: undefined,
      serviceId: undefined,
    });
  };

  return (
    <section id="catalog-section" className="py-10 sm:py-12 bg-white dark:bg-slate-950">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Section Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 pb-8 border-b border-slate-200 dark:border-slate-800">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
              <span>Fournisseur Ultra SMS</span>
              <span aria-hidden="true">·</span>
              <span>Disponibilité instantanée</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white mt-1">
              Catalogue de Numéros Virtuels
            </h2>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 max-w-xl">
              Choisissez votre pays et l'application cible. Tarifs calculés en direct selon la devise sélectionnée ({currency}).
            </p>
          </div>

          {/* Type Toggle (Temporary vs Rental) */}
          <div className="flex w-full sm:w-auto items-center p-1 bg-slate-100 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shrink-0">
            <button
              onClick={() => setCatalogFilters({ type: 'TEMPORARY' })}
              className={`flex-1 sm:flex-none px-3.5 py-2 text-xs font-semibold rounded-lg transition-all whitespace-nowrap ${
                selectedType === 'TEMPORARY'
                  ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <span className="sm:hidden">Activation SMS</span>
              <span className="hidden sm:inline">Activation SMS (20 min)</span>
            </button>
            <button
              onClick={() => setCatalogFilters({ type: 'RENTAL' })}
              className={`flex-1 sm:flex-none px-3.5 py-2 text-xs font-semibold rounded-lg transition-all whitespace-nowrap ${
                selectedType === 'RENTAL'
                  ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <span className="sm:hidden">Location</span>
              <span className="hidden sm:inline">Location longue durée</span>
            </button>
          </div>
        </div>

        {/* Filter Bar */}
        <div className="py-6 flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-4">
          
          {/* Search Input */}
          <div className="relative w-full flex-1 lg:max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 dark:text-slate-400" />
            <input
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Rechercher WhatsApp, France, +229, Bénin, Google..."
              className="w-full min-h-11 pl-9 pr-4 py-2.5 text-sm rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          {/* Category Tabs */}
          <div className="-mx-4 px-4 sm:mx-0 sm:px-0 flex items-center gap-1 overflow-x-auto pb-1 lg:pb-0 scrollbar-none text-xs snap-x">
            {[
              { id: 'all', label: 'Toutes les catégories' },
              { id: 'messaging', label: 'Messageries' },
              { id: 'social', label: 'Réseaux Sociaux' },
              { id: 'ai', label: 'Intelligence Artificielle' },
              { id: 'tech', label: 'Tech & Google' },
              { id: 'fintech', label: 'Banques & Crypto' },
            ].map((cat) => (
              <button
                key={cat.id}
                onClick={() =>
                  setCatalogFilters({ category: cat.id === 'all' ? undefined : cat.id })
                }
                className={`px-3 py-2 font-medium rounded-lg transition-colors whitespace-nowrap shrink-0 snap-start ${
                  selectedCategory === cat.id
                    ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-950 font-semibold'
                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-900'
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>

        </div>

        {/* Country Filter Chips (Interactive filter buttons) */}
        <div className="pb-6 flex flex-wrap items-center gap-2 text-xs">
          <span className="text-slate-500 dark:text-slate-400 text-[11px] font-semibold uppercase tracking-wider shrink-0 mr-1">
            Pays :
          </span>
          <button
            onClick={() => setCatalogFilters({ countryCode: undefined })}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors shrink-0 snap-start ${
              selectedCountry === 'ALL'
                ? 'bg-emerald-700 text-white font-semibold'
                : 'bg-slate-100 dark:bg-slate-900 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800'
            }`}
          >
            🌍 Tous les pays
          </button>
          {countries.map((c) => (
            <button
              key={c.code}
              onClick={() => setCatalogFilters({ countryCode: c.code })}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors shrink-0 snap-start ${
                selectedCountry === c.code
                  ? 'bg-emerald-700 text-white font-semibold'
                  : 'bg-slate-100 dark:bg-slate-900 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800'
              }`}
            >
              <span>{c.flag}</span>
              <span>{c.name}</span>
            </button>
          ))}
          {countriesLoading && countries.length === 0 && (
            <span className="text-slate-500 dark:text-slate-400">Chargement des pays…</span>
          )}
          {countriesError && (
            <button
              type="button"
              onClick={() => void refreshCountries()}
              className="text-rose-600 hover:underline dark:text-rose-400"
            >
              Liste indisponible — réessayer
            </button>
          )}
        </div>

        {/* Catalog Grid */}
        {catalogLoading ? (
          <div className="py-16 flex flex-col items-center justify-center gap-3 text-slate-500 dark:text-slate-400">
            <Loader2 className="w-6 h-6 animate-spin text-emerald-600" />
            <p className="text-xs font-medium">Chargement du catalogue…</p>
          </div>
        ) : catalog.length === 0 ? (
          <div className="py-16 text-center border border-dashed border-slate-200 dark:border-slate-800 rounded-xl p-8">
            <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">
              Aucun numéro disponible pour cette recherche
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-md mx-auto">
              Essayez de sélectionner un autre pays ou réinitialisez vos filtres pour voir les offres disponibles sur Ultra SMS.
            </p>
            <button
              onClick={resetFilters}
              className="mt-4 px-4 py-2 text-xs font-semibold text-emerald-700 dark:text-emerald-400 hover:underline"
            >
              Réinitialiser les filtres
            </button>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 min-[480px]:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4">
              {catalog.map((item) => {
                const service = services.find((s) => s.id === item.serviceId);
                const country = countries.find((c) => c.code === item.countryCode);
                if (!service || !country) return null;

                return (
                  <div
                    key={item.id}
                    className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/80 p-4 hover:border-emerald-500/50 hover:shadow-lg hover:shadow-slate-900/5 transition-all flex flex-col justify-between"
                  >
                    <div>
                      {/* Header: Service icon & Country Flag */}
                      <div className="flex items-start justify-between gap-3 mb-3">
                        <div className="w-10 h-10 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 flex items-center justify-center shrink-0">
                          {renderServiceIcon(service.iconName)}
                        </div>
                        
                        {/* Country Flag & Prefix */}
                        <div className="flex items-center gap-1.5 text-xs font-medium text-slate-700 dark:text-slate-300">
                          <span className="text-base">{country.flag}</span>
                          <span>{country.name}</span>
                          <span className="text-slate-500 dark:text-slate-400 font-mono text-[11px]">{country.prefix}</span>
                        </div>
                      </div>

                      {/* Service Name */}
                      <h3 className="text-base font-bold text-slate-900 dark:text-white">
                        {service.name}
                      </h3>

                      {/* Unboxed metadata line with typographic separator */}
                      <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 mt-1 mb-4">
                        <span className="capitalize">{service.category}</span>
                        <span aria-hidden="true">·</span>
                        <span className="font-mono">{item.availableCount} dispos</span>
                        <span aria-hidden="true">·</span>
                        <span>20 min</span>
                      </div>
                    </div>

                    {/* Pricing and Action */}
                    <div className="pt-3 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between gap-2">
                      <div>
                        <div className="text-[11px] text-slate-500 dark:text-slate-400 font-mono uppercase">
                          Prix TTC
                        </div>
                        <div className="text-base font-extrabold font-mono text-emerald-700 dark:text-emerald-400">
                          {item.sellingPriceFormatted}
                        </div>
                      </div>

                      <button
                        onClick={() => onSelectProduct(item.countryCode, item.serviceId, item.type)}
                        className="inline-flex items-center justify-center min-h-9 px-4 py-2 text-xs font-bold text-white bg-emerald-700 hover:bg-emerald-800 rounded-lg transition-colors whitespace-nowrap shadow-sm"
                      >
                        Acheter
                      </button>
                    </div>

                  </div>
                );
              })}
            </div>

            {/* Pagination serveur */}
            <div className="pt-8 flex flex-col items-center gap-3">
              <p className="text-xs text-slate-500 dark:text-slate-400 font-mono">
                {catalog.length} offre{catalog.length > 1 ? 's' : ''} affichée
                {catalog.length > 1 ? 's' : ''} sur {catalogTotal}
              </p>
              {catalogHasMore && (
                <button
                  onClick={() => void loadMoreCatalog()}
                  disabled={catalogLoadingMore}
                  className="inline-flex items-center justify-center gap-2 min-h-11 px-6 py-3 text-sm font-semibold text-emerald-800 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/40 hover:bg-emerald-100 dark:hover:bg-emerald-950/70 border border-emerald-200 dark:border-emerald-800 rounded-xl transition-colors disabled:opacity-60"
                >
                  {catalogLoadingMore && <Loader2 className="w-4 h-4 animate-spin" />}
                  {catalogLoadingMore ? 'Chargement…' : 'Charger plus de numéros'}
                </button>
              )}
            </div>
          </>
        )}

      </div>
    </section>
  );
};
