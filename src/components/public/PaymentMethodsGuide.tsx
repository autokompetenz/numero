import React from 'react';
import { Smartphone, CreditCard, Wallet, ShieldCheck, CheckCircle2, Clock, Globe } from 'lucide-react';

export const PaymentMethodsGuide: React.FC = () => {
  return (
    <section className="py-12 sm:py-16 bg-slate-50 dark:bg-slate-900/60 border-b border-slate-200 dark:border-slate-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Section Title */}
        <div className="text-center max-w-3xl mx-auto mb-12">
          <div className="flex flex-wrap items-center justify-center gap-x-2 gap-y-1 text-[11px] sm:text-xs font-semibold uppercase tracking-wider text-emerald-700 dark:text-emerald-400 mb-2">
            <span>Passerelles Agréées</span>
            <span aria-hidden="true">·</span>
            <span>Afrique de l'Ouest & International</span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white text-balance">
            Moyens de Paiement Intégrés
          </h2>
          <p className="text-sm text-slate-600 dark:text-slate-400 mt-2">
            Réglez vos commandes en toute sécurité via Mobile Money régional (MTN, Moov, Celtiis), cartes bancaires internationales certifiées 3D Secure, ou votre portefeuille Numivo.
          </p>
        </div>

        {/* 3 Payment Rails Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          
          {/* Card 1: Mobile Money */}
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 sm:p-6 flex flex-col justify-between shadow-sm">
            <div>
              <div className="w-12 h-12 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center mb-4">
                <Smartphone className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-1">
                Mobile Money Afrique
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
                Bénin, Côte d'Ivoire, Sénégal, Togo et zone UEMOA.
              </p>

              <div className="space-y-2.5 text-xs text-slate-600 dark:text-slate-300">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                  <span><strong>MTN MoMo :</strong> Bénin & UEMOA</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                  <span><strong>Moov Money :</strong> Flooz régional</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                  <span><strong>Celtiis Money :</strong> Réseau SBIN Bénin</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                  <span>Agrégateurs partenaires : <strong>FedaPay</strong> & <strong>KKiaPay</strong></span>
                </div>
              </div>
            </div>

            <div className="mt-6 pt-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-[11px] font-mono text-slate-500 dark:text-slate-400">
              <span>Commission : ~1.8%</span>
              <span className="text-emerald-700 dark:text-emerald-400 font-semibold">Validation instantanée</span>
            </div>
          </div>

          {/* Card 2: Cartes Bancaires */}
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 sm:p-6 flex flex-col justify-between shadow-sm">
            <div>
              <div className="w-12 h-12 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center mb-4">
                <CreditCard className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-1">
                Cartes Bancaires Internationales
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
                Clientèle locale et internationale en XOF, EUR et USD.
              </p>

              <div className="space-y-2.5 text-xs text-slate-600 dark:text-slate-300">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                  <span><strong>Visa & Mastercard :</strong> Cartes locales & mondiales</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                  <span><strong>Protocole 3D Secure :</strong> Authentification bancaire OTP</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                  <span><strong>Zéro rétention :</strong> Numéros et CVV jamais stockés</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                  <span>Gestion des devises XOF, EUR (€) et USD ($)</span>
                </div>
              </div>
            </div>

            <div className="mt-6 pt-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-[11px] font-mono text-slate-500 dark:text-slate-400">
              <span>Commission : ~3.6%</span>
              <span className="text-emerald-700 dark:text-emerald-400 font-semibold">Validation serveur</span>
            </div>
          </div>

          {/* Card 3: Portefeuille Multi-Devises */}
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 sm:p-6 flex flex-col justify-between shadow-sm">
            <div>
              <div className="w-12 h-12 rounded-xl bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 flex items-center justify-center mb-4">
                <Wallet className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-1">
                Portefeuille Interne Numivo
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
                Commandes en 1 clic sans frais supplémentaires.
              </p>

              <div className="space-y-2.5 text-xs text-slate-600 dark:text-slate-300">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                  <span><strong>Comptes cloisonnés :</strong> Soldes XOF, EUR, USD distincts</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                  <span><strong>Débit atomique :</strong> Achat immédiat en 1 seconde</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                  <span><strong>Recharge facile :</strong> Dépôts par MoMo ou Carte</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                  <span><strong>Registre immuable :</strong> Traçabilité comptable inviolable</span>
                </div>
              </div>
            </div>

            <div className="mt-6 pt-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-[11px] font-mono text-slate-500 dark:text-slate-400">
              <span>Frais d'achat : 0 XOF (0%)</span>
              <span className="text-emerald-700 dark:text-emerald-400 font-semibold">1-Clic Instantané</span>
            </div>
          </div>

        </div>

      </div>
    </section>
  );
};
