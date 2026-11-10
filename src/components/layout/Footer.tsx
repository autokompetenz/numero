import React from 'react';
import { ShieldCheck, Smartphone, Lock, Award, RefreshCw } from 'lucide-react';

interface FooterProps {
  onOpenLegal: (topic: 'terms' | 'privacy' | 'refund' | 'acceptable') => void;
  setActiveTab: (tab: string) => void;
}

export const Footer: React.FC<FooterProps> = ({ onOpenLegal, setActiveTab }) => {
  return (
    <footer className="border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-600 dark:text-slate-400 safe-bottom">
      
      {/* Trust & Guarantee Banner */}
      <div className="border-b border-slate-200/80 dark:border-slate-800/80 py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 sm:gap-6 text-xs">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 flex items-center justify-center shrink-0">
                <ShieldCheck className="w-4 h-4" />
              </div>
              <div>
                <p className="font-semibold text-slate-900 dark:text-slate-100">Garantie de Réception SMS</p>
                <p className="text-slate-500 dark:text-slate-400 mt-0.5">Aucun SMS reçu ? Recrédit immédiat à 100% sur votre solde ou remboursement sans frais.</p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
                <Smartphone className="w-4 h-4" />
              </div>
              <div>
                <p className="font-semibold text-slate-900 dark:text-slate-100">Mobile Money & Cartes</p>
                <p className="text-slate-500 dark:text-slate-400 mt-0.5">MTN MoMo, Moov Money, Celtiis (Bénin & UEMOA), Visa et Mastercard avec 3D Secure.</p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-lg bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
                <Award className="w-4 h-4" />
              </div>
              <div>
                <p className="font-semibold text-slate-900 dark:text-slate-100">Marge Cible Maîtrisée</p>
                <p className="text-slate-500 dark:text-slate-400 mt-0.5">Tarification transparente : calcul dynamique assurant 2 000 XOF de marge nette par numéro.</p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
                <Lock className="w-4 h-4" />
              </div>
              <div>
                <p className="font-semibold text-slate-900 dark:text-slate-100">Données Chiffrées & Sécurisées</p>
                <p className="text-slate-500 dark:text-slate-400 mt-0.5">Aucun stockage des données de carte. Journalisation immuable des flux financiers.</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Footer Links */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-2 gap-x-6 gap-y-10 lg:grid-cols-5 lg:gap-8">
          
          <div className="col-span-2">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-7 h-7 rounded-lg bg-emerald-700 flex items-center justify-center text-white font-bold text-sm">
                N
              </div>
              <span className="text-lg font-bold text-slate-900 dark:text-white">Numivo</span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm leading-relaxed">
              Plateforme internationale de numéros virtuels pour l'Afrique de l'Ouest et l'international. Déploiement instantané pour activations WhatsApp, Telegram, Google, ChatGPT et vérifications de sécurité.
            </p>
            <div className="mt-4 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-500 dark:text-slate-400">
              <span>Devises supportées :</span>
              <span className="font-semibold text-slate-600 dark:text-slate-300">XOF (CFA)</span>
              <span>·</span>
              <span className="font-semibold text-slate-600 dark:text-slate-300">EUR (€)</span>
              <span>·</span>
              <span className="font-semibold text-slate-600 dark:text-slate-300">USD ($)</span>
            </div>
          </div>

          <div>
            <h2 className="text-xs font-semibold text-slate-900 dark:text-white uppercase tracking-wider mb-3">
              Services & Catalogue
            </h2>
            <ul className="space-y-2 text-xs">
              <li>
                <button onClick={() => setActiveTab('explore')} className="text-left hover:text-emerald-500 transition-colors">
                  WhatsApp & Business
                </button>
              </li>
              <li>
                <button onClick={() => setActiveTab('explore')} className="text-left hover:text-emerald-500 transition-colors">
                  Telegram & Discord
                </button>
              </li>
              <li>
                <button onClick={() => setActiveTab('explore')} className="text-left hover:text-emerald-500 transition-colors">
                  OpenAI & ChatGPT
                </button>
              </li>
              <li>
                <button onClick={() => setActiveTab('explore')} className="text-left hover:text-emerald-500 transition-colors">
                  Google & Microsoft
                </button>
              </li>
              <li>
                <button onClick={() => setActiveTab('explore')} className="text-left hover:text-emerald-500 transition-colors">
                  Numéros permanents / Location
                </button>
              </li>
            </ul>
          </div>

          <div>
            <h2 className="text-xs font-semibold text-slate-900 dark:text-white uppercase tracking-wider mb-3">
              Plateforme & Paiements
            </h2>
            <ul className="space-y-2 text-xs">
              <li>
                <button onClick={() => setActiveTab('payments')} className="text-left hover:text-emerald-500 transition-colors">
                  MTN Mobile Money
                </button>
              </li>
              <li>
                <button onClick={() => setActiveTab('payments')} className="text-left hover:text-emerald-500 transition-colors">
                  Moov Money (Flooz)
                </button>
              </li>
              <li>
                <button onClick={() => setActiveTab('payments')} className="text-left hover:text-emerald-500 transition-colors">
                  Celtiis Money
                </button>
              </li>
              <li>
                <button onClick={() => setActiveTab('payments')} className="text-left hover:text-emerald-500 transition-colors">
                  Visa & Mastercard (3DS)
                </button>
              </li>
              <li>
                <button onClick={() => setActiveTab('pricing-rules')} className="text-left hover:text-emerald-500 transition-colors">
                  Calculateur de marge nette
                </button>
              </li>
              <li>
                <button onClick={() => setActiveTab('auth')} className="text-left text-emerald-700 dark:text-emerald-400 font-semibold hover:underline">
                  Connexion / Inscription client
                </button>
              </li>
              <li>
                <a
                  href="/numivo-projet.zip"
                  download="numivo-projet.zip"
                  className="font-mono text-emerald-700 dark:text-emerald-400 font-bold hover:underline inline-flex items-center gap-1"
                >
                  <span>📦 Télécharger le projet (.ZIP)</span>
                </a>
              </li>
            </ul>
          </div>

          <div>
            <h2 className="text-xs font-semibold text-slate-900 dark:text-white uppercase tracking-wider mb-3">
              Cadre Légal & Éthique
            </h2>
            <ul className="space-y-2 text-xs">
              <li>
                <button onClick={() => onOpenLegal('terms')} className="text-left hover:text-emerald-500 transition-colors">
                  Conditions d'utilisation (CGU)
                </button>
              </li>
              <li>
                <button onClick={() => onOpenLegal('privacy')} className="text-left hover:text-emerald-500 transition-colors">
                  Politique de confidentialité
                </button>
              </li>
              <li>
                <button onClick={() => onOpenLegal('refund')} className="text-left hover:text-emerald-500 transition-colors">
                  Politique de remboursement
                </button>
              </li>
              <li>
                <button onClick={() => onOpenLegal('acceptable')} className="text-left hover:text-emerald-500 transition-colors">
                  Usage acceptable & Anti-fraude
                </button>
              </li>
              <li>
                <button onClick={() => setActiveTab('faq')} className="text-left hover:text-emerald-500 transition-colors">
                  Foire aux questions
                </button>
              </li>
            </ul>
          </div>

        </div>

        {/* Regulatory Disclaimer */}
        <div className="mt-10 pt-6 border-t border-slate-200 dark:border-slate-900 text-[11px] leading-relaxed text-slate-500 dark:text-slate-400">
          <p>
            <strong>Avertissement légal :</strong> Numivo agit en tant que revendeur autorisé de solutions de télécommunication auprès de grossistes agréés (fournisseur Ultra SMS). Nos numéros virtuels sont destinés à un usage légitime de test applicatif, de vérification de compte personnel et de confidentialité de communication. La plateforme prohibe tout usage visant à contourner les vérifications d’identité requises par la loi, les mesures anti-fraude ou les politiques des tiers.
          </p>
          <div className="mt-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-slate-500 dark:text-slate-400">
            <p>© {new Date().getFullYear()} Numivo Technologies. Tous droits réservés.</p>
            <p className="font-mono text-[11px]">Devise comptable de référence : XOF (Franc CFA)</p>
          </div>
        </div>

      </div>

    </footer>
  );
};
