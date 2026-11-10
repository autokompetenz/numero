import React, { useEffect, useState } from 'react';
import { AppProvider, useApp } from './context/AppContext';
import { Navbar } from './components/layout/Navbar';
import { Footer } from './components/layout/Footer';
import { LandingHero } from './components/public/LandingHero';
import { CatalogSection } from './components/public/CatalogSection';
import { PaymentMethodsGuide } from './components/public/PaymentMethodsGuide';
import { PricingCalculatorModal } from './components/public/PricingCalculatorModal';
import { FaqAndLegalModal } from './components/public/FaqAndLegalModal';
import { PurchaseModal } from './components/checkout/PurchaseModal';
import { ClientDashboard } from './components/client/ClientDashboard';
import { AdminDashboard } from './components/admin/AdminDashboard';
import { AuthPage } from './components/auth/AuthPage';
import { NumberType, UserProfile } from './types';
import {
  Calculator,
  ArrowRight,
  ShieldCheck,
  CheckCircle2,
  Smartphone,
  TrendingUp,
  Sparkles,
  HelpCircle,
  Loader2,
  AlertCircle,
  X,
} from 'lucide-react';

function MainApp() {
  const {
    role,
    currentUser,
    isAuthenticated,
    sessionLoading,
    verifyPaymentByReference,
  } = useApp();

  const [activeTab, setActiveTab] = useState<string>('explore');
  const [paymentNotice, setPaymentNotice] = useState<
    { type: 'success' | 'error'; message: string } | null
  >(null);
  
  // Modals state
  const [purchaseModalOpen, setPurchaseModalOpen] = useState(false);
  const [selectedCountryCode, setSelectedCountryCode] = useState('BJ');
  const [selectedServiceId, setSelectedServiceId] = useState('whatsapp');
  const [selectedType, setSelectedType] = useState<NumberType>('TEMPORARY');

  const [pricingExplainerOpen, setPricingExplainerOpen] = useState(false);
  const [legalModalOpen, setLegalModalOpen] = useState(false);
  const [legalTopic, setLegalTopic] = useState<'faq' | 'terms' | 'privacy' | 'refund' | 'acceptable'>('faq');

  const [activeOrderIdForClient, setActiveOrderIdForClient] = useState<string | undefined>(undefined);

  // Retour depuis la page de paiement FedaPay : ?payment_ref=<référence>
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const reference = params.get('payment_ref') ?? params.get('paymentRef');
    if (!reference) return;

    // Nettoie l'URL pour éviter de rejouer la vérification au rechargement.
    const url = new URL(window.location.href);
    url.searchParams.delete('payment_ref');
    url.searchParams.delete('paymentRef');
    window.history.replaceState({}, '', `${url.pathname}${url.search}${url.hash}`);

    void (async () => {
      const result = await verifyPaymentByReference(reference);
      if (!result.success) {
        setPaymentNotice({
          type: 'error',
          message: result.error ?? 'Impossible de vérifier le paiement.',
        });
        return;
      }

      if (result.orderId) setActiveOrderIdForClient(result.orderId);

      const status = result.orderStatus;
      if (status && ['PAID', 'PROCESSING', 'COMPLETED'].includes(status)) {
        setActiveTab('client-portal');
        setPaymentNotice({
          type: 'success',
          message: 'Paiement confirmé. Votre commande est en cours de traitement.',
        });
      } else if (result.payment?.purpose === 'TOPUP' && result.payment.status === 'APPROVED') {
        setActiveTab('client-portal');
        setPaymentNotice({
          type: 'success',
          message: 'Portefeuille rechargé avec succès.',
        });
      } else {
        setPaymentNotice({
          type: 'error',
          message:
            "Le paiement n'est pas encore confirmé. Vous pouvez vérifier à nouveau depuis votre espace client.",
        });
      }
    })();
  }, [verifyPaymentByReference]);

  // Gardes d'accès : les portails privés exigent une session valide.
  useEffect(() => {
    if (sessionLoading) return;

    if (!isAuthenticated && (activeTab === 'client-portal' || activeTab === 'admin-portal')) {
      setActiveTab('auth');
      return;
    }

    if (activeTab === 'admin-portal' && role !== 'ADMIN') {
      setActiveTab('client-portal');
    }
  }, [sessionLoading, isAuthenticated, role, activeTab]);

  const handleAuthSuccess = (user?: UserProfile) => {
    const nextRole = user?.role ?? currentUser?.role;
    setActiveTab(nextRole === 'ADMIN' ? 'admin-portal' : 'client-portal');
  };

  const handleSelectProduct = (countryCode: string, serviceId: string, type: NumberType = 'TEMPORARY') => {
    setSelectedCountryCode(countryCode);
    setSelectedServiceId(serviceId);
    setSelectedType(type);
    setPurchaseModalOpen(true);
  };

  const handlePurchaseSuccess = (orderId: string) => {
    setActiveOrderIdForClient(orderId);
    setActiveTab('client-portal');
  };

  const handleOpenLegal = (topic: 'terms' | 'privacy' | 'refund' | 'acceptable') => {
    setLegalTopic(topic);
    setLegalModalOpen(true);
  };

  if (sessionLoading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-3 bg-slate-50 dark:bg-slate-950 text-slate-600 dark:text-slate-300">
        <Loader2 className="w-6 h-6 animate-spin text-emerald-600" />
        <p className="text-xs font-medium">Chargement de votre session…</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 font-sans selection:bg-emerald-500 selection:text-white transition-colors duration-200">
      
      {/* Top Bar with Strict Contract */}
      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onOpenBuyModal={() => setPurchaseModalOpen(true)}
      />

      {paymentNotice && (
        <div className="max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 pt-4">
          <div
            className={`p-3 rounded-lg border text-xs flex items-start gap-2 ${
              paymentNotice.type === 'success'
                ? 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300'
                : 'bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-300'
            }`}
            role="status"
          >
            {paymentNotice.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 shrink-0" />
            )}
            <span className="flex-1">{paymentNotice.message}</span>
            <button
              onClick={() => setPaymentNotice(null)}
              className="p-0.5 rounded hover:bg-black/5 dark:hover:bg-white/10"
              aria-label="Fermer la notification"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <main className="flex-1">
        
        {/* PUBLIC EXPLORE VIEW */}
        {activeTab === 'explore' && (
          <div>
            <LandingHero
              onSelectProduct={(c, s) => handleSelectProduct(c, s)}
              onExploreCatalog={() => {
                const el = document.getElementById('catalog-section');
                if (el) el.scrollIntoView({ behavior: 'smooth' });
              }}
              onOpenPricingExplainer={() => setPricingExplainerOpen(true)}
            />

            <CatalogSection
              onSelectProduct={(c, s, t) => handleSelectProduct(c, s, t)}
            />

            <PaymentMethodsGuide />

            {/* In-page 2000 XOF Margin Teaser Banner */}
            <section className="py-12 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800">
              <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="rounded-2xl border border-emerald-500/30 bg-gradient-to-r from-emerald-500/10 via-emerald-500/5 to-transparent p-5 sm:p-8 flex flex-col md:flex-row md:items-center justify-between gap-6">
                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] sm:text-xs font-semibold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
                      <TrendingUp className="w-4 h-4" />
                      <span>Modèle Commercial Conforme au Cahier des Charges</span>
                    </div>
                    <h3 className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-white">
                      Règle de Marge Nette de 2 000 XOF par Numéro Vendu
                    </h3>
                    <p className="text-xs text-slate-600 dark:text-slate-300 max-w-2xl leading-relaxed">
                      Numivo absorbe l'intégralité des frais de passerelle Mobile Money et cartes bancaires dans son calcul serveur pour garantir un bénéfice net minimal de 2 000 XOF par numéro, assurant la pérennité et la haute disponibilité du service.
                    </p>
                  </div>

                  <div className="flex flex-col sm:flex-row items-center gap-3 shrink-0">
                    <button
                      onClick={() => setPricingExplainerOpen(true)}
                      className="w-full sm:w-auto min-h-11 px-5 py-2.5 text-xs font-bold text-emerald-700 dark:text-emerald-300 bg-white dark:bg-slate-800 border border-emerald-300 dark:border-emerald-700 rounded-lg hover:bg-emerald-50 dark:hover:bg-slate-700 transition-colors flex items-center justify-center gap-2"
                    >
                      <Calculator className="w-4 h-4" />
                      <span>Voir le calcul mathématique</span>
                    </button>
                    <button
                      onClick={() => setPurchaseModalOpen(true)}
                      className="w-full sm:w-auto min-h-11 px-5 py-2.5 text-xs font-bold text-white bg-emerald-700 hover:bg-emerald-800 rounded-lg transition-colors shadow-sm flex items-center justify-center gap-2"
                    >
                      <span>Commander un numéro</span>
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            </section>
          </div>
        )}

        {/* PRICING & MARGIN RULES VIEW */}
        {activeTab === 'pricing-rules' && (
          <div className="py-10 sm:py-12 max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6 sm:space-y-8">
            <div className="text-center max-w-2xl mx-auto space-y-2">
              <div className="flex items-center justify-center gap-2 text-xs font-semibold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
                <span>Spécification Technique Article 7</span>
                <span aria-hidden="true">·</span>
                <span>Transparence Financière</span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white text-balance">
                Règle de Marge & Calcul de Prix Dynamique
              </h1>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Comment Numivo garantit 2 000 XOF de rentabilité nette tout en offrant les meilleurs tarifs aux utilisateurs.
              </p>
            </div>

            <div className="p-4 sm:p-6 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm space-y-4">
              <h2 className="text-base font-bold text-slate-900 dark:text-white">
                La Formule de Prix du Cahier des Charges
              </h2>
              <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                Pour chaque numéro virtuel vendu, le système vise un minimum de <strong>2 000 XOF de marge nette estimée</strong> après déduction du coût fournisseur Ultra SMS converti en XOF, des commissions du prestataire de paiement (FedaPay, KKiaPay, Cartes Visa/Mastercard) et des frais fixes éventuels.
              </p>

              <div className="p-4 bg-slate-50 dark:bg-slate-950 rounded-xl border border-slate-200 dark:border-slate-800 font-mono text-center text-sm font-bold text-emerald-700 dark:text-emerald-400">
                P = (C + F + FX + M) / (1 - r)
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-1.5">
                  <div className="font-bold text-slate-900 dark:text-white">Variables de la Formule :</div>
                  <ul className="space-y-1 font-mono text-[11px] text-slate-600 dark:text-slate-400">
                    <li><strong>C :</strong> Coût fournisseur Ultra SMS converti en XOF</li>
                    <li><strong>M :</strong> Marge cible fixée à 2 000 XOF</li>
                    <li><strong>r :</strong> Taux de commission paiement (ex: 1.8% MoMo, 3.6% Carte)</li>
                    <li><strong>F :</strong> Frais fixes éventuels (0 XOF)</li>
                    <li><strong>FX :</strong> Frais de conversion de devise (0%)</li>
                    <li><strong>P :</strong> Prix final payé par le client</li>
                  </ul>
                </div>

                <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-1.5">
                  <div className="font-bold text-slate-900 dark:text-white">Exemple Concret (Numéro Bénin) :</div>
                  <ul className="space-y-1 font-mono text-[11px] text-slate-600 dark:text-slate-400">
                    <li>Coût Ultra SMS (C) : 1 200 XOF</li>
                    <li>Marge cible (M) : 2 000 XOF</li>
                    <li>Frais carte (r = 3.6%) : (1200 + 2000) / (1 - 0.036) = 3 319 XOF</li>
                    <li>Arrondi au palier supérieur : <strong>3 400 XOF</strong></li>
                    <li>Commission carte : 122.4 XOF</li>
                    <li className="text-emerald-700 dark:text-emerald-400 font-bold">Marge réelle réalisée : 2 077.6 XOF (≥ 2 000 XOF ✓)</li>
                  </ul>
                </div>
              </div>

              <div className="pt-2 flex justify-center">
                <button
                  onClick={() => setPricingExplainerOpen(true)}
                  className="px-5 py-2.5 text-xs font-bold text-white bg-emerald-700 hover:bg-emerald-800 rounded-lg transition-colors flex items-center gap-2"
                >
                  <Calculator className="w-4 h-4" />
                  <span>Ouvrir le simulateur interactif avec curseur</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* PAYMENTS VIEW */}
        {activeTab === 'payments' && (
          <div>
            <PaymentMethodsGuide />
          </div>
        )}

        {/* FAQ VIEW */}
        {activeTab === 'faq' && (
          <div className="py-10 sm:py-12 max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 space-y-4 sm:space-y-6">
            <div className="text-center space-y-2 mb-8">
              <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white text-balance">
                Foire Aux Questions & Garanties Numivo
              </h1>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Toutes les réponses sur le fonctionnement des numéros, les SMS et vos paiements.
              </p>
            </div>

            <div className="space-y-4 text-xs">
              <div className="p-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-2">
                <h2 className="font-bold text-slate-900 dark:text-white text-sm">
                  Comment Numivo s'assure-t-il que je reçoive mon SMS ?
                </h2>
                <p className="text-slate-600 dark:text-slate-300 leading-relaxed">
                  Numivo est relié directement par API webhook à Ultra SMS, l'un des plus grands réseaux télécoms mondiaux. Dès que vous initiez l'envoi de votre code sur WhatsApp, Telegram ou Google, le SMS est capturé par notre serveur et poussé en direct sur votre écran sans aucun rechargement de page.
                </p>
              </div>

              <div className="p-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-2">
                <h2 className="font-bold text-slate-900 dark:text-white text-sm">
                  Que faire si l'application m'indique que le numéro est invalide ou déjà utilisé ?
                </h2>
                <p className="text-slate-600 dark:text-slate-300 leading-relaxed">
                  Dans les rares cas où un numéro alloué a déjà fait l'objet d'une tentative récente sur le service tiers, vous n'avez qu'à cliquer sur le bouton <strong>"Annuler et Recréditer"</strong> sur votre tableau de bord. Votre solde est intégralement réapprovisionné et vous pouvez sélectionner un nouveau numéro en 1 clic.
                </p>
              </div>

              <div className="p-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-2">
                <h2 className="font-bold text-slate-900 dark:text-white text-sm">
                  Puis-je recharger mon portefeuille en Franc CFA (XOF) et acheter en EUR ?
                </h2>
                <p className="text-slate-600 dark:text-slate-300 leading-relaxed">
                  Le système gère chaque devise dans un compartiment dédié et sécurisé. Si vous déposez des Francs CFA via MTN MoMo ou Moov Money, votre solde principal XOF est crédité. Pour acheter des numéros facturés en EUR ou USD, le taux de conversion officiel de la BCEAO (1 EUR = 655.957 XOF) est appliqué en toute transparence.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* AUTH VIEW (Connexion & Inscription) */}
        {activeTab === 'auth' && (
          <AuthPage
            onSuccess={handleAuthSuccess}
            onOpenLegal={handleOpenLegal}
          />
        )}

        {/* CLIENT PORTAL VIEW */}
        {activeTab === 'client-portal' && (
          <ClientDashboard
            onOpenBuyModal={() => setPurchaseModalOpen(true)}
            selectedOrderId={activeOrderIdForClient}
          />
        )}

        {/* ADMIN PORTAL VIEW */}
        {activeTab === 'admin-portal' && (
          <AdminDashboard />
        )}

      </main>

      {/* Footer */}
      <Footer
        onOpenLegal={handleOpenLegal}
        setActiveTab={setActiveTab}
      />

      {/* PURCHASE FLOW MODAL */}
      <PurchaseModal
        isOpen={purchaseModalOpen}
        onClose={() => setPurchaseModalOpen(false)}
        initialCountryCode={selectedCountryCode}
        initialServiceId={selectedServiceId}
        initialType={selectedType}
        onSuccess={handlePurchaseSuccess}
        onRequireAuth={() => {
          setPurchaseModalOpen(false);
          setActiveTab('auth');
        }}
      />

      {/* PRICING MATH EXPLAINER MODAL */}
      <PricingCalculatorModal
        isOpen={pricingExplainerOpen}
        onClose={() => setPricingExplainerOpen(false)}
      />

      {/* LEGAL & TERMS MODAL */}
      <FaqAndLegalModal
        isOpen={legalModalOpen}
        onClose={() => setLegalModalOpen(false)}
        initialTopic={legalTopic}
      />

    </div>
  );
}

export default function App() {
  return (
    <AppProvider>
      <MainApp />
    </AppProvider>
  );
}
