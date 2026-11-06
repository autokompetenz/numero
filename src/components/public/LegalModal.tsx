/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { X, Shield, FileText, Lock, RefreshCw, AlertCircle } from 'lucide-react';

interface LegalModalProps {
  initialTopic?: 'terms' | 'privacy' | 'refund' | 'acceptable-use';
  onClose: () => void;
}

export const LegalModal: React.FC<LegalModalProps> = ({ initialTopic = 'terms', onClose }) => {
  const [activeTab, setActiveTab] = useState<'terms' | 'privacy' | 'refund' | 'acceptable-use'>(initialTopic);

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-neutral-950/75 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-white dark:bg-neutral-900 border-t sm:border border-neutral-200 dark:border-neutral-800 rounded-t-3xl sm:rounded-2xl max-w-3xl w-full max-h-[90vh] sm:max-h-[85vh] flex flex-col shadow-2xl overflow-hidden animate-in zoom-in-95 duration-150">
        {/* Modal Header */}
        <div className="p-4 sm:p-5 border-b border-neutral-200 dark:border-neutral-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-emerald-600" />
            <h3 className="text-base font-bold text-neutral-900 dark:text-white">
              Cadre Juridique & Conformité Numivo
            </h3>
          </div>
          <button
            onClick={onClose}
            className="text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 p-1.5 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Navigation Tabs (Functional Controls) */}
        <div className="flex border-b border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-850 px-4 gap-2 overflow-x-auto text-xs">
          <button
            onClick={() => setActiveTab('terms')}
            className={`py-3 px-3 font-semibold border-b-2 whitespace-nowrap cursor-pointer transition-colors ${
              activeTab === 'terms'
                ? 'border-emerald-600 text-emerald-600 dark:text-emerald-400'
                : 'border-transparent text-neutral-500 hover:text-neutral-900 dark:hover:text-white'
            }`}
          >
            Conditions Générales (CGV)
          </button>
          <button
            onClick={() => setActiveTab('privacy')}
            className={`py-3 px-3 font-semibold border-b-2 whitespace-nowrap cursor-pointer transition-colors ${
              activeTab === 'privacy'
                ? 'border-emerald-600 text-emerald-600 dark:text-emerald-400'
                : 'border-transparent text-neutral-500 hover:text-neutral-900 dark:hover:text-white'
            }`}
          >
            Confidentialité & Données
          </button>
          <button
            onClick={() => setActiveTab('refund')}
            className={`py-3 px-3 font-semibold border-b-2 whitespace-nowrap cursor-pointer transition-colors ${
              activeTab === 'refund'
                ? 'border-emerald-600 text-emerald-600 dark:text-emerald-400'
                : 'border-transparent text-neutral-500 hover:text-neutral-900 dark:hover:text-white'
            }`}
          >
            Garantie de Remboursement
          </button>
          <button
            onClick={() => setActiveTab('acceptable-use')}
            className={`py-3 px-3 font-semibold border-b-2 whitespace-nowrap cursor-pointer transition-colors ${
              activeTab === 'acceptable-use'
                ? 'border-emerald-600 text-emerald-600 dark:text-emerald-400'
                : 'border-transparent text-neutral-500 hover:text-neutral-900 dark:hover:text-white'
            }`}
          >
            Usage Acceptable (Anti-fraude)
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto text-xs text-neutral-600 dark:text-neutral-300 space-y-4 leading-relaxed">
          {activeTab === 'terms' && (
            <div className="space-y-4">
              <h4 className="text-sm font-bold text-neutral-900 dark:text-white">1. Objet et statut du service</h4>
              <p>
                Numivo est une plateforme technologique indépendante opérant en tant que revendeur agréé de numéros virtuels temporaires et permanents via des fournisseurs télécoms officiels (notamment Ultra SMS). Le service permet aux utilisateurs majeurs de recevoir des SMS de validation (OTP) pour l'enregistrement et la sécurisation de leurs comptes personnels ou professionnels.
              </p>
              <h4 className="text-sm font-bold text-neutral-900 dark:text-white">2. Prix et paiement</h4>
              <p>
                Les prix sont libellés en Francs CFA (XOF) comme monnaie de référence comptable, avec conversion indicative et paiement possible en EUR et USD. Les tarifs affichés sont fermes, forfaitaires et tout compris (TTC). Le client valide expressément le montant total affiché avant de confirmer son règlement.
              </p>
              <h4 className="text-sm font-bold text-neutral-900 dark:text-white">3. Fourniture du numéro</h4>
              <p>
                Dès confirmation effective du règlement par l'agrégateur bancaire ou Mobile Money (FedaPay, KKiaPay), le numéro virtuel est alloué pour une durée minimale de 20 minutes afin de permettre la réception du code.
              </p>
            </div>
          )}

          {activeTab === 'privacy' && (
            <div className="space-y-4">
              <h4 className="text-sm font-bold text-neutral-900 dark:text-white">1. Données collectées</h4>
              <p>
                Numivo applique le principe de minimisation des données : nous ne collectons que l'adresse email, le moyen de paiement et le numéro de téléphone émetteur nécessaire à l'authentification Mobile Money. Aucune coordonnée bancaire sensible (numéro de carte, cryptogramme CVV) n'est jamais enregistrée sur nos serveurs.
              </p>
              <h4 className="text-sm font-bold text-neutral-900 dark:text-white">2. Traitement et rétention des SMS</h4>
              <p>
                Le contenu des SMS reçus est chiffré en transit et n'est conservé que pendant la durée nécessaire à l'affichage du code de vérification au client. Les messages sont purgés des serveurs actifs après expiration du numéro ou sur simple demande du client.
              </p>
            </div>
          )}

          {activeTab === 'refund' && (
            <div className="space-y-4">
              <div className="p-3 bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 rounded-xl text-emerald-800 dark:text-emerald-300 font-semibold">
                Garantie « Zéro SMS reçu = Remboursement 100% garanti »
              </div>
              <h4 className="text-sm font-bold text-neutral-900 dark:text-white">1. Déclenchement automatique</h4>
              <p>
                Si aucun message SMS n'est reçu sur le numéro attribué dans un délai de 20 minutes suivant l'achat, la commande est classée sans suite. Le montant intégral déboursé par le client est recrédité immédiatement sur son portefeuille Numivo.
              </p>
              <h4 className="text-sm font-bold text-neutral-900 dark:text-white">2. Annulation volontaire anticipée</h4>
              <p>
                Tant qu'aucun SMS n'a été délivré, le client peut cliquer à tout moment sur le bouton « Annuler et recréditer » dans son espace personnel. Le solde est réinjecté sans pénalité. Dès lors qu'un SMS ou code a été délivré avec succès, le service est réputé consommé et n'est plus éligible au remboursement.
              </p>
            </div>
          )}

          {activeTab === 'acceptable-use' && (
            <div className="space-y-4">
              <div className="p-3 bg-amber-50 dark:bg-amber-950/60 border border-amber-200 dark:border-amber-800 rounded-xl text-amber-800 dark:text-amber-300 font-medium flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <span>Réglementation télécoms & lutte anti-abus</span>
              </div>
              <p>
                Conformément aux directives du cahier des charges et aux lois en vigueur au Bénin et à l'international, Numivo ne doit en aucun cas être utilisé comme un outil de contournement de vérifications d'identité officielles, de spam massif, d'escroquerie financière, de harcèlement ou de violation des conditions d'utilisation des plateformes tierces.
              </p>
              <p>
                Tout compte impliqué dans des comportements abusifs ou des tentatives d'attaques automatisées sera immédiatement suspendu sans préavis et les autorités compétentes pourront être informées si la loi l'exige.
              </p>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-4 bg-neutral-50 dark:bg-neutral-850 border-t border-neutral-200 dark:border-neutral-800 flex justify-end">
          <button
            onClick={onClose}
            className="bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 font-bold text-xs px-5 py-2 rounded-lg cursor-pointer hover:bg-neutral-800 dark:hover:bg-neutral-100 transition-colors"
          >
            J'ai compris et j'accepte
          </button>
        </div>
      </div>
    </div>
  );
};
