/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { AppProvider, useApp } from './context/AppContext';
import { Header } from './components/common/Header';
import { Footer } from './components/common/Footer';
import { ToastContainer } from './components/common/ToastContainer';
import { HeroSection } from './components/public/HeroSection';
import { PublicCatalog } from './components/public/PublicCatalog';
import { HowItWorks } from './components/public/HowItWorks';
import { PricingExplanationView } from './components/public/PricingExplanationView';
import { FAQSection } from './components/public/FAQSection';
import { LegalModal } from './components/public/LegalModal';
import { OrderWizardModal } from './components/client/OrderWizardModal';
import { MyOrdersView } from './components/client/MyOrdersView';
import { WalletView } from './components/client/WalletView';
import { AdminDashboard } from './components/admin/AdminDashboard';
import { AdminAuthModal } from './components/admin/AdminAuthModal';
import { Lock, ShieldAlert, KeyRound } from 'lucide-react';

const MainContent: React.FC = () => {
  const {
    currentRole,
    adminAuthenticated,
    isAdminAuthModalOpen,
    setIsAdminAuthModalOpen,
    verifyAdminPin,
    switchRole,
  } = useApp();

  const [activeTab, setActiveTab] = useState<string>('catalog');

  // Modals state
  const [isBuyModalOpen, setIsBuyModalOpen] = useState(false);
  const [preselectedCountry, setPreselectedCountry] = useState('BJ');
  const [preselectedService, setPreselectedService] = useState('whatsapp');
  const [legalModalTopic, setLegalModalTopic] = useState<'terms' | 'privacy' | 'refund' | 'acceptable-use' | null>(null);

  const handleOpenBuyModal = (countryCode = 'BJ', serviceId = 'whatsapp') => {
    setPreselectedCountry(countryCode);
    setPreselectedService(serviceId);
    setIsBuyModalOpen(true);
  };

  const handleOrderSuccess = (orderId: string) => {
    setIsBuyModalOpen(false);
    setActiveTab('orders');
  };

  return (
    <div className="min-h-screen flex flex-col bg-neutral-50 dark:bg-neutral-950 text-neutral-900 dark:text-neutral-100 transition-colors">
      {/* Top Bar Contract Navigation */}
      <Header
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onOpenBuyModal={() => handleOpenBuyModal()}
      />

      {/* Main View Area */}
      <main className="flex-1">
        {activeTab === 'catalog' && (
          <>
            <HeroSection
              onOpenBuyModal={handleOpenBuyModal}
              onExploreCatalog={() => {
                const el = document.getElementById('catalog-section');
                if (el) el.scrollIntoView({ behavior: 'smooth' });
              }}
              onOpenPricingExplanation={() => setActiveTab('pricing-rules')}
            />
            <div id="catalog-section">
              <PublicCatalog
                onOpenBuyModal={handleOpenBuyModal}
                onOpenPricingExplanation={() => setActiveTab('pricing-rules')}
              />
            </div>
            <HowItWorks onOpenBuyModal={() => handleOpenBuyModal()} />
            <FAQSection />
          </>
        )}

        {activeTab === 'how-it-works' && (
          <HowItWorks onOpenBuyModal={() => handleOpenBuyModal()} />
        )}

        {activeTab === 'pricing-rules' && (
          <PricingExplanationView onOpenBuyModal={() => handleOpenBuyModal()} />
        )}

        {activeTab === 'orders' && (
          <MyOrdersView onOpenBuyModal={() => handleOpenBuyModal()} />
        )}

        {activeTab === 'wallet' && (
          <WalletView />
        )}

        {activeTab === 'admin' && (
          adminAuthenticated ? (
            <AdminDashboard />
          ) : (
            <div className="py-20 max-w-xl mx-auto px-4 text-center">
              <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-3xl p-8 shadow-xl">
                <div className="w-16 h-16 rounded-3xl bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400 flex items-center justify-center mx-auto mb-5">
                  <Lock className="w-8 h-8" />
                </div>
                <h2 className="text-2xl font-bold text-neutral-900 dark:text-white mb-2">
                  Espace Administrateur Verrouillé
                </h2>
                <p className="text-xs text-neutral-500 leading-relaxed max-w-md mx-auto mb-6">
                  Cet espace est strictement réservé à la direction Numivo et protégé contre les piratages. Veuillez renseigner votre code PIN secret de sécurité pour déverrouiller la console.
                </p>
                <button
                  onClick={() => setIsAdminAuthModalOpen(true)}
                  className="bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs px-6 py-3 rounded-xl transition-colors inline-flex items-center gap-2 cursor-pointer shadow-sm"
                >
                  <KeyRound className="w-4 h-4" />
                  <span>Saisir le code d'accès de sécurité</span>
                </button>
              </div>
            </div>
          )
        )}

        {activeTab === 'faq' && (
          <FAQSection />
        )}
      </main>

      {/* Footer */}
      <Footer
        onOpenLegal={(topic) => setLegalModalTopic(topic)}
      />

      {/* Modals & Popups */}
      {isBuyModalOpen && (
        <OrderWizardModal
          initialCountryCode={preselectedCountry}
          initialServiceId={preselectedService}
          onClose={() => setIsBuyModalOpen(false)}
          onOrderSuccess={handleOrderSuccess}
        />
      )}

      {legalModalTopic && (
        <LegalModal
          initialTopic={legalModalTopic}
          onClose={() => setLegalModalTopic(null)}
        />
      )}

      {/* Secure Admin Authentication Modal */}
      <AdminAuthModal
        isOpen={isAdminAuthModalOpen}
        onClose={() => setIsAdminAuthModalOpen(false)}
        onSuccess={() => {
          setActiveTab('admin');
        }}
        onVerifyPin={verifyAdminPin}
      />

      {/* Toast Feedback */}
      <ToastContainer />
    </div>
  );
};

export default function App() {
  return (
    <AppProvider>
      <MainContent />
    </AppProvider>
  );
}
