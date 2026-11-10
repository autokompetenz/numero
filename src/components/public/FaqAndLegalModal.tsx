import React, { useState } from 'react';
import { useModalBehavior } from '../../hooks/useModalBehavior';
import { X, ShieldCheck, HelpCircle, FileText, AlertTriangle, CheckCircle2 } from 'lucide-react';

interface FaqAndLegalModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialTopic?: 'faq' | 'terms' | 'privacy' | 'refund' | 'acceptable';
}

export const FaqAndLegalModal: React.FC<FaqAndLegalModalProps> = ({
  isOpen,
  onClose,
  initialTopic = 'faq',
}) => {
  useModalBehavior(isOpen, onClose);

  const [activeTopic, setActiveTopic] = useState<'faq' | 'terms' | 'privacy' | 'refund' | 'acceptable'>(
    initialTopic
  );

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4 bg-slate-950/70 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="faq-modal-title">
      <div className="w-full max-w-3xl rounded-t-2xl sm:rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden flex flex-col max-h-[92dvh] sm:max-h-[90vh] safe-bottom">
          <div className="sm:hidden mx-auto mt-2.5 mb-1 h-1 w-10 rounded-full bg-slate-300 dark:bg-slate-700 shrink-0" />
        
        {/* Header */}
        <div className="sticky top-0 z-10 px-4 sm:px-6 py-3.5 sm:py-4 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 flex items-center justify-center">
              <ShieldCheck className="w-4 h-4" />
            </div>
            <div>
              <h3 id="faq-modal-title" className="text-sm font-bold text-slate-900 dark:text-white">
                Centre d'Information & Cadre Légal Numivo
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Transparence commerciale, conformité réglementaire et FAQ
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 -mr-1 shrink-0 rounded-lg text-slate-500 dark:text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            aria-label="Fermer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="flex items-center gap-1 px-4 sm:px-6 pt-3 border-b border-slate-100 dark:border-slate-800 overflow-x-auto scrollbar-none text-xs shrink-0">
          {[
            { id: 'faq', label: 'Questions Fréquentes (FAQ)' },
            { id: 'refund', label: 'Garantie de Remboursement' },
            { id: 'acceptable', label: 'Politique d\'Usage Acceptable' },
            { id: 'terms', label: 'Conditions Générales (CGU)' },
            { id: 'privacy', label: 'Confidentialité & Données' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTopic(tab.id as any)}
              className={`px-3 py-2 font-semibold border-b-2 transition-colors whitespace-nowrap ${
                activeTopic === tab.id
                  ? 'border-emerald-600 text-emerald-700 dark:text-emerald-400'
                  : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Content Body */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-4 text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
          
          {/* FAQ */}
          {activeTopic === 'faq' && (
            <div className="space-y-4">
              <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 space-y-1.5">
                <h4 className="font-bold text-slate-900 dark:text-white text-sm">
                  1. Comment fonctionne l'activation d'un numéro virtuel sur Numivo ?
                </h4>
                <p>
                  Dès votre commande validée, Numivo interroge les serveurs du grossiste télécoms <strong>Ultra SMS</strong> pour vous allouer un numéro réel dédié au pays et au service sélectionné (WhatsApp, Telegram, ChatGPT, etc.). Vous disposez d'une fenêtre de 20 minutes pour renseigner ce numéro sur l'application concernée et recevoir votre code de vérification SMS en temps réel dans votre espace client.
                </p>
              </div>

              <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 space-y-1.5">
                <h4 className="font-bold text-slate-900 dark:text-white text-sm">
                  2. Que se passe-t-il si je ne reçois aucun SMS ?
                </h4>
                <p>
                  <strong>Vous ne payez que si vous recevez votre SMS.</strong> Si aucun message n'arrive pendant les 20 minutes, ou si vous décidez d'annuler avant réception, vous pouvez cliquer sur "Annuler et Recréditer". L'intégralité du montant payé est immédiatement créditée sur votre portefeuille sans aucune déduction.
                </p>
              </div>

              <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 space-y-1.5">
                <h4 className="font-bold text-slate-900 dark:text-white text-sm">
                  3. Quels sont les modes de paiement pris en charge ?
                </h4>
                <p>
                  Numivo intègre les passerelles certifiées pour l'Afrique de l'Ouest : <strong>MTN Mobile Money</strong>, <strong>Moov Money</strong> et <strong>Celtiis</strong> (via FedaPay et KKiaPay), ainsi que les cartes bancaires internationales <strong>Visa</strong> et <strong>Mastercard</strong> dotées du protocole 3D Secure.
                </p>
              </div>

              <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 space-y-1.5">
                <h4 className="font-bold text-slate-900 dark:text-white text-sm">
                  4. Pourquoi appliquez-vous une marge nette de 2 000 XOF par numéro ?
                </h4>
                <p>
                  Numivo applique un modèle de tarification transparent et pérenne. Cette marge nette de 2 000 XOF permet de financer les serveurs à haute disponibilité, l'infrastructure API avec Ultra SMS, les passerelles bancaires et un support client disponible 7j/7, tout en assurant l'absence totale de publicité et la confidentialité de vos données.
                </p>
              </div>
            </div>
          )}

          {/* REFUND POLICY */}
          {activeTopic === 'refund' && (
            <div className="space-y-4">
              <div className="p-4 bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800/40 rounded-xl space-y-2">
                <h4 className="font-bold text-emerald-800 dark:text-emerald-300 text-sm flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-700" />
                  <span>Politique Zéro Risque & Garantie Intégrale</span>
                </h4>
                <p>
                  Chez Numivo, l'achat d'un numéro d'activation SMS temporaire est conditionné au succès de la réception.
                </p>
              </div>

              <ul className="list-disc list-inside space-y-2 pl-2">
                <li><strong>Recrédit automatique :</strong> Si aucun SMS n'a été reçu sur le numéro loué au terme du compte à rebours de 20 minutes, la commande est close et le montant total est automatiquement reversé sur votre portefeuille client.</li>
                <li><strong>Annulation anticipée :</strong> Vous pouvez à tout moment annuler la commande avant réception du premier SMS pour libérer le numéro et récupérer immédiatement vos fonds.</li>
                <li><strong>Remboursement vers Mobile Money / Carte :</strong> Si vous souhaitez retirer des fonds de votre portefeuille vers votre compte MTN MoMo ou carte bancaire d'origine, une demande peut être soumise au support avec exécution sous 24 à 48 heures ouvrées.</li>
              </ul>
            </div>
          )}

          {/* ACCEPTABLE USE */}
          {activeTopic === 'acceptable' && (
            <div className="space-y-4">
              <div className="p-4 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800/40 rounded-xl space-y-2">
                <h4 className="font-bold text-amber-800 dark:text-amber-300 text-sm flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-600" />
                  <span>Conformité Télécoms & Règles d'Usage Acceptable</span>
                </h4>
                <p>
                  Numivo n'est pas et ne doit jamais être utilisé comme un outil de contournement d'identité ou de fraude.
                </p>
              </div>

              <p>Il est strictement interdit d'utiliser les numéros fournis par Numivo pour :</p>
              <ul className="list-disc list-inside space-y-1.5 pl-2">
                <li>Le contournement intentionnel de vérifications d'identité imposées par la législation (KYC financier obligatoire, procédures judiciaires).</li>
                <li>La création de faux profils à des fins de harcèlement, d'usurpation d'identité ou d'escroquerie en ligne.</li>
                <li>L'émission de spams, de campagnes d'hameçonnage (phishing) ou d'activités malveillantes.</li>
                <li>La violation des conditions d'utilisation des plateformes partenaires (WhatsApp, Google, etc.).</li>
              </ul>
              <p>
                En cas de détection d'activité illicite, Numivo se réserve le droit de révoquer l'accès immédiatement et de coopérer avec les autorités compétentes selon les lois de la République du Bénin et des pays partenaires.
              </p>
            </div>
          )}

          {/* TERMS OF SERVICE */}
          {activeTopic === 'terms' && (
            <div className="space-y-3">
              <h4 className="font-bold text-slate-900 dark:text-white text-sm">
                Conditions Générales d'Utilisation (CGU)
              </h4>
              <p>
                <strong>Article 1 — Objet :</strong> Les présentes conditions régissent la fourniture de numéros virtuels temporaires et permanents proposés par Numivo via l'API de ses grossistes agréés.
              </p>
              <p>
                <strong>Article 2 — Nature du service :</strong> Numivo met à disposition un relais technique de réception SMS. Numivo ne garantit pas que les services tiers (WhatsApp, OpenAI, etc.) accepteront indéfiniment un numéro si leur politique interne s'y oppose.
              </p>
              <p>
                <strong>Article 3 — Portefeuille client :</strong> Les fonds déposés sur le portefeuille client constituent des avoirs réservés aux transactions sur la plateforme. Chaque portefeuille est strictement isolé par devise (XOF, EUR, USD).
              </p>
              <p>
                <strong>Article 4 — Idempotence et paiements :</strong> Toutes les transactions financières sont traitées de manière univoque côté serveur avec vérification des webhooks d'agrégateurs (FedaPay, KKiaPay).
              </p>
            </div>
          )}

          {/* PRIVACY */}
          {activeTopic === 'privacy' && (
            <div className="space-y-3">
              <h4 className="font-bold text-slate-900 dark:text-white text-sm">
                Politique de Confidentialité et Protection des Données
              </h4>
              <p>
                <strong>Minimisation des données :</strong> Numivo ne collecte que les informations strictement indispensables à l'exécution de la commande (adresse e-mail, numéro de transaction).
              </p>
              <p>
                <strong>Données bancaires :</strong> Vos numéros de carte de crédit ne transitent jamais sur nos serveurs et ne sont jamais stockés dans nos bases de données. Elles sont traitées directement par les modules sécurisés certifiés PCI-DSS de nos partenaires bancaires.
              </p>
              <p>
                <strong>Rétention des SMS :</strong> Les contenus des SMS reçus sont conservés pendant la durée de validité du numéro puis purgés périodiquement de nos serveurs après complétion de la commande.
              </p>
            </div>
          )}

        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 dark:bg-slate-700 dark:hover:bg-slate-600 rounded-lg transition-colors"
          >
            Fermer
          </button>
        </div>

      </div>
    </div>
  );
};
