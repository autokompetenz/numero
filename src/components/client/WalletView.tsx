/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { formatCurrency } from '../../services/pricingEngine';
import { Currency, PaymentMethod, MobileMoneyOperator } from '../../types';
import {
  Wallet as WalletIcon,
  PlusCircle,
  ArrowDownLeft,
  ArrowUpRight,
  RefreshCw,
  ShieldCheck,
  Check,
  Lock,
  Smartphone,
  CreditCard,
  X,
  FileSpreadsheet,
} from 'lucide-react';

export const WalletView: React.FC = () => {
  const {
    wallets,
    transactions,
    currency,
    currentUser,
    depositToWallet,
  } = useApp();

  const [isDepositModalOpen, setIsDepositModalOpen] = useState(false);
  const [depositAmount, setDepositAmount] = useState<number>(10000);
  const [depositCurrency, setDepositCurrency] = useState<Currency>('XOF');
  const [depositMethod, setDepositMethod] = useState<PaymentMethod>('MOBILE_MONEY');
  const [depositOperator, setDepositOperator] = useState<MobileMoneyOperator>('MTN');
  const [isDepositing, setIsDepositing] = useState(false);

  const currentUserId = currentUser?.id || 'user_client_1';

  // Get wallets for this user
  const userWallets = wallets.filter((w) => w.userId === currentUserId);
  const xofWallet = userWallets.find((w) => w.currency === 'XOF') || { balanceMinor: 0 };
  const eurWallet = userWallets.find((w) => w.currency === 'EUR') || { balanceMinor: 0 };
  const usdWallet = userWallets.find((w) => w.currency === 'USD') || { balanceMinor: 0 };

  // Filter transactions
  const userTransactions = transactions.filter((t) => t.userId === currentUserId);

  const handleConfirmDeposit = async () => {
    setIsDepositing(true);
    await new Promise((r) => setTimeout(r, 1200));
    await depositToWallet({
      amount: depositAmount,
      currency: depositCurrency,
      method: depositMethod,
      operator: depositMethod === 'MOBILE_MONEY' ? depositOperator : undefined,
    });
    setIsDepositing(false);
    setIsDepositModalOpen(false);
  };

  return (
    <div className="py-6 sm:py-8 bg-neutral-50 dark:bg-neutral-950 border-b border-neutral-200 dark:border-neutral-800 min-h-[600px] transition-colors">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 sm:mb-8">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold text-emerald-600 dark:text-emerald-400 mb-1">
              <span>Grand livre financier certifié</span>
              <span>·</span>
              <span>Soldes isolés par devise</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-bold text-neutral-900 dark:text-white">
              Portefeuille Client & Historique des Opérations
            </h1>
            <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">
              Rechargez votre compte par Mobile Money ou Carte pour payer vos numéros instantanément sans frais supplémentaires.
            </p>
          </div>

          <button
            onClick={() => setIsDepositModalOpen(true)}
            className="w-full sm:w-auto flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs px-4 py-3 rounded-xl shadow-xs transition-colors cursor-pointer min-h-[44px]"
          >
            <PlusCircle className="w-4 h-4" />
            <span>Recharger mon portefeuille</span>
          </button>
        </div>

        {/* 3 Wallets Cards Grid (XOF, EUR, USD) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 sm:gap-5 mb-8">
          {/* XOF Wallet */}
          <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl p-4 sm:p-5 shadow-2xs">
            <div className="flex items-center justify-between mb-2 sm:mb-3">
              <span className="text-xs font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                Solde FCFA (XOF)
              </span>
              <span className="text-[10px] text-neutral-400 font-mono">Bénin / UEMOA</span>
            </div>
            <div className="text-2xl font-bold font-mono text-neutral-900 dark:text-white tabular-nums mb-1">
              {formatCurrency(xofWallet.balanceMinor, 'XOF')}
            </div>
            <p className="text-[11px] text-neutral-500">
              Devise de référence · Idéal pour les paiements Mobile Money MTN, Moov, Celtiis.
            </p>
          </div>

          {/* EUR Wallet */}
          <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl p-4 sm:p-5 shadow-2xs">
            <div className="flex items-center justify-between mb-2 sm:mb-3">
              <span className="text-xs font-bold uppercase tracking-wider text-sky-600 dark:text-sky-400">
                Solde Euro (EUR)
              </span>
              <span className="text-[10px] text-neutral-400 font-mono">Zone Euro</span>
            </div>
            <div className="text-2xl font-bold font-mono text-neutral-900 dark:text-white tabular-nums mb-1">
              {formatCurrency(eurWallet.balanceMinor, 'EUR')}
            </div>
            <p className="text-[11px] text-neutral-500">
              Solde sécurisé en Euros · Idéal pour cartes bancaires internationales.
            </p>
          </div>

          {/* USD Wallet */}
          <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl p-4 sm:p-5 shadow-2xs sm:col-span-2 md:col-span-1">
            <div className="flex items-center justify-between mb-2 sm:mb-3">
              <span className="text-xs font-bold uppercase tracking-wider text-purple-600 dark:text-purple-400">
                Solde Dollar (USD)
              </span>
              <span className="text-[10px] text-neutral-400 font-mono">International</span>
            </div>
            <div className="text-2xl font-bold font-mono text-neutral-900 dark:text-white tabular-nums mb-1">
              {formatCurrency(usdWallet.balanceMinor, 'USD')}
            </div>
            <p className="text-[11px] text-neutral-500">
              Solde en Dollars US · Aucune conversion automatique sans votre accord.
            </p>
          </div>
        </div>

        {/* Immutable Ledger Table */}
        <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl overflow-hidden shadow-2xs">
          <div className="p-4 sm:p-5 border-b border-neutral-200 dark:border-neutral-800 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h3 className="text-base font-bold text-neutral-900 dark:text-white">
                Grand Livre Immuable (Journal Financier)
              </h3>
              <p className="text-xs text-neutral-500 mt-0.5">
                Chaque opération financière est archivée de façon inaltérable avec clé d'idempotence.
              </p>
            </div>
            <div className="text-xs text-neutral-400 font-mono">
              {userTransactions.length} écriture(s) comptable(s)
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs min-w-[580px]">
              <thead className="bg-neutral-50 dark:bg-neutral-850 border-b border-neutral-200 dark:border-neutral-800 text-neutral-500 font-semibold uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="py-3 px-4">Date & Heure</th>
                  <th className="py-3 px-4">Référence</th>
                  <th className="py-3 px-4">Type</th>
                  <th className="py-3 px-4">Description</th>
                  <th className="py-3 px-4 text-right">Montant</th>
                  <th className="py-3 px-4 text-center">Statut</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800 font-mono">
                {userTransactions.map((tx) => {
                  const isPositive = tx.amountMinor > 0;
                  return (
                    <tr key={tx.id} className="hover:bg-neutral-50/50 dark:hover:bg-neutral-850/50 transition-colors">
                      <td className="py-3.5 px-4 text-neutral-600 dark:text-neutral-400 whitespace-nowrap">
                        {new Date(tx.createdAt).toLocaleDateString('fr-FR', {
                          year: 'numeric',
                          month: '2-digit',
                          day: '2-digit',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </td>
                      <td className="py-3.5 px-4 font-bold text-neutral-900 dark:text-white">
                        {tx.reference}
                      </td>
                      <td className="py-3.5 px-4 font-sans">
                        <span
                          className={`text-[11px] font-semibold px-2 py-0.5 rounded ${
                            tx.type === 'DEPOSIT'
                              ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300'
                              : tx.type === 'REFUND'
                              ? 'bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300'
                              : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300'
                          }`}
                        >
                          {tx.type === 'DEPOSIT' ? 'DÉPÔT' : tx.type === 'REFUND' ? 'REMBOURSEMENT' : 'ACHAT'}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 font-sans text-neutral-700 dark:text-neutral-300">
                        {tx.description}
                      </td>
                      <td
                        className={`py-3.5 px-4 text-right font-bold tabular-nums whitespace-nowrap ${
                          isPositive
                            ? 'text-emerald-600 dark:text-emerald-400'
                            : 'text-neutral-900 dark:text-white'
                        }`}
                      >
                        {isPositive ? '+' : ''}
                        {formatCurrency(tx.amountMinor, tx.currency)}
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <span className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 px-2 py-0.5 rounded">
                          Validé
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Deposit Modal */}
        {isDepositModalOpen && (
          <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-neutral-950/75 backdrop-blur-xs animate-in fade-in duration-150">
            <div className="bg-white dark:bg-neutral-900 border-t sm:border border-neutral-200 dark:border-neutral-800 rounded-t-3xl sm:rounded-2xl max-w-md w-full p-5 sm:p-6 shadow-2xl animate-in zoom-in-95 duration-150 text-xs max-h-[92vh] overflow-y-auto">
              <div className="flex items-center justify-between pb-3 sm:pb-4 border-b border-neutral-200 dark:border-neutral-800 mb-4">
                <div className="flex items-center gap-2">
                  <WalletIcon className="w-5 h-5 text-emerald-600" />
                  <h3 className="text-base font-bold text-neutral-900 dark:text-white">
                    Recharger mon portefeuille
                  </h3>
                </div>
                <button
                  onClick={() => setIsDepositModalOpen(false)}
                  aria-label="Fermer"
                  className="w-10 h-10 rounded-xl text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200 flex items-center justify-center hover:bg-neutral-100 dark:hover:bg-neutral-800 cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-4">
                {/* Currency choice */}
                <div>
                  <label className="block font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                    Devise du portefeuille à créditer
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {(['XOF', 'EUR', 'USD'] as Currency[]).map((c) => (
                      <button
                        key={c}
                        type="button"
                        onClick={() => {
                          setDepositCurrency(c);
                          setDepositAmount(c === 'XOF' ? 10000 : 20);
                        }}
                        className={`p-2.5 rounded-xl font-bold border transition-colors cursor-pointer min-h-[44px] flex items-center justify-center ${
                          depositCurrency === c
                            ? 'bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 border-neutral-900 dark:border-white shadow-2xs'
                            : 'bg-neutral-50 dark:bg-neutral-800 border-neutral-200 dark:border-neutral-700 text-neutral-600 dark:text-neutral-400'
                        }`}
                      >
                        {c}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Amount input */}
                <div>
                  <label className="block font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                    Montant à déposer ({depositCurrency})
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={depositAmount}
                    onChange={(e) => setDepositAmount(Number(e.target.value))}
                    className="w-full px-3 py-2.5 bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-xl text-base sm:text-sm font-mono font-bold text-neutral-900 dark:text-white min-h-[44px]"
                  />
                  <div className="flex flex-wrap gap-1.5 sm:gap-2 mt-2">
                    {depositCurrency === 'XOF'
                      ? [5000, 10000, 25000, 50000].map((amt) => (
                          <button
                            key={amt}
                            type="button"
                            onClick={() => setDepositAmount(amt)}
                            className="px-2.5 py-1.5 bg-neutral-100 dark:bg-neutral-800 rounded-lg font-mono text-xs hover:bg-neutral-200 dark:hover:bg-neutral-700 cursor-pointer min-h-[36px]"
                          >
                            +{amt.toLocaleString('fr-FR')}
                          </button>
                        ))
                      : [10, 20, 50, 100].map((amt) => (
                          <button
                            key={amt}
                            type="button"
                            onClick={() => setDepositAmount(amt)}
                            className="px-2.5 py-1.5 bg-neutral-100 dark:bg-neutral-800 rounded-lg font-mono text-xs hover:bg-neutral-200 dark:hover:bg-neutral-700 cursor-pointer min-h-[36px]"
                          >
                            +{amt} {depositCurrency}
                          </button>
                        ))}
                  </div>
                </div>

                {/* Payment Method */}
                <div>
                  <label className="block font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                    Moyen de règlement
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setDepositMethod('MOBILE_MONEY')}
                      className={`p-3 rounded-xl border text-left transition-all cursor-pointer min-h-[50px] ${
                        depositMethod === 'MOBILE_MONEY'
                          ? 'border-emerald-600 bg-emerald-50 dark:bg-emerald-950/60 font-bold text-emerald-900 dark:text-emerald-300'
                          : 'border-neutral-200 dark:border-neutral-700 text-neutral-600 dark:text-neutral-400'
                      }`}
                    >
                      <Smartphone className="w-4 h-4 mb-1 text-amber-500" />
                      <div>Mobile Money</div>
                      <div className="text-[10px] text-neutral-500 font-normal">FedaPay (MoMo, Moov, Celtiis)</div>
                    </button>

                    <button
                      type="button"
                      onClick={() => setDepositMethod('CARD')}
                      className={`p-3 rounded-xl border text-left transition-all cursor-pointer min-h-[50px] ${
                        depositMethod === 'CARD'
                          ? 'border-emerald-600 bg-emerald-50 dark:bg-emerald-950/60 font-bold text-emerald-900 dark:text-emerald-300'
                          : 'border-neutral-200 dark:border-neutral-700 text-neutral-600 dark:text-neutral-400'
                      }`}
                    >
                      <CreditCard className="w-4 h-4 mb-1 text-sky-500" />
                      <div>Carte Bancaire</div>
                      <div className="text-[10px] text-neutral-500 font-normal">Visa / Mastercard</div>
                    </button>
                  </div>
                </div>

                {depositMethod === 'MOBILE_MONEY' && (
                  <div className="p-3 bg-neutral-50 dark:bg-neutral-850 rounded-xl border border-neutral-200 dark:border-neutral-800 space-y-2">
                    <span className="text-[11px] font-bold text-neutral-700 dark:text-neutral-300 block">
                      Opérateur Mobile Money Bénin / Afrique
                    </span>
                    <div className="grid grid-cols-3 gap-2">
                      {(['MTN', 'MOOV', 'CELTIIS'] as MobileMoneyOperator[]).map((op) => (
                        <button
                          key={op}
                          type="button"
                          onClick={() => setDepositOperator(op)}
                          className={`p-2 rounded-lg border text-xs font-bold transition-all cursor-pointer min-h-[44px] flex items-center justify-center ${
                            depositOperator === op
                              ? 'bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 border-neutral-900 dark:border-white shadow-2xs'
                              : 'bg-white dark:bg-neutral-800 border-neutral-200 dark:border-neutral-700 text-neutral-600 dark:text-neutral-400'
                          }`}
                        >
                          {op}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div className="pt-4 mt-5 border-t border-neutral-200 dark:border-neutral-800 flex flex-col sm:flex-row justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsDepositModalOpen(false)}
                  className="px-4 py-2.5 font-semibold text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white min-h-[44px]"
                >
                  Annuler
                </button>
                <button
                  type="button"
                  onClick={handleConfirmDeposit}
                  disabled={isDepositing || depositAmount <= 0}
                  className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold px-5 py-3 rounded-xl transition-colors cursor-pointer flex items-center justify-center gap-2 min-h-[44px]"
                >
                  {isDepositing ? (
                    <span>Confirmation en cours...</span>
                  ) : (
                    <>
                      <Lock className="w-4 h-4" />
                      <span>Confirmer le dépôt ({formatCurrency(depositAmount, depositCurrency)})</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
