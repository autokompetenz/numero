/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { ShieldCheck, PhoneCall, RefreshCw, Lock, HelpCircle } from 'lucide-react';

interface FooterProps {
  onOpenLegal: (topic: 'terms' | 'privacy' | 'refund' | 'acceptable-use') => void;
}

export const Footer: React.FC<FooterProps> = ({ onOpenLegal }) => {
  return (
    <footer className="bg-neutral-100 dark:bg-neutral-950 border-t border-neutral-200 dark:border-neutral-800 pt-12 pb-8 text-neutral-600 dark:text-neutral-400 text-sm transition-colors">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-12">
          {/* Col 1: Brand & Presentation */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-emerald-600 flex items-center justify-center text-white font-bold text-sm">
                N
              </div>
              <span className="text-lg font-bold text-neutral-900 dark:text-white">Numivo</span>
            </div>
            <p className="text-xs text-neutral-500 dark:text-neutral-400 leading-relaxed">
              Plateforme internationale d’activation de numéros virtuels temporaires et permanents pour la réception sécurisée de SMS et codes OTP.
            </p>
            <div className="text-xs text-neutral-500">
              Devise de référence comptable : <span className="font-semibold text-neutral-700 dark:text-neutral-300">XOF (FCFA)</span>
            </div>
          </div>

          {/* Col 2: Moyens de Paiement Autorisés */}
          <div className="space-y-3">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-neutral-900 dark:text-white">
              Paiements Sécurisés
            </h4>
            <div className="space-y-2 text-xs">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                <span>MTN Mobile Money (MoMo)</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                <span>Moov Money & Celtiis Cash</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                <span>Cartes Visa & Mastercard (3D Secure)</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-purple-500"></span>
                <span>Portefeuille multi-devises (XOF, EUR, USD)</span>
              </div>
            </div>
          </div>

          {/* Col 3: Engagements & Garanties */}
          <div className="space-y-3">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-neutral-900 dark:text-white">
              Garanties & SLA
            </h4>
            <ul className="space-y-2 text-xs">
              <li className="flex items-start gap-1.5">
                <RefreshCw className="w-3.5 h-3.5 text-emerald-500 shrink-0 mt-0.5" />
                <span>Remboursement automatique si aucun SMS reçu sous 20 minutes</span>
              </li>
              <li className="flex items-start gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-500 shrink-0 mt-0.5" />
                <span>Interconnexion API officielle Ultra SMS</span>
              </li>
              <li className="flex items-start gap-1.5">
                <Lock className="w-3.5 h-3.5 text-emerald-500 shrink-0 mt-0.5" />
                <span>Idempotence des paiements et journal financier immuable</span>
              </li>
            </ul>
          </div>

          {/* Col 4: Conformité & Légal */}
          <div className="space-y-3">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-neutral-900 dark:text-white">
              Conformité Légale
            </h4>
            <div className="flex flex-col space-y-1.5 text-xs">
              <button
                onClick={() => onOpenLegal('terms')}
                className="text-left hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors"
              >
                Conditions Générales de Vente (CGV)
              </button>
              <button
                onClick={() => onOpenLegal('privacy')}
                className="text-left hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors"
              >
                Politique de Confidentialité & Rétention
              </button>
              <button
                onClick={() => onOpenLegal('refund')}
                className="text-left hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors"
              >
                Politique de Remboursement & Recrédit
              </button>
              <button
                onClick={() => onOpenLegal('acceptable-use')}
                className="text-left hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors"
              >
                Politique d'Utilisation Acceptable (Anti-fraude)
              </button>
            </div>
          </div>
        </div>

        {/* Bottom Bar: Anti-Slop Clean Copyright & Disclaimers */}
        <div className="pt-6 border-t border-neutral-200 dark:border-neutral-800 flex flex-col md:flex-row items-center justify-between gap-4 text-xs text-neutral-500">
          <p>
            © {new Date().getFullYear()} Numivo. Tous droits réservés. Plateforme de revente agréée de numéros virtuels.
          </p>
          <div className="flex items-center gap-4 text-[11px]">
            <span>Bénin & Afrique de l’Ouest</span>
            <span>·</span>
            <span>Passerelles FedaPay / KKiaPay</span>
            <span>·</span>
            <span>Fournisseur Ultra SMS</span>
          </div>
        </div>
      </div>
    </footer>
  );
};
