/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Smartphone, CreditCard, MessageSquare, RefreshCw, CheckCircle2, ShieldCheck, ArrowRight } from 'lucide-react';

interface HowItWorksProps {
  onOpenBuyModal: () => void;
}

export const HowItWorks: React.FC<HowItWorksProps> = ({ onOpenBuyModal }) => {
  const steps = [
    {
      num: '01',
      title: 'Sélectionnez le service et le pays',
      desc: 'Parcourez plus de 12 pays (Bénin, Côte d’Ivoire, France, USA...) et 40+ plateformes (WhatsApp, Telegram, OpenAI, Google). Vérifiez le stock en temps réel.',
      icon: <Smartphone className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />,
    },
    {
      num: '02',
      title: 'Réglez par Mobile Money ou Carte',
      desc: 'Payez en toute sécurité via MTN MoMo, Moov Money, Celtiis Cash, ou carte Visa / Mastercard avec confirmation 3D Secure et traçabilité par idempotence.',
      icon: <CreditCard className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />,
    },
    {
      num: '03',
      title: 'Recevez le numéro et entrez-le sur l’application',
      desc: 'Votre numéro virtuel s’affiche immédiatement avec son indicatif international. Vous disposez d’une fenêtre active de 20 minutes.',
      icon: <MessageSquare className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />,
    },
    {
      num: '04',
      title: 'Réception automatique du code OTP',
      desc: 'Dès l’envoi du SMS par l’application, Numivo interroge l’API Ultra SMS, extrait automatiquement le code OTP à 6 chiffres et vous permet de le copier en un clic.',
      icon: <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />,
    },
  ];

  return (
    <section className="py-16 bg-neutral-50 dark:bg-neutral-950 border-b border-neutral-200 dark:border-neutral-800 transition-colors">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-3xl mx-auto mb-14">
          <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 px-3 py-1 rounded-md mb-2">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Processus 100% automatisé & vérifié</span>
          </div>
          <h2 className="text-3xl font-bold text-neutral-900 dark:text-white">
            Comment fonctionne l’achat d’un numéro ?
          </h2>
          <p className="text-sm text-neutral-600 dark:text-neutral-400 mt-2">
            Un parcours transparent en 4 étapes simples, garanti avec recrédit automatique si aucun SMS n’est reçu.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
          {steps.map((step) => (
            <div
              key={step.num}
              className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl p-6 relative flex flex-col justify-between shadow-2xs hover:shadow-sm transition-all"
            >
              <div>
                <div className="flex items-center justify-between mb-4">
                  <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-950/80 border border-emerald-100 dark:border-emerald-800 flex items-center justify-center">
                    {step.icon}
                  </div>
                  <span className="text-2xl font-bold font-mono text-neutral-300 dark:text-neutral-700">
                    {step.num}
                  </span>
                </div>

                <h3 className="text-base font-bold text-neutral-900 dark:text-white mb-2 leading-tight">
                  {step.title}
                </h3>
                <p className="text-xs text-neutral-600 dark:text-neutral-400 leading-relaxed">
                  {step.desc}
                </p>
              </div>
            </div>
          ))}
        </div>

        {/* Guarantee Callout Banner */}
        <div className="bg-emerald-900 text-white rounded-2xl p-6 sm:p-8 flex flex-col md:flex-row items-center justify-between gap-6 shadow-md">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-xl bg-white/10 flex items-center justify-center shrink-0">
              <RefreshCw className="w-6 h-6 text-emerald-300" />
            </div>
            <div>
              <h4 className="text-lg font-bold">Garantie « Zéro SMS = Zéro Dépense »</h4>
              <p className="text-xs text-emerald-100/90 max-w-2xl mt-1 leading-relaxed">
                Si l’application de destination (WhatsApp, Telegram, etc.) ne délivre pas le SMS dans les 20 minutes, votre commande est immédiatement annulée et le montant intégral est recrédité sur votre portefeuille sans aucune pénalité.
              </p>
            </div>
          </div>

          <button
            onClick={onOpenBuyModal}
            className="bg-white hover:bg-neutral-100 text-emerald-900 font-bold text-xs px-6 py-3 rounded-xl whitespace-nowrap shadow-xs transition-colors shrink-0 cursor-pointer flex items-center gap-2"
          >
            <span>Démarrer un achat</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </section>
  );
};
