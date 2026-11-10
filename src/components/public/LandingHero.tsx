import React, { useEffect, useState } from 'react';
import { useApp } from '../../context/AppContext';
import { CatalogItem, ServiceItem } from '../../types';
import { ArrowRight, CheckCircle2, ShieldCheck, Zap } from 'lucide-react';

interface LandingHeroProps {
  onSelectProduct: (countryCode: string, serviceId: string) => void;
  onExploreCatalog: () => void;
  onOpenPricingExplainer: () => void;
}

export const LandingHero: React.FC<LandingHeroProps> = ({
  onSelectProduct,
  onExploreCatalog,
  onOpenPricingExplainer,
}) => {
  const {
    currency,
    countries,
    countriesLoading,
    countriesError,
    refreshCountries,
    catalogServiceTotal,
    getServicesForCountry,
    resolveCatalogItem,
  } = useApp();

  const [selectedCountryCode, setSelectedCountryCode] = useState<string>('BJ');
  const [selectedServiceId, setSelectedServiceId] = useState<string>('whatsapp');
  const [availableServices, setAvailableServices] = useState<ServiceItem[]>([]);
  const [catalogItem, setCatalogItem] = useState<CatalogItem | null>(null);

  // Le pays par défaut doit exister dans les offres réelles.
  useEffect(() => {
    if (!countries.length) return;
    if (!countries.some((country) => country.code === selectedCountryCode)) {
      setSelectedCountryCode(countries[0].code);
      setSelectedServiceId('');
    }
  }, [countries, selectedCountryCode]);

  // Les services proposés dépendent du pays choisi.
  useEffect(() => {
    if (!selectedCountryCode) return;
    let cancelled = false;

    void getServicesForCountry(selectedCountryCode).then((list) => {
      if (cancelled) return;
      setAvailableServices(list);
      setSelectedServiceId((previous) =>
        list.some((service) => service.id === previous) ? previous : (list[0]?.id ?? ''),
      );
    });

    return () => {
      cancelled = true;
    };
  }, [selectedCountryCode, getServicesForCountry]);

  // Le prix et l'identifiant de l'offre sont résolus côté serveur.
  useEffect(() => {
    if (!selectedCountryCode || !selectedServiceId) {
      setCatalogItem(null);
      return;
    }
    let cancelled = false;

    void resolveCatalogItem({
      countryCode: selectedCountryCode,
      serviceId: selectedServiceId,
      type: 'TEMPORARY',
    }).then((item) => {
      if (!cancelled) setCatalogItem(item);
    });

    return () => {
      cancelled = true;
    };
  }, [selectedCountryCode, selectedServiceId, resolveCatalogItem]);

  const currentCountry =
    countries.find((country) => country.code === selectedCountryCode) ?? countries[0];
  const currentService =
    availableServices.find((service) => service.id === selectedServiceId) ??
    availableServices[0];

  return (
    <section className="relative overflow-hidden pt-8 pb-12 sm:pt-12 sm:pb-16 lg:pt-20 lg:pb-24 border-b border-slate-200 dark:border-slate-800">
      
      {/* Background radial gradient accent */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-7xl h-96 bg-gradient-to-b from-emerald-500/10 via-emerald-500/5 to-transparent blur-3xl pointer-events-none -z-10" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-14 items-center">
          
          {/* Left Column: Value Proposition */}
          <div className="lg:col-span-7 space-y-5 sm:space-y-6">
            
            {/* Contextual category kicker (No pills, clean unboxed text) */}
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] sm:text-xs font-semibold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
              <span>Plateforme Sécurisée de Numéros Virtuels</span>
              <span aria-hidden="true" className="hidden sm:inline">·</span>
              <span className="hidden sm:inline">Afrique & International</span>
              <span aria-hidden="true" className="hidden md:inline">·</span>
              <span className="hidden md:inline">Ultra SMS Partner</span>
            </div>

            <h1 className="text-[1.75rem] leading-[1.2] sm:text-4xl lg:text-5xl font-extrabold tracking-tight text-slate-900 dark:text-white text-balance">
              Achetez des numéros virtuels temporaires & permanents en toute simplicité
            </h1>

            <p className="text-sm sm:text-base lg:text-lg text-slate-600 dark:text-slate-300 leading-relaxed max-w-2xl">
              Recevez instantanément vos codes SMS de vérification pour WhatsApp, Telegram, Google, ChatGPT et des dizaines de services. Payez directement en <strong className="text-slate-900 dark:text-white font-semibold">Mobile Money (MTN, Moov, Celtiis)</strong> ou carte bancaire internationale.
            </p>

            {/* Key commitments */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 sm:gap-3 pt-1 text-xs text-slate-600 dark:text-slate-300">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                <span>Marge transparente & modèle économique pérenne</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                <span>Garantie remboursement si aucun SMS reçu</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                <span>Portefeuille multi-devises (XOF, EUR, USD)</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                <span>Connexion grossiste Ultra SMS en temps réel</span>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row sm:flex-wrap items-stretch sm:items-center gap-3 pt-3">
              <button
                onClick={() =>
                  currentCountry &&
                  currentService &&
                  onSelectProduct(currentCountry.code, currentService.id)
                }
                disabled={!catalogItem}
                className="inline-flex items-center justify-center gap-2 min-h-11 px-6 py-3 text-sm font-bold text-white bg-emerald-700 hover:bg-emerald-800 rounded-xl transition-all shadow-md shadow-emerald-600/20 hover:shadow-emerald-500/30 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <span>Acheter ce numéro</span>
                <ArrowRight className="w-4 h-4" />
              </button>

              <button
                onClick={onExploreCatalog}
                className="inline-flex items-center justify-center min-h-11 px-5 py-3 text-sm font-semibold text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl transition-colors"
              >
                Parcourir tout le catalogue ({catalogServiceTotal} services)
              </button>
            </div>

          </div>

          {/* Right Column: Interactive Quick Buy Card */}
          <div className="lg:col-span-5">
            <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 sm:p-6 shadow-xl shadow-slate-900/5 lg:sticky lg:top-24">
              
              <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
                <div>
                  <h2 className="text-sm font-bold text-slate-900 dark:text-white">
                    Simulateur de Numéro Instantané
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Disponibilité fournisseur en direct
                  </p>
                </div>
                <div className="flex items-center gap-1.5 text-xs text-emerald-700 dark:text-emerald-400 font-mono font-medium">
                  <span className="w-2 h-2 rounded-full bg-emerald-500" />
                  <span>{catalogItem ? 'En stock' : 'Indisponible'}</span>
                </div>
              </div>

              {/* Form Controls */}
              <div className="space-y-4 pt-4">
                
                {/* Country selection */}
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                    1. Choisissez le pays du numéro
                  </label>
                  <select
                    value={selectedCountryCode}
                    onChange={(e) => setSelectedCountryCode(e.target.value)}
                  disabled={countriesLoading || !countries.length}
                    className="w-full min-h-11 text-sm font-medium rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 px-3 py-2.5 focus:ring-2 focus:ring-emerald-500 focus:outline-none disabled:opacity-60"
                  >
                    {countries.length === 0 && (
                      <option value="">
                        {countriesLoading
                          ? 'Chargement des pays…'
                          : countriesError
                            ? 'Pays indisponibles'
                            : 'Aucun pays configuré'}
                      </option>
                    )}
                    {countries.map((country) => (
                      <option key={country.code} value={country.code}>
                        {country.flag} {country.name} ({country.prefix})
                      </option>
                    ))}
                  </select>
                  {countriesError && (
                    <button
                      type="button"
                      onClick={() => void refreshCountries()}
                      className="mt-1 text-xs font-medium text-rose-600 hover:underline dark:text-rose-400"
                    >
                      Impossible de charger les pays. Réessayer
                    </button>
                  )}
                </div>

                {/* Service selection */}
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                    2. Choisissez le service de destination
                  </label>
                  <select
                    value={selectedServiceId}
                    onChange={(e) => setSelectedServiceId(e.target.value)}
                    disabled={!availableServices.length}
                    className="w-full min-h-11 text-sm font-medium rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 px-3 py-2.5 focus:ring-2 focus:ring-emerald-500 focus:outline-none disabled:opacity-60"
                  >
                    {availableServices.length === 0 && (
                      <option value="">Aucun service disponible pour ce pays</option>
                    )}
                    {availableServices.map((service) => (
                      <option key={service.id} value={service.id}>
                        {service.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Live Price Box */}
                <div className="rounded-lg bg-slate-50 dark:bg-slate-950 p-4 border border-slate-200 dark:border-slate-800 space-y-2">
                  <div className="flex items-baseline justify-between">
                    <span className="text-xs text-slate-500 dark:text-slate-400">
                      Prix final TTC ({currency})
                    </span>
                    <span className="text-2xl font-black font-mono text-emerald-700 dark:text-emerald-400">
                      {catalogItem ? catalogItem.sellingPriceFormatted : '—'}
                    </span>
                  </div>

                  {/* Pricing Breakdown Link */}
                  <div className="pt-2 border-t border-slate-200/60 dark:border-slate-800/60 flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 font-mono">
                    <span>Marge nette garantie : 2 000 XOF</span>
                    <button
                      onClick={onOpenPricingExplainer}
                      className="text-emerald-700 dark:text-emerald-400 underline hover:text-emerald-700 cursor-pointer font-sans"
                    >
                      Détail du calcul
                    </button>
                  </div>
                </div>

                {/* Acceptable payment badges */}
                <div className="pt-1 text-[11px] text-slate-500 dark:text-slate-400 flex items-center justify-between">
                  <span>Paiement accepté :</span>
                  <span className="font-semibold text-slate-700 dark:text-slate-300">
                    MTN · Moov · Celtiis · Visa · Portefeuille
                  </span>
                </div>

                {/* CTA Action */}
                <button
                  onClick={() =>
                    currentCountry &&
                    currentService &&
                    onSelectProduct(currentCountry.code, currentService.id)
                  }
                  disabled={!catalogItem}
                  className="w-full min-h-11 py-3 px-4 text-sm font-bold text-white bg-emerald-700 hover:bg-emerald-800 rounded-lg transition-colors flex items-center justify-center gap-2 shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Zap className="w-4 h-4 fill-white" />
                  <span>
                    Activer {currentService?.name ?? 'ce service'} (
                    {currentCountry?.name ?? 'ce pays'})
                  </span>
                </button>

                <p className="text-[11px] text-center text-slate-500 dark:text-slate-400 leading-relaxed">
                  Activation instantanée · Durée de réception : 20 minutes · Annulable sans frais
                </p>

              </div>

            </div>
          </div>

        </div>

        {/* Claim-to-Proof Metric Strip */}
        <div className="mt-10 sm:mt-12 pt-7 sm:pt-8 border-t border-slate-200 dark:border-slate-800 grid grid-cols-2 md:grid-cols-4 gap-x-4 gap-y-6 text-center">
          <div>
            <p className="text-2xl sm:text-3xl font-black font-mono text-slate-900 dark:text-white">
              2 000 XOF
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Marge nette minimale garantie / numéro
            </p>
          </div>

          <div>
            <p className="text-2xl sm:text-3xl font-black font-mono text-slate-900 dark:text-white">
              &lt; 15 sec
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Livraison immédiate du numéro
            </p>
          </div>

          <div>
            <p className="text-2xl sm:text-3xl font-black font-mono text-slate-900 dark:text-white">
              100%
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Remboursement si aucun SMS reçu
            </p>
          </div>

          <div>
            <p className="text-2xl sm:text-3xl font-black font-mono text-slate-900 dark:text-white">
              3 Devises
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              XOF, EUR, USD avec portefeuilles dédiés
            </p>
          </div>
        </div>

      </div>

    </section>
  );
};
