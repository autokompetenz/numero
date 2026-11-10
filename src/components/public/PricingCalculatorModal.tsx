import React, { useState } from 'react';
import { useModalBehavior } from '../../hooks/useModalBehavior';
import { useApp } from '../../context/AppContext';
import { calculateSellingPrice } from '../../utils/pricing';
import { PaymentMethod } from '../../types';
import { Calculator, X, HelpCircle, CheckCircle2, TrendingUp, DollarSign } from 'lucide-react';

interface PricingCalculatorModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const PricingCalculatorModal: React.FC<PricingCalculatorModalProps> = ({ isOpen, onClose }) => {
  useModalBehavior(isOpen, onClose);

  const { currency, pricingConfig, exchangeRates } = useApp();

  const [testCostXof, setTestCostXof] = useState<number>(1200);
  const [selectedMethod, setSelectedMethod] = useState<PaymentMethod>('MOBILE_MONEY');

  if (!isOpen) return null;

  const calculation = calculateSellingPrice({
    supplierCostXof: testCostXof,
    paymentMethod: selectedMethod,
    targetCurrency: currency,
    config: pricingConfig,
    rates: exchangeRates,
  });

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4 bg-slate-950/70 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="pricing-modal-title">
      <div className="w-full max-w-2xl rounded-t-2xl sm:rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden flex flex-col max-h-[92dvh] sm:max-h-[90vh] safe-bottom">
          <div className="sm:hidden mx-auto mt-2.5 mb-1 h-1 w-10 rounded-full bg-slate-300 dark:bg-slate-700 shrink-0" />
        
        {/* Header */}
        <div className="sticky top-0 z-10 px-4 sm:px-6 py-3.5 sm:py-4 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 flex items-center justify-center">
              <Calculator className="w-4 h-4" />
            </div>
            <div>
              <h3 id="pricing-modal-title" className="text-sm font-bold text-slate-900 dark:text-white">
                Règle de Marge & Formule de Rentabilité (2 000 XOF)
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Spécification Article 7 du cahier des charges
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

        {/* Modal Body */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-6 text-xs text-slate-600 dark:text-slate-300">
          
          {/* Explanation Box */}
          <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-2">
            <p className="font-semibold text-slate-900 dark:text-white flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-emerald-500" />
              <span>Formule mathématique officielle Numivo :</span>
            </p>
            <div className="p-3 bg-white dark:bg-slate-900 rounded-lg font-mono text-center text-xs text-emerald-700 dark:text-emerald-400 font-semibold border border-slate-200 dark:border-slate-800">
              P = (Coût_UltraSMS + Marge_2000 + Frais_Fixes + FX) / (1 - Taux_Passerelle)
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
              Le prix client <span className="font-mono font-semibold">P</span> est calculé côté serveur afin d'absorber intégralement les commissions des agrégateurs de paiement (FedaPay, KKiaPay, Visa/Mastercard) et garantir au moins <strong>2 000 XOF de bénéfice net</strong> par numéro vendu, avec un arrondi commercial aux 100 XOF supérieurs.
            </p>
          </div>

          {/* Interactive Simulator */}
          <div className="space-y-4">
            <h4 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
              Simulateur de calcul dynamique
            </h4>

            {/* Cost input */}
            <div>
              <div className="flex justify-between items-center mb-1">
                <label className="font-medium text-slate-700 dark:text-slate-300">
                  Coût brut fournisseur Ultra SMS (XOF) :
                </label>
                <span className="font-mono font-bold text-slate-900 dark:text-white">
                  {testCostXof.toLocaleString('fr-FR')} XOF
                </span>
              </div>
              <input
                type="range"
                min="400"
                max="3000"
                step="50"
                value={testCostXof}
                onChange={(e) => setTestCostXof(Number(e.target.value))}
                className="w-full accent-emerald-600 h-1.5 bg-slate-200 dark:bg-slate-700 rounded-lg cursor-pointer"
              />
              <div className="flex justify-between text-[11px] text-slate-500 dark:text-slate-400 font-mono mt-1">
                <span>400 XOF (Ex: US/NG)</span>
                <span>1 200 XOF (Ex: Bénin/WA)</span>
                <span>3 000 XOF (Services premium)</span>
              </div>
            </div>

            {/* Payment method selector */}
            <div>
              <label className="font-medium text-slate-700 dark:text-slate-300 block mb-1.5">
                Moyen de paiement simulé :
              </label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { id: 'MOBILE_MONEY' as PaymentMethod, label: 'Mobile Money', rate: '1.8%' },
                  { id: 'CARD' as PaymentMethod, label: 'Carte Bancaire', rate: '3.6%' },
                  { id: 'WALLET' as PaymentMethod, label: 'Portefeuille Interne', rate: '0.0%' },
                ].map((m) => (
                  <button
                    key={m.id}
                    onClick={() => setSelectedMethod(m.id)}
                    className={`p-2.5 rounded-lg border text-left transition-all ${
                      selectedMethod === m.id
                        ? 'border-emerald-600 bg-emerald-50/50 dark:bg-emerald-950/20 text-slate-900 dark:text-white'
                        : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    <div className="font-semibold text-xs">{m.label}</div>
                    <div className="text-[11px] text-slate-500 dark:text-slate-400 font-mono">Commission : {m.rate}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Results Breakdown Grid */}
            <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 p-4 space-y-2.5 font-mono text-xs">
              <div className="flex justify-between items-center text-slate-600 dark:text-slate-400">
                <span>1. Coût fournisseur Ultra SMS (C) :</span>
                <span className="text-slate-900 dark:text-white">{calculation.supplierCostXof.toLocaleString('fr-FR')} XOF</span>
              </div>

              <div className="flex justify-between items-center text-slate-600 dark:text-slate-400">
                <span>2. Marge cible minimale requise (M) :</span>
                <span className="text-emerald-700 dark:text-emerald-400 font-semibold">+ 2 000 XOF</span>
              </div>

              <div className="flex justify-between items-center text-slate-600 dark:text-slate-400">
                <span>3. Prix brut théorique non arrondi :</span>
                <span className="text-slate-500">{calculation.rawPriceXof.toFixed(2)} XOF</span>
              </div>

              <div className="flex justify-between items-center text-slate-600 dark:text-slate-400">
                <span>4. Arrondi commercial supérieur (+100 XOF) :</span>
                <span className="text-slate-500">+{calculation.sellingPriceXof - Math.floor(calculation.rawPriceXof)} XOF</span>
              </div>

              <div className="flex justify-between items-center text-slate-600 dark:text-slate-400 border-t border-slate-200 dark:border-slate-800 pt-2">
                <span>5. Frais passerelle déduits ({selectedMethod === 'CARD' ? '3.6%' : selectedMethod === 'MOBILE_MONEY' ? '1.8%' : '0%'}) :</span>
                <span className="text-rose-500">- {calculation.paymentFeeXof.toLocaleString('fr-FR')} XOF</span>
              </div>

              <div className="flex justify-between items-center text-slate-900 dark:text-white font-bold border-t border-slate-200 dark:border-slate-800 pt-2 text-sm">
                <span>Prix de vente facturé au client (P) :</span>
                <span className="text-emerald-700 dark:text-emerald-400">
                  {calculation.sellingPriceXof.toLocaleString('fr-FR')} XOF ({calculation.sellingPriceFormatted})
                </span>
              </div>

              <div className="flex justify-between items-center bg-emerald-50 dark:bg-emerald-950/40 p-2.5 rounded-lg border border-emerald-200 dark:border-emerald-800 text-xs">
                <span className="font-semibold text-emerald-900 dark:text-emerald-200">
                  Bénéfice net réalisé par Numivo :
                </span>
                <span className="text-emerald-700 dark:text-emerald-300 font-bold text-sm">
                  {calculation.estimatedNetMarginXof.toLocaleString('fr-FR')} XOF (≥ 2 000 XOF ✓)
                </span>
              </div>
            </div>

          </div>

        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 dark:bg-slate-700 dark:hover:bg-slate-600 rounded-lg transition-colors"
          >
            Fermer le calculateur
          </button>
        </div>

      </div>
    </div>
  );
};
