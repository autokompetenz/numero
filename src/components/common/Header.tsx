/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { Currency, UserRole } from '../../types';
import {
  Moon,
  Sun,
  Shield,
  User as UserIcon,
  ShoppingBag,
  Lock,
  Menu,
  X,
  Smartphone,
  Wallet as WalletIcon,
  HelpCircle,
  Layers,
  FileCheck2,
  ChevronRight,
} from 'lucide-react';
import { formatCurrency } from '../../services/pricingEngine';

interface HeaderProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  onOpenBuyModal: () => void;
}

export const Header: React.FC<HeaderProps> = ({ activeTab, setActiveTab, onOpenBuyModal }) => {
  const {
    currentRole,
    switchRole,
    currency,
    setCurrency,
    darkMode,
    toggleDarkMode,
    wallets,
    orders,
    currentUser,
    adminAuthenticated,
    setIsAdminAuthModalOpen,
    lockAdminSession,
  } = useApp();

  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // Active orders awaiting SMS (for badge indicator)
  const activeOrdersCount = orders.filter(
    (o) => o.status === 'PROCESSING' || o.status === 'PAID'
  ).length;

  const currentWallet = wallets.find(
    (w) => w.userId === (currentUser?.id || 'user_client_1') && w.currency === currency
  );

  const handleNavClick = (tab: string) => {
    setActiveTab(tab);
    setIsMobileMenuOpen(false);
  };

  return (
    <>
      <header className="sticky top-0 z-40 w-full bg-white/95 dark:bg-neutral-900/95 backdrop-blur-md border-b border-neutral-200 dark:border-neutral-800 transition-colors">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-2 sm:gap-4">
          {/* Zone 1: Brand Wordmark */}
          <div className="flex items-center gap-3 shrink-0">
            <button
              onClick={() => handleNavClick('catalog')}
              className="flex items-center gap-2 group text-left cursor-pointer min-h-[44px]"
              aria-label="Accueil Numivo"
            >
              <div className="w-9 h-9 rounded-xl bg-emerald-600 flex items-center justify-center text-white font-bold text-lg shadow-sm group-hover:bg-emerald-500 transition-colors shrink-0">
                N
              </div>
              <div>
                <span className="text-xl font-bold tracking-tight text-neutral-900 dark:text-white block leading-tight">
                  Numivo
                </span>
                <span className="text-[10px] text-neutral-500 dark:text-neutral-400 font-medium block -mt-0.5">
                  Numéros Virtuels & SMS
                </span>
              </div>
            </button>
          </div>

          {/* Zone 2: Desktop Navigation Links (hidden on mobile/tablet) */}
          <nav className="hidden xl:flex items-center gap-5 text-xs font-semibold">
            <button
              onClick={() => handleNavClick('catalog')}
              className={`whitespace-nowrap transition-colors py-2 cursor-pointer ${
                activeTab === 'catalog'
                  ? 'text-emerald-600 dark:text-emerald-400'
                  : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white'
              }`}
            >
              Catalogue
            </button>

            <button
              onClick={() => handleNavClick('how-it-works')}
              className={`whitespace-nowrap transition-colors py-2 cursor-pointer ${
                activeTab === 'how-it-works'
                  ? 'text-emerald-600 dark:text-emerald-400'
                  : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white'
              }`}
            >
              Fonctionnement
            </button>

            <button
              onClick={() => handleNavClick('pricing-rules')}
              className={`whitespace-nowrap transition-colors py-2 cursor-pointer ${
                activeTab === 'pricing-rules'
                  ? 'text-emerald-600 dark:text-emerald-400'
                  : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white'
              }`}
            >
              Tarifs & Garanties
            </button>

            {currentRole !== 'VISITOR' && (
              <button
                onClick={() => handleNavClick('orders')}
                className={`whitespace-nowrap transition-colors py-2 flex items-center gap-1.5 cursor-pointer ${
                  activeTab === 'orders'
                    ? 'text-emerald-600 dark:text-emerald-400'
                    : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white'
                }`}
              >
                <span>Mes Numéros</span>
                {activeOrdersCount > 0 && (
                  <span className="bg-amber-500 text-white text-[10px] font-bold px-1.5 py-0.2 rounded-full animate-pulse">
                    {activeOrdersCount}
                  </span>
                )}
              </button>
            )}

            {currentRole !== 'VISITOR' && (
              <button
                onClick={() => handleNavClick('wallet')}
                className={`whitespace-nowrap transition-colors py-2 cursor-pointer ${
                  activeTab === 'wallet'
                    ? 'text-emerald-600 dark:text-emerald-400'
                    : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white'
                }`}
              >
                Portefeuille
              </button>
            )}

            {currentRole === 'ADMIN' && (
              <button
                onClick={() => handleNavClick('admin')}
                className={`whitespace-nowrap transition-colors flex items-center gap-1 py-2 cursor-pointer ${
                  activeTab === 'admin'
                    ? 'text-amber-600 dark:text-amber-400'
                    : 'text-amber-600/80 dark:text-amber-400/80 hover:text-amber-600 dark:hover:text-amber-300'
                }`}
              >
                <Shield className="w-3.5 h-3.5" />
                <span>Console Admin</span>
              </button>
            )}

            <button
              onClick={() => handleNavClick('faq')}
              className={`whitespace-nowrap transition-colors py-2 cursor-pointer ${
                activeTab === 'faq'
                  ? 'text-emerald-600 dark:text-emerald-400'
                  : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white'
              }`}
            >
              FAQ
            </button>
          </nav>

          {/* Zone 3: Desktop Actions (Role switcher, Currency, Theme, Buy button) */}
          <div className="hidden lg:flex items-center gap-2.5 shrink-0">
            {/* Currency Switcher */}
            <select
              value={currency}
              onChange={(e) => setCurrency(e.target.value as Currency)}
              aria-label="Sélectionner la devise"
              className="text-xs font-semibold bg-neutral-100 dark:bg-neutral-800 text-neutral-800 dark:text-neutral-200 border border-neutral-200 dark:border-neutral-700 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-emerald-500 cursor-pointer min-h-[36px]"
            >
              <option value="XOF">XOF (FCFA)</option>
              <option value="EUR">EUR (€)</option>
              <option value="USD">USD ($)</option>
            </select>

            {/* Role Switcher */}
            <div className="flex items-center bg-neutral-100 dark:bg-neutral-800 p-0.5 rounded-lg border border-neutral-200 dark:border-neutral-700 text-xs">
              <button
                onClick={() => switchRole('VISITOR')}
                title="Mode Visiteur public"
                className={`px-2 py-1 rounded font-medium transition-colors cursor-pointer ${
                  currentRole === 'VISITOR'
                    ? 'bg-white dark:bg-neutral-700 text-neutral-900 dark:text-white shadow-2xs'
                    : 'text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-200'
                }`}
              >
                Visiteur
              </button>
              <button
                onClick={() => switchRole('CLIENT')}
                title="Compte Client (Aminata Diallo)"
                className={`px-2 py-1 rounded font-medium transition-colors flex items-center gap-1 cursor-pointer ${
                  currentRole === 'CLIENT'
                    ? 'bg-white dark:bg-neutral-700 text-neutral-900 dark:text-white shadow-2xs'
                    : 'text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-200'
                }`}
              >
                <UserIcon className="w-3 h-3" />
                <span>Client</span>
              </button>
              <button
                onClick={() => {
                  if (!adminAuthenticated) {
                    setIsAdminAuthModalOpen(true);
                  } else {
                    switchRole('ADMIN');
                    setActiveTab('admin');
                  }
                }}
                title="Direction & Admin Numivo (Sécurisé par code PIN)"
                className={`px-2 py-1 rounded font-medium transition-colors flex items-center gap-1 cursor-pointer ${
                  currentRole === 'ADMIN'
                    ? 'bg-amber-600 text-white shadow-2xs'
                    : 'text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-200'
                }`}
              >
                {adminAuthenticated ? (
                  <Shield className="w-3 h-3" />
                ) : (
                  <Lock className="w-3 h-3 text-amber-500" />
                )}
                <span>Admin</span>
              </button>
            </div>

            {/* Quick Lock Button when in Admin Mode */}
            {currentRole === 'ADMIN' && adminAuthenticated && (
              <button
                onClick={lockAdminSession}
                title="Verrouiller la session administrateur"
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 hover:bg-rose-100 dark:hover:bg-rose-900/50 transition-colors cursor-pointer min-h-[36px]"
              >
                <Lock className="w-3 h-3" />
                <span className="hidden xl:inline">Verrouiller</span>
              </button>
            )}

            {/* Dark / Light Toggle */}
            <button
              onClick={toggleDarkMode}
              aria-label="Basculer le thème clair ou sombre"
              className="p-2 rounded-lg text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors cursor-pointer min-h-[36px] min-w-[36px] flex items-center justify-center"
            >
              {darkMode ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4" />}
            </button>

            {/* Primary Action Button */}
            <button
              onClick={onOpenBuyModal}
              className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold px-3.5 py-2 rounded-lg shadow-2xs hover:shadow-xs transition-all whitespace-nowrap cursor-pointer shrink-0 min-h-[36px]"
            >
              <ShoppingBag className="w-3.5 h-3.5" />
              <span>Acheter un numéro</span>
            </button>
          </div>

          {/* Zone 4: Mobile & Tablet Compact Bar */}
          <div className="flex lg:hidden items-center gap-1.5 sm:gap-2">
            {/* Quick Currency Selector on Mobile */}
            <select
              value={currency}
              onChange={(e) => setCurrency(e.target.value as Currency)}
              aria-label="Sélectionner la devise"
              className="text-xs font-bold bg-neutral-100 dark:bg-neutral-800 text-neutral-800 dark:text-neutral-200 border border-neutral-200 dark:border-neutral-700 rounded-lg px-2 py-1.5 cursor-pointer h-10"
            >
              <option value="XOF">XOF</option>
              <option value="EUR">EUR</option>
              <option value="USD">USD</option>
            </select>

            {/* Quick CTA on Mobile */}
            <button
              onClick={onOpenBuyModal}
              className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold px-3 py-2 rounded-lg shadow-xs transition-all cursor-pointer h-10 min-w-[44px]"
              title="Acheter un numéro virtuel"
            >
              <ShoppingBag className="w-4 h-4" />
              <span className="hidden sm:inline">Acheter</span>
            </button>

            {/* Theme Toggle Button */}
            <button
              onClick={toggleDarkMode}
              aria-label="Basculer le thème"
              className="w-10 h-10 rounded-lg text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800 flex items-center justify-center transition-colors cursor-pointer"
            >
              {darkMode ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4" />}
            </button>

            {/* Hamburger Button (Touch Target >= 44x44px) */}
            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              aria-label={isMobileMenuOpen ? 'Fermer le menu' : 'Ouvrir le menu de navigation'}
              aria-expanded={isMobileMenuOpen}
              className="w-11 h-11 rounded-xl bg-neutral-100 dark:bg-neutral-800 text-neutral-800 dark:text-neutral-200 flex items-center justify-center hover:bg-neutral-200 dark:hover:bg-neutral-700 transition-colors cursor-pointer focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              {isMobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </header>

      {/* Slide-over Mobile Navigation Drawer */}
      {isMobileMenuOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          {/* Backdrop Overlay */}
          <div
            onClick={() => setIsMobileMenuOpen(false)}
            className="fixed inset-0 bg-neutral-950/60 backdrop-blur-xs transition-opacity animate-in fade-in"
            aria-hidden="true"
          />

          {/* Drawer Panel */}
          <div className="relative ml-auto w-full max-w-sm bg-white dark:bg-neutral-900 h-full shadow-2xl flex flex-col justify-between overflow-y-auto border-l border-neutral-200 dark:border-neutral-800 animate-in slide-in-from-right duration-200">
            {/* Drawer Header */}
            <div className="p-4 sm:p-5 border-b border-neutral-200 dark:border-neutral-800 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-emerald-600 flex items-center justify-center text-white font-bold text-sm">
                  N
                </div>
                <div>
                  <span className="font-bold text-neutral-900 dark:text-white block leading-tight">
                    Numivo
                  </span>
                  <span className="text-[10px] text-neutral-500 dark:text-neutral-400">
                    Menu & Espaces
                  </span>
                </div>
              </div>

              <button
                onClick={() => setIsMobileMenuOpen(false)}
                className="w-10 h-10 rounded-lg text-neutral-500 hover:text-neutral-900 dark:hover:text-white flex items-center justify-center hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors cursor-pointer"
                aria-label="Fermer le menu"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Drawer Body */}
            <div className="p-4 sm:p-5 space-y-6 flex-1">
              {/* Role Selection Container */}
              <div className="space-y-2">
                <span className="text-[11px] font-bold uppercase tracking-wider text-neutral-400 block">
                  Espace Actif
                </span>
                <div className="grid grid-cols-3 gap-1.5 p-1 bg-neutral-100 dark:bg-neutral-800/80 rounded-xl">
                  <button
                    onClick={() => {
                      switchRole('VISITOR');
                      setActiveTab('catalog');
                    }}
                    className={`py-2 px-1 text-xs font-semibold rounded-lg text-center transition-all cursor-pointer min-h-[44px] flex flex-col items-center justify-center ${
                      currentRole === 'VISITOR'
                        ? 'bg-white dark:bg-neutral-700 text-neutral-900 dark:text-white shadow-2xs'
                        : 'text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-200'
                    }`}
                  >
                    <span>Visiteur</span>
                  </button>

                  <button
                    onClick={() => {
                      switchRole('CLIENT');
                    }}
                    className={`py-2 px-1 text-xs font-semibold rounded-lg text-center transition-all cursor-pointer min-h-[44px] flex flex-col items-center justify-center ${
                      currentRole === 'CLIENT'
                        ? 'bg-white dark:bg-neutral-700 text-neutral-900 dark:text-white shadow-2xs'
                        : 'text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-200'
                    }`}
                  >
                    <span className="flex items-center gap-1">
                      <UserIcon className="w-3 h-3" /> Client
                    </span>
                  </button>

                  <button
                    onClick={() => {
                      if (!adminAuthenticated) {
                        setIsMobileMenuOpen(false);
                        setIsAdminAuthModalOpen(true);
                      } else {
                        switchRole('ADMIN');
                        handleNavClick('admin');
                      }
                    }}
                    className={`py-2 px-1 text-xs font-semibold rounded-lg text-center transition-all cursor-pointer min-h-[44px] flex flex-col items-center justify-center ${
                      currentRole === 'ADMIN'
                        ? 'bg-amber-600 text-white shadow-2xs'
                        : 'text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-200'
                    }`}
                  >
                    <span className="flex items-center gap-1">
                      {adminAuthenticated ? (
                        <Shield className="w-3 h-3" />
                      ) : (
                        <Lock className="w-3 h-3 text-amber-500" />
                      )}
                      Admin
                    </span>
                  </button>
                </div>

                {/* Client info preview in mobile drawer */}
                {currentRole === 'CLIENT' && (
                  <div className="p-3 bg-neutral-50 dark:bg-neutral-800/60 rounded-xl border border-neutral-200 dark:border-neutral-700/60 text-xs flex items-center justify-between">
                    <div>
                      <span className="font-semibold text-neutral-800 dark:text-neutral-200 block">
                        Aminata Diallo
                      </span>
                      <span className="text-[10px] text-neutral-500 font-mono">
                        Solde {currency} :{' '}
                        {formatCurrency(currentWallet?.balanceMinor || 0, currency)}
                      </span>
                    </div>
                    <button
                      onClick={() => handleNavClick('wallet')}
                      className="text-emerald-600 dark:text-emerald-400 font-bold text-[11px] hover:underline cursor-pointer"
                    >
                      Recharger
                    </button>
                  </div>
                )}

                {/* Admin info & Lock button in mobile drawer */}
                {currentRole === 'ADMIN' && adminAuthenticated && (
                  <div className="p-3 bg-amber-50 dark:bg-amber-950/40 rounded-xl border border-amber-200 dark:border-amber-800 text-xs flex items-center justify-between">
                    <span className="text-amber-800 dark:text-amber-300 font-medium">
                      Session Admin active
                    </span>
                    <button
                      onClick={() => {
                        lockAdminSession();
                        setIsMobileMenuOpen(false);
                      }}
                      className="px-2.5 py-1 bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-300 rounded font-semibold text-[11px] cursor-pointer"
                    >
                      Verrouiller
                    </button>
                  </div>
                )}
              </div>

              {/* Navigation Links with large touch targets (>= 44px) */}
              <div className="space-y-1">
                <span className="text-[11px] font-bold uppercase tracking-wider text-neutral-400 block mb-1">
                  Navigation
                </span>

                <button
                  onClick={() => handleNavClick('catalog')}
                  className={`w-full flex items-center justify-between p-3 rounded-xl text-left text-sm font-semibold transition-colors cursor-pointer min-h-[44px] ${
                    activeTab === 'catalog'
                      ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300'
                      : 'text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800'
                  }`}
                >
                  <span className="flex items-center gap-3">
                    <Layers className="w-4 h-4 text-emerald-600" />
                    <span>Catalogue des Numéros</span>
                  </span>
                  <ChevronRight className="w-4 h-4 text-neutral-400" />
                </button>

                <button
                  onClick={() => handleNavClick('how-it-works')}
                  className={`w-full flex items-center justify-between p-3 rounded-xl text-left text-sm font-semibold transition-colors cursor-pointer min-h-[44px] ${
                    activeTab === 'how-it-works'
                      ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300'
                      : 'text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800'
                  }`}
                >
                  <span className="flex items-center gap-3">
                    <Smartphone className="w-4 h-4 text-emerald-600" />
                    <span>Comment ça marche</span>
                  </span>
                  <ChevronRight className="w-4 h-4 text-neutral-400" />
                </button>

                <button
                  onClick={() => handleNavClick('pricing-rules')}
                  className={`w-full flex items-center justify-between p-3 rounded-xl text-left text-sm font-semibold transition-colors cursor-pointer min-h-[44px] ${
                    activeTab === 'pricing-rules'
                      ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300'
                      : 'text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800'
                  }`}
                >
                  <span className="flex items-center gap-3">
                    <FileCheck2 className="w-4 h-4 text-emerald-600" />
                    <span>Tarifs & Garanties</span>
                  </span>
                  <ChevronRight className="w-4 h-4 text-neutral-400" />
                </button>

                {currentRole !== 'VISITOR' && (
                  <button
                    onClick={() => handleNavClick('orders')}
                    className={`w-full flex items-center justify-between p-3 rounded-xl text-left text-sm font-semibold transition-colors cursor-pointer min-h-[44px] ${
                      activeTab === 'orders'
                        ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300'
                        : 'text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800'
                    }`}
                  >
                    <span className="flex items-center gap-3">
                      <Smartphone className="w-4 h-4 text-emerald-600" />
                      <span>Mes Numéros & SMS</span>
                    </span>
                    {activeOrdersCount > 0 ? (
                      <span className="bg-amber-500 text-white text-xs font-bold px-2 py-0.5 rounded-full animate-pulse">
                        {activeOrdersCount}
                      </span>
                    ) : (
                      <ChevronRight className="w-4 h-4 text-neutral-400" />
                    )}
                  </button>
                )}

                {currentRole !== 'VISITOR' && (
                  <button
                    onClick={() => handleNavClick('wallet')}
                    className={`w-full flex items-center justify-between p-3 rounded-xl text-left text-sm font-semibold transition-colors cursor-pointer min-h-[44px] ${
                      activeTab === 'wallet'
                        ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300'
                        : 'text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800'
                    }`}
                  >
                    <span className="flex items-center gap-3">
                      <WalletIcon className="w-4 h-4 text-emerald-600" />
                      <span>Mon Portefeuille</span>
                    </span>
                    <ChevronRight className="w-4 h-4 text-neutral-400" />
                  </button>
                )}

                {currentRole === 'ADMIN' && (
                  <button
                    onClick={() => handleNavClick('admin')}
                    className={`w-full flex items-center justify-between p-3 rounded-xl text-left text-sm font-semibold transition-colors cursor-pointer min-h-[44px] ${
                      activeTab === 'admin'
                        ? 'bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300'
                        : 'text-amber-600 dark:text-amber-400 hover:bg-neutral-100 dark:hover:bg-neutral-800'
                    }`}
                  >
                    <span className="flex items-center gap-3">
                      <Shield className="w-4 h-4 text-amber-600" />
                      <span>Console Direction Admin</span>
                    </span>
                    <ChevronRight className="w-4 h-4 text-neutral-400" />
                  </button>
                )}

                <button
                  onClick={() => handleNavClick('faq')}
                  className={`w-full flex items-center justify-between p-3 rounded-xl text-left text-sm font-semibold transition-colors cursor-pointer min-h-[44px] ${
                    activeTab === 'faq'
                      ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300'
                      : 'text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800'
                  }`}
                >
                  <span className="flex items-center gap-3">
                    <HelpCircle className="w-4 h-4 text-emerald-600" />
                    <span>FAQ & Sécurité</span>
                  </span>
                  <ChevronRight className="w-4 h-4 text-neutral-400" />
                </button>
              </div>
            </div>

            {/* Drawer Sticky Footer with Buy CTA */}
            <div className="p-4 sm:p-5 border-t border-neutral-200 dark:border-neutral-800 space-y-3 bg-neutral-50 dark:bg-neutral-850">
              <button
                onClick={() => {
                  setIsMobileMenuOpen(false);
                  onOpenBuyModal();
                }}
                className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm py-3 px-4 rounded-xl shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer min-h-[48px]"
              >
                <ShoppingBag className="w-4 h-4" />
                <span>Commander un numéro immédiatement</span>
              </button>

              <div className="flex items-center justify-between text-[11px] text-neutral-500">
                <span>Paiements MTN, Moov, Celtiis</span>
                <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                  Garantie 20 min
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
