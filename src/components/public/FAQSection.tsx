/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { ChevronDown, HelpCircle, Shield, CreditCard, Clock, RotateCcw } from 'lucide-react';

export const FAQSection: React.FC = () => {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  const faqs = [
    {
      q: 'Comment payer par Mobile Money (MTN MoMo, Moov, Celtiis) au Bénin et en Afrique de l’Ouest ?',
      a: 'Lors de votre commande ou lors du rechargement de votre portefeuille, sélectionnez Mobile Money. Vous indiquez votre numéro de téléphone et l’opérateur (MTN, Moov, Celtiis, Orange ou Wave). Une notification USSD s’affiche directement sur votre téléphone mobile pour valider la transaction avec votre code secret PIN. Numivo reçoit la confirmation instantanément via webhook sécurisé FedaPay ou KKiaPay.',
      icon: <CreditCard className="w-4 h-4 text-emerald-600" />,
    },
    {
      q: 'Que se passe-t-il si le SMS ou le code OTP n’arrive pas ?',
      a: 'Numivo applique une politique stricte de satisfaction : si aucun SMS n’est reçu sur votre numéro virtuel dans la fenêtre de 20 minutes, vous pouvez cliquer sur « Annuler et recréditer » à tout moment, ou le système annule automatiquement la commande. L’intégralité de votre paiement est recréditée immédiatement sur votre portefeuille sans frais.',
      icon: <RotateCcw className="w-4 h-4 text-emerald-600" />,
    },
    {
      q: 'Combien de temps le numéro reste-t-il actif ?',
      a: 'Pour les numéros temporaires de vérification, la ligne reste active pendant 20 minutes, ce qui est largement suffisant pour recevoir le code de validation (délai moyen de réception : 8 à 15 secondes). Une fois le code reçu, le numéro est libéré pour protéger votre vie privée.',
      icon: <Clock className="w-4 h-4 text-emerald-600" />,
    },
    {
      q: 'Les tarifs affichés comprennent-ils tous les frais ?',
      a: 'Oui, tous les prix affichés sur Numivo sont fermes et définitifs (TTC). Ils comprennent l’accès au numéro virtuel, la réception prioritaire du code SMS et les frais de traitement de paiement. Aucun frais caché supplémentaire ne vous sera facturé.',
      icon: <Shield className="w-4 h-4 text-emerald-600" />,
    },
    {
      q: 'Puis-je payer par carte bancaire internationale (Visa / Mastercard) ?',
      a: 'Oui, nous acceptons toutes les cartes bancaires Visa et Mastercard internationales. Les transactions sont sécurisées avec le protocole 3D Secure (code bancaire de confirmation par SMS ou application bancaire). Numivo ne stocke jamais vos coordonnées bancaires.',
      icon: <CreditCard className="w-4 h-4 text-emerald-600" />,
    },
    {
      q: 'Quelles sont les règles d’utilisation légale de la plateforme ?',
      a: 'Les numéros virtuels fournis par Numivo via le partenaire agréé Ultra SMS sont strictement réservés à l’enregistrement légitime de vos comptes personnels ou professionnels, au test d’applications et à la protection de votre vie privée contre le spam. Tout usage à des fins de fraude, de contournement illégal d’identifications officielles ou d’activités malveillantes est strictement interdit et entraîne le bannissement immédiat.',
      icon: <HelpCircle className="w-4 h-4 text-emerald-600" />,
    },
  ];

  return (
    <section className="py-16 bg-white dark:bg-neutral-900 border-b border-neutral-200 dark:border-neutral-800 transition-colors">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 px-3 py-1 rounded-md mb-2">
            <HelpCircle className="w-3.5 h-3.5" />
            <span>Assistance & Foire Aux Questions</span>
          </div>
          <h2 className="text-3xl font-bold text-neutral-900 dark:text-white">
            Questions fréquentes & sécurité
          </h2>
          <p className="text-sm text-neutral-600 dark:text-neutral-400 mt-2">
            Tout ce que vous devez savoir sur le fonctionnement des numéros virtuels, les paiements et nos garanties.
          </p>
        </div>

        <div className="space-y-3">
          {faqs.map((faq, idx) => {
            const isOpen = openIndex === idx;
            return (
              <div
                key={idx}
                className="bg-neutral-50 dark:bg-neutral-850 border border-neutral-200 dark:border-neutral-800 rounded-xl overflow-hidden transition-all"
              >
                <button
                  type="button"
                  onClick={() => setOpenIndex(isOpen ? null : idx)}
                  className="w-full p-4 sm:p-5 text-left flex items-center justify-between gap-4 cursor-pointer hover:bg-neutral-100/50 dark:hover:bg-neutral-800/50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="p-1.5 rounded-lg bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 shrink-0">
                      {faq.icon}
                    </div>
                    <span className="text-sm font-bold text-neutral-900 dark:text-white leading-snug">
                      {faq.q}
                    </span>
                  </div>
                  <ChevronDown
                    className={`w-4 h-4 text-neutral-400 transition-transform duration-200 shrink-0 ${
                      isOpen ? 'rotate-180' : ''
                    }`}
                  />
                </button>

                {isOpen && (
                  <div className="px-5 pb-5 pt-1 text-xs text-neutral-600 dark:text-neutral-300 leading-relaxed border-t border-neutral-200/60 dark:border-neutral-800">
                    <p className="mt-2">{faq.a}</p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
};
