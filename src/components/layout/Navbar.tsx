import React, { useEffect, useState } from 'react';
import { useApp } from '../../context/AppContext';
import { Currency } from '../../types';
import {
  Moon,
  Sun,
  Shield,
  User,
  Globe,
  ChevronDown,
  Check,
  Smartphone,
  LogOut,
  Menu,
  X,
  ArrowRight,
} from 'lucide-react';

interface NavbarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  onOpenBuyModal?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({ activeTab, setActiveTab, onOpenBuyModal }) => {
  const { role, currency, setCurrency, theme, toggleTheme, wallet, currentUser, logout } = useApp();
  const [currencyMenuOpen, setCurrencyMenuOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const currencies: { code: Currency; label: string; symbol: string }[] = [
    { code: 'XOF', label: 'Franc CFA (XOF)', symbol: 'CFA' },
    { code: 'EUR', label: 'Euro (EUR)', symbol: '€' },
    { code: 'USD', label: 'Dollar US (USD)', symbol: '$' },
  ];

  const navItems = [
    { id: 'explore', label: 'Catalogue' },
    { id: 'pricing-rules', label: 'Tarifs' },
    { id: 'payments', label: 'Paiements' },
    { id: 'faq', label: 'FAQ' },
  ];

  // Close every overlay with Escape for keyboard users.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setMobileMenuOpen(false);
        setCurrencyMenuOpen(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  // Prevent the page from scrolling behind the mobile drawer.
  useEffect(() => {
    if (!mobileMenuOpen) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previous;
    };
  }, [mobileMenuOpen]);

  const navigate = (tab: string) => {
    setActiveTab(tab);
    setMobileMenuOpen(false);
    setCurrencyMenuOpen(false);
  };

  const roleLabel = role === 'ADMIN' ? 'Admin' : role === 'CLIENT' ? 'Client' : 'Visiteur';

  return (
    <>
    <header className="sticky top-0 z-40 w-full border-b border-slate-200/80 dark:border-slate-800/80 bg-white/90 dark:bg-slate-950/90 backdrop-blur-md supports-[backdrop-filter]:bg-white/75 dark:supports-[backdrop-filter]:bg-slate-950/75">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-3">

        {/* Brand */}
        <button
          onClick={() => navigate('explore')}
          className="flex items-center gap-2.5 text-left focus:outline-none shrink-0"
          aria-label="Numivo — retour à l'accueil"
        >
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-700 flex items-center justify-center text-white shadow-sm shadow-emerald-600/25">
            <Smartphone className="w-5 h-5 text-white" />
          </div>
          <span className="text-xl font-extrabold tracking-tight text-slate-900 dark:text-white whitespace-nowrap">
            Numivo
          </span>
        </button>

        {/* Desktop navigation */}
        <nav className="hidden lg:flex items-center gap-1 text-sm font-medium text-slate-600 dark:text-slate-300" aria-label="Navigation principale">
          {navItems.map((item) => (
            <button
              key={item.id}
              onClick={() => navigate(item.id)}
              aria-current={activeTab === item.id ? 'page' : undefined}
              className={`px-3 py-2 rounded-lg whitespace-nowrap transition-colors ${
                activeTab === item.id
                  ? 'bg-emerald-50 text-emerald-700 font-semibold dark:bg-emerald-950/40 dark:text-emerald-300'
                  : 'hover:bg-slate-100 hover:text-slate-900 dark:hover:bg-slate-800 dark:hover:text-white'
              }`}
            >
              {item.label}
            </button>
          ))}
        </nav>

        {/* Actions */}
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">

          {/* Currency */}
          <div className="relative hidden sm:block">
            <button
              onClick={() => {
                setCurrencyMenuOpen(!currencyMenuOpen);
              }}
              aria-expanded={currencyMenuOpen}
              aria-haspopup="listbox"
              className="flex items-center gap-1.5 h-9 px-2.5 text-xs font-semibold rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              title="Devise d'affichage"
            >
              <Globe className="w-3.5 h-3.5 opacity-50" />
              <span>{currency}</span>
              <ChevronDown className="w-3.5 h-3.5 opacity-60" />
            </button>

            {currencyMenuOpen && (
              <div className="absolute right-0 mt-2 w-52 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xl shadow-slate-900/10 py-1.5 z-50">
                <div className="px-3 py-1.5 text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  Devise d'affichage
                </div>
                {currencies.map((curr) => (
                  <button
                    key={curr.code}
                    onClick={() => {
                      setCurrency(curr.code);
                      setCurrencyMenuOpen(false);
                    }}
                    className="w-full flex items-center justify-between px-3 py-2 text-xs text-left text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                  >
                    <span className="font-medium">{curr.label}</span>
                    {currency === curr.code && <Check className="w-3.5 h-3.5 text-emerald-700 dark:text-emerald-400" />}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Theme */}
          <button
            onClick={toggleTheme}
            className="flex items-center justify-center w-9 h-9 text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            title={theme === 'dark' ? 'Passer au mode clair' : 'Passer au mode sombre'}
            aria-label={theme === 'dark' ? 'Passer au mode clair' : 'Passer au mode sombre'}
          >
            {theme === 'dark' ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-slate-700" />}
          </button>

          {/* Identité de la session courante (desktop) */}
          {currentUser && (
            <div className="relative hidden lg:flex items-center gap-2 h-9 px-2.5 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200">
              {role === 'ADMIN' ? (
                <Shield className="w-3.5 h-3.5 text-indigo-500" />
              ) : (
                <User className="w-3.5 h-3.5 text-emerald-500" />
              )}
              <span className="font-semibold max-w-[10rem] truncate">
                {currentUser.name || currentUser.email}
              </span>
              <span className="text-[10px] uppercase tracking-wider text-slate-400">
                {roleLabel}
              </span>
            </div>
          )}

          {/* Primary actions */}
          {role === 'ADMIN' ? (
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => navigate('admin-portal')}
                className="hidden sm:inline-flex items-center h-9 px-3.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors whitespace-nowrap shadow-sm"
              >
                Console Admin
              </button>
              <button
                onClick={() => {
                  logout();
                  navigate('explore');
                }}
                className="flex items-center justify-center w-9 h-9 rounded-lg text-slate-500 dark:text-slate-400 hover:text-rose-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                title="Déconnexion"
                aria-label="Déconnexion"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          ) : role === 'CLIENT' ? (
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => navigate('client-portal')}
                className="inline-flex items-center h-9 px-3 sm:px-3.5 text-xs font-semibold text-white bg-emerald-700 hover:bg-emerald-800 rounded-lg transition-colors whitespace-nowrap shadow-sm"
              >
                <span className="hidden sm:inline">Mon Espace&nbsp;·&nbsp;</span>
                <span className="font-mono">{wallet.balances.XOF.toLocaleString('fr-FR')}</span>
                <span className="ml-1">XOF</span>
              </button>
              <button
                onClick={() => {
                  logout();
                  navigate('explore');
                }}
                className="hidden sm:flex items-center justify-center w-9 h-9 rounded-lg text-slate-500 dark:text-slate-400 hover:text-rose-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                title="Déconnexion"
                aria-label="Déconnexion"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => navigate('auth')}
                className="hidden md:inline-flex items-center h-9 px-3 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:text-emerald-600 dark:hover:text-emerald-400 border border-slate-200 dark:border-slate-700 rounded-lg transition-colors whitespace-nowrap"
              >
                Connexion
              </button>
              <button
                onClick={() => {
                  setMobileMenuOpen(false);
                  if (onOpenBuyModal) onOpenBuyModal();
                  else setActiveTab('explore');
                }}
                className="inline-flex items-center h-9 px-3 sm:px-3.5 text-xs font-semibold text-white bg-emerald-700 hover:bg-emerald-800 rounded-lg transition-colors whitespace-nowrap shadow-sm shadow-emerald-600/20"
              >
                <span className="hidden sm:inline">Acheter un numéro</span>
                <span className="sm:hidden">Acheter</span>
              </button>
            </div>
          )}

          {/* Mobile / tablet menu trigger */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-expanded={mobileMenuOpen}
            aria-controls="mobile-menu"
            aria-label={mobileMenuOpen ? 'Fermer le menu' : 'Ouvrir le menu'}
            className="lg:hidden flex items-center justify-center w-9 h-9 rounded-lg text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>
    </header>

      {/* Mobile / tablet drawer */}
      {mobileMenuOpen && (
        <div className="lg:hidden fixed inset-x-0 top-16 bottom-0 z-50 bg-slate-900/40 dark:bg-black/60 backdrop-blur-sm" onClick={() => setMobileMenuOpen(false)}>
          <div
            id="mobile-menu"
            className="absolute inset-x-0 top-0 max-h-full overflow-y-auto bg-white dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-4 sm:px-6 py-5 space-y-6">

              {/* Navigation */}
              <nav className="space-y-1" aria-label="Navigation mobile">
                {navItems.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => navigate(item.id)}
                    className={`w-full flex items-center justify-between px-3 py-3 rounded-xl text-sm font-semibold transition-colors ${
                      activeTab === item.id
                        ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300'
                        : 'text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-900'
                    }`}
                  >
                    <span>{item.label}</span>
                    <ArrowRight className="w-4 h-4 opacity-40" />
                  </button>
                ))}

                {(role === 'CLIENT' || role === 'ADMIN') && (
                  <button
                    onClick={() => navigate(role === 'ADMIN' ? 'admin-portal' : 'client-portal')}
                    className="w-full flex items-center justify-between px-3 py-3 rounded-xl text-sm font-semibold text-emerald-700 dark:text-emerald-300 bg-emerald-50/60 dark:bg-emerald-950/30"
                  >
                    <span className="flex items-center gap-2">
                      {role === 'ADMIN' ? <Shield className="w-4 h-4" /> : <User className="w-4 h-4" />}
                      {role === 'ADMIN' ? 'Console Admin' : 'Mon Espace Client'}
                    </span>
                    <ArrowRight className="w-4 h-4 opacity-40" />
                  </button>
                )}

                {role === 'VISITOR' && (
                  <button
                    onClick={() => navigate('auth')}
                    className="w-full flex items-center justify-between px-3 py-3 rounded-xl text-sm font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-900"
                  >
                    <span>Connexion / Inscription</span>
                    <ArrowRight className="w-4 h-4 opacity-40" />
                  </button>
                )}
              </nav>

              {/* Currency */}
              <div>
                <p className="px-1 mb-2 text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Devise d'affichage
                </p>
                <div className="grid grid-cols-3 gap-2">
                  {currencies.map((curr) => (
                    <button
                      key={curr.code}
                      onClick={() => setCurrency(curr.code)}
                      className={`rounded-xl border px-2 py-2.5 text-xs font-semibold transition-colors ${
                        currency === curr.code
                          ? 'border-emerald-500 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300'
                          : 'border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300'
                      }`}
                    >
                      {curr.code}
                    </button>
                  ))}
                </div>
              </div>

              {/* Utilities */}
              <div className="flex items-center gap-2 pt-1">
                <button
                  onClick={toggleTheme}
                  className="flex-1 inline-flex items-center justify-center gap-2 h-10 rounded-xl border border-slate-200 dark:border-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-200"
                >
                  {theme === 'dark' ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4" />}
                  {theme === 'dark' ? 'Mode clair' : 'Mode sombre'}
                </button>
              </div>

              {(role === 'CLIENT' || role === 'ADMIN') && (
                <p className="text-center text-xs text-slate-500 dark:text-slate-400">
                  Connecté en tant que <span className="font-semibold text-slate-700 dark:text-slate-200">{currentUser?.name}</span>
                  {role === 'CLIENT' && (
                    <>
                      {' '}· solde <span className="font-mono font-semibold">{wallet.balances.XOF.toLocaleString('fr-FR')} XOF</span>
                    </>
                  )}
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
};
