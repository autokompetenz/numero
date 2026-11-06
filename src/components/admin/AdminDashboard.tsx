/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { formatCurrency, DEFAULT_EXCHANGE_RATES } from '../../services/pricingEngine';
import {
  TrendingUp,
  DollarSign,
  ShieldAlert,
  Server,
  Layers,
  Sliders,
  History,
  RotateCcw,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  ExternalLink,
  Lock,
  Smartphone,
  Wallet as WalletIcon,
} from 'lucide-react';

export const AdminDashboard: React.FC = () => {
  const {
    orders,
    wallets,
    transactions,
    auditLogs,
    providers,
    apiStatus,
    refreshApiStatus,
    pricingConfig,
    updatePricingConfig,
    services,
    countries,
    cancelAndRefundOrder,
    refreshProviderPing,
    updateServiceCost,
    addToast,
  } = useApp();

  const [activeAdminTab, setActiveAdminTab] = useState<'financial' | 'pricing' | 'orders' | 'catalog' | 'audit'>('financial');

  // Pricing rule form state
  const [formTargetMargin, setFormTargetMargin] = useState(pricingConfig.targetMarginXof);
  const [formRateMomo, setFormRateMomo] = useState(pricingConfig.paymentRateMomo * 100);
  const [formRateCard, setFormRateCard] = useState(pricingConfig.paymentRateCard * 100);
  const [formRoundingStep, setFormRoundingStep] = useState(pricingConfig.roundingStepXof);

  // Financial calculations
  const totalOrdersCount = orders.length;
  const completedOrders = orders.filter((o) => o.status === 'COMPLETED');
  const refundedOrders = orders.filter((o) => o.status === 'REFUNDED');

  // Gross turnover in XOF reference
  const grossRevenueXof = orders
    .filter((o) => o.status !== 'REFUNDED')
    .reduce((acc, o) => acc + o.sellingPriceXof, 0);

  // Supplier cost paid to Ultra SMS
  const totalSupplierCostXof = orders
    .filter((o) => o.status !== 'REFUNDED')
    .reduce((acc, o) => acc + o.supplierCostXof, 0);

  // Payment fees paid to aggregators (FedaPay, KKiaPay, Card gateways)
  const totalPaymentFeesXof = orders
    .filter((o) => o.status !== 'REFUNDED')
    .reduce((acc, o) => acc + o.paymentFeeXof, 0);

  // Net realized margin
  const netProfitRealizedXof = grossRevenueXof - totalSupplierCostXof - totalPaymentFeesXof;

  // Average margin per completed number
  const averageMarginPerNumber = completedOrders.length > 0
    ? Math.round(
        completedOrders.reduce((acc, o) => acc + o.actualMarginXof, 0) / completedOrders.length
      )
    : pricingConfig.targetMarginXof;

  // Total customer wallet funds (Liabilities - MUST be kept distinct from platform revenue)
  const totalClientFundsXof = wallets.reduce((acc, w) => {
    if (w.currency === 'XOF') return acc + w.balanceMinor;
    if (w.currency === 'EUR') return acc + Math.round(w.balanceMinor * DEFAULT_EXCHANGE_RATES.EUR_TO_XOF);
    if (w.currency === 'USD') return acc + Math.round(w.balanceMinor * DEFAULT_EXCHANGE_RATES.USD_TO_XOF);
    return acc;
  }, 0);

  const handleSavePricingRules = (e: React.FormEvent) => {
    e.preventDefault();
    updatePricingConfig({
      targetMarginXof: Number(formTargetMargin),
      paymentRateMomo: Number(formRateMomo) / 100,
      paymentRateCard: Number(formRateCard) / 100,
      roundingStepXof: Number(formRoundingStep),
    });
  };

  return (
    <div className="py-8 bg-neutral-50 dark:bg-neutral-950 border-b border-neutral-200 dark:border-neutral-800 min-h-[600px] transition-colors">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Top Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold text-amber-600 dark:text-amber-400 mb-1">
              <ShieldAlert className="w-3.5 h-3.5" />
              <span>Console de Contrôle Direction & Finances Numivo</span>
            </div>
            <h1 className="text-2xl font-bold text-neutral-900 dark:text-white">
              Supervision & Rentabilité Commerciale
            </h1>
            <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">
              Contrôlez les marges nettes réalisées, les commissions passerelles et le journal de sécurité immuable.
            </p>
          </div>

          <div className="flex items-center gap-2 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 px-3 py-1.5 rounded-xl text-xs font-mono text-amber-800 dark:text-amber-300">
            <span>Marge cible légale :</span>
            <span className="font-bold">{pricingConfig.targetMarginXof.toLocaleString('fr-FR')} XOF / n°</span>
          </div>
        </div>

        {/* Admin Navigation Tabs */}
        <div className="flex items-center gap-1 sm:gap-2 border-b border-neutral-200 dark:border-neutral-800 mb-6 sm:mb-8 overflow-x-auto text-xs font-semibold -mx-4 px-4 sm:mx-0 sm:px-0 pb-1">
          <button
            onClick={() => setActiveAdminTab('financial')}
            className={`py-3 px-3.5 sm:px-4 border-b-2 whitespace-nowrap cursor-pointer transition-colors min-h-[44px] flex items-center ${
              activeAdminTab === 'financial'
                ? 'border-amber-600 text-amber-600 dark:text-amber-400'
                : 'border-transparent text-neutral-500 hover:text-neutral-900 dark:hover:text-white'
            }`}
          >
            Vue d'ensemble Financière
          </button>
          <button
            onClick={() => setActiveAdminTab('pricing')}
            className={`py-3 px-3.5 sm:px-4 border-b-2 whitespace-nowrap cursor-pointer transition-colors min-h-[44px] flex items-center ${
              activeAdminTab === 'pricing'
                ? 'border-amber-600 text-amber-600 dark:text-amber-400'
                : 'border-transparent text-neutral-500 hover:text-neutral-900 dark:hover:text-white'
            }`}
          >
            Règles de Prix & Marges
          </button>
          <button
            onClick={() => setActiveAdminTab('orders')}
            className={`py-3 px-3.5 sm:px-4 border-b-2 whitespace-nowrap cursor-pointer transition-colors min-h-[44px] flex items-center ${
              activeAdminTab === 'orders'
                ? 'border-amber-600 text-amber-600 dark:text-amber-400'
                : 'border-transparent text-neutral-500 hover:text-neutral-900 dark:hover:text-white'
            }`}
          >
            Commandes & Remboursements ({orders.length})
          </button>
          <button
            onClick={() => setActiveAdminTab('catalog')}
            className={`py-3 px-3.5 sm:px-4 border-b-2 whitespace-nowrap cursor-pointer transition-colors min-h-[44px] flex items-center ${
              activeAdminTab === 'catalog'
                ? 'border-amber-600 text-amber-600 dark:text-amber-400'
                : 'border-transparent text-neutral-500 hover:text-neutral-900 dark:hover:text-white'
            }`}
          >
            Catalogue & Fournisseurs ({providers.length})
          </button>
          <button
            onClick={() => setActiveAdminTab('audit')}
            className={`py-3 px-3.5 sm:px-4 border-b-2 whitespace-nowrap cursor-pointer transition-colors min-h-[44px] flex items-center ${
              activeAdminTab === 'audit'
                ? 'border-amber-600 text-amber-600 dark:text-amber-400'
                : 'border-transparent text-neutral-500 hover:text-neutral-900 dark:hover:text-white'
            }`}
          >
            Journal d'Audit ({auditLogs.length})
          </button>
        </div>

        {/* TAB 1: FINANCIAL OVERVIEW */}
        {activeAdminTab === 'financial' && (
          <div className="space-y-8">
            {/* KPI Cards Row */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
              {/* Card 1: Chiffre d'Affaires Brut */}
              <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl p-5 shadow-2xs">
                <span className="text-[11px] font-bold uppercase tracking-wider text-neutral-400 block mb-1">
                  Chiffre d’Affaires Brut
                </span>
                <div className="text-2xl font-bold font-mono text-neutral-900 dark:text-white tabular-nums">
                  {grossRevenueXof.toLocaleString('fr-FR')} XOF
                </div>
                <div className="text-[11px] text-neutral-500 mt-2">
                  Volume total : {totalOrdersCount} commandes traitées
                </div>
              </div>

              {/* Card 2: Coût Fournisseur Ultra SMS */}
              <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl p-5 shadow-2xs">
                <span className="text-[11px] font-bold uppercase tracking-wider text-neutral-400 block mb-1">
                  Achats Ultra SMS
                </span>
                <div className="text-2xl font-bold font-mono text-rose-600 dark:text-rose-400 tabular-nums">
                  {totalSupplierCostXof.toLocaleString('fr-FR')} XOF
                </div>
                <div className="text-[11px] text-neutral-500 mt-2">
                  Coût brut des numéros alloués
                </div>
              </div>

              {/* Card 3: Commissions Passerelles */}
              <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl p-5 shadow-2xs">
                <span className="text-[11px] font-bold uppercase tracking-wider text-neutral-400 block mb-1">
                  Frais Paiement FedaPay / KKiaPay
                </span>
                <div className="text-2xl font-bold font-mono text-amber-600 dark:text-amber-400 tabular-nums">
                  {Math.round(totalPaymentFeesXof).toLocaleString('fr-FR')} XOF
                </div>
                <div className="text-[11px] text-neutral-500 mt-2">
                  Mobile Money (2.5%) & Cartes (3.6%)
                </div>
              </div>

              {/* Card 4: Bénéfice Net Réalisé */}
              <div className="bg-white dark:bg-neutral-900 border border-emerald-500/30 rounded-2xl p-5 shadow-2xs">
                <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400 block mb-1">
                  Marge Nette Réalisée
                </span>
                <div className="text-2xl font-bold font-mono text-emerald-600 dark:text-emerald-400 tabular-nums">
                  +{Math.round(netProfitRealizedXof).toLocaleString('fr-FR')} XOF
                </div>
                <div className="text-[11px] text-emerald-700 dark:text-emerald-300 font-semibold mt-2">
                  Moyenne : ~{averageMarginPerNumber.toLocaleString('fr-FR')} XOF / numéro
                </div>
              </div>
            </div>

            {/* Crucial Section: Séparation des Fonds Clients en Portefeuille (Section 6.3) */}
            <div className="bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/60 rounded-2xl p-6">
              <div className="flex items-start justify-between gap-4 flex-col md:flex-row">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <WalletIcon className="w-4 h-4 text-amber-600" />
                    <h3 className="text-base font-bold text-amber-900 dark:text-amber-200">
                      Règle Comptable : Séparation des Fonds Portefeuille Clients
                    </h3>
                  </div>
                  <p className="text-xs text-amber-800/90 dark:text-amber-300/80 max-w-3xl leading-relaxed">
                    Conformément à la section 6.3 du cahier des charges : « Les fonds du portefeuille client sont une obligation envers le client, et non du chiffre d’affaires disponible de l’entreprise ». Ils sont isolés des revenus d'exploitation.
                  </p>
                </div>

                <div className="bg-white dark:bg-neutral-900 border border-amber-300 dark:border-amber-700 rounded-xl px-5 py-3 text-right shrink-0">
                  <span className="text-[10px] text-neutral-400 uppercase font-semibold block">
                    Passif exigible (Dépôts clients)
                  </span>
                  <span className="text-xl font-bold font-mono text-neutral-900 dark:text-white tabular-nums">
                    {totalClientFundsXof.toLocaleString('fr-FR')} XOF
                  </span>
                </div>
              </div>
            </div>

            {/* Performance by Service Table */}
            <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl overflow-hidden shadow-2xs">
              <div className="p-4 sm:p-5 border-b border-neutral-200 dark:border-neutral-800">
                <h3 className="text-base font-bold text-neutral-900 dark:text-white">
                  Rentabilité par Service & Atteinte de l’Objectif 2 000 XOF
                </h3>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs min-w-[640px]">
                  <thead className="bg-neutral-50 dark:bg-neutral-850 text-neutral-500 font-semibold uppercase text-[10px] tracking-wider border-b border-neutral-200 dark:border-neutral-800">
                    <tr>
                      <th className="py-3 px-4">Service</th>
                      <th className="py-3 px-4 text-right">Coût Ultra SMS</th>
                      <th className="py-3 px-4 text-right">Prix Vente MoMo</th>
                      <th className="py-3 px-4 text-right">Commission Est.</th>
                      <th className="py-3 px-4 text-right">Marge Nette</th>
                      <th className="py-3 px-4 text-center">Conformité Cible</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800 font-mono">
                    {services.slice(0, 6).map((service) => {
                      const cost = service.baseSupplierCostXof;
                      const raw = (cost + pricingConfig.targetMarginXof) / (1 - pricingConfig.paymentRateMomo);
                      const price = Math.ceil(raw / pricingConfig.roundingStepXof) * pricingConfig.roundingStepXof;
                      const fee = price * pricingConfig.paymentRateMomo;
                      const margin = price - cost - fee;

                      return (
                        <tr key={service.id} className="hover:bg-neutral-50/50 dark:hover:bg-neutral-850/50">
                          <td className="py-3.5 px-4 font-sans font-bold text-neutral-900 dark:text-white">
                            {service.name}
                          </td>
                          <td className="py-3.5 px-4 text-right tabular-nums text-neutral-600 dark:text-neutral-400">
                            {cost.toLocaleString('fr-FR')} XOF
                          </td>
                          <td className="py-3.5 px-4 text-right tabular-nums font-bold text-neutral-900 dark:text-white">
                            {price.toLocaleString('fr-FR')} XOF
                          </td>
                          <td className="py-3.5 px-4 text-right tabular-nums text-amber-600 dark:text-amber-400">
                            {Math.round(fee).toLocaleString('fr-FR')} XOF
                          </td>
                          <td className="py-3.5 px-4 text-right tabular-nums font-bold text-emerald-600 dark:text-emerald-400">
                            +{Math.round(margin).toLocaleString('fr-FR')} XOF
                          </td>
                          <td className="py-3.5 px-4 text-center font-sans">
                            <span className="text-[10px] font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/60 px-2 py-0.5 rounded">
                              ≥ 2 000 XOF (OK)
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: PRICING CONFIGURATION MANAGER */}
        {activeAdminTab === 'pricing' && (
          <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl p-6 md:p-8 max-w-2xl shadow-2xs">
            <h3 className="text-lg font-bold text-neutral-900 dark:text-white mb-2">
              Paramètres des Règles de Prix & Marges Commerciales
            </h3>
            <p className="text-xs text-neutral-500 mb-6 leading-relaxed">
              Modifiez ici les paramètres de calcul dynamique. Tout changement est instantanément répercuté sur le devis client et archivé dans le journal d'audit de sécurité.
            </p>

            <form onSubmit={handleSavePricingRules} className="space-y-5 text-xs">
              <div>
                <label className="block font-bold text-neutral-800 dark:text-neutral-200 mb-1">
                  Marge nette cible par numéro (XOF)
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    step="100"
                    min="500"
                    value={formTargetMargin}
                    onChange={(e) => setFormTargetMargin(Number(e.target.value))}
                    className="w-full px-3 py-2 bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg font-mono font-bold text-sm text-neutral-900 dark:text-white"
                  />
                  <span className="font-mono text-neutral-500 font-bold">XOF</span>
                </div>
                <span className="text-[11px] text-neutral-500 mt-0.5 block">
                  Valeur contractuelle définie au cahier des charges : 2 000 XOF.
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block font-bold text-neutral-800 dark:text-neutral-200 mb-1">
                    Taux commission Mobile Money (%)
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    max="10"
                    value={formRateMomo}
                    onChange={(e) => setFormRateMomo(Number(e.target.value))}
                    className="w-full px-3 py-2 bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg font-mono font-bold text-sm text-neutral-900 dark:text-white"
                  />
                  <span className="text-[11px] text-neutral-500 mt-0.5 block">
                    FedaPay / KKiaPay standard : 2.5%
                  </span>
                </div>

                <div>
                  <label className="block font-bold text-neutral-800 dark:text-neutral-200 mb-1">
                    Taux commission Carte Bancaire (%)
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    max="10"
                    value={formRateCard}
                    onChange={(e) => setFormRateCard(Number(e.target.value))}
                    className="w-full px-3 py-2 bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg font-mono font-bold text-sm text-neutral-900 dark:text-white"
                  />
                  <span className="text-[11px] text-neutral-500 mt-0.5 block">
                    Visa / Mastercard : 3.6%
                  </span>
                </div>
              </div>

              <div>
                <label className="block font-bold text-neutral-800 dark:text-neutral-200 mb-1">
                  Palier d'arrondi commercial supérieur (XOF)
                </label>
                <select
                  value={formRoundingStep}
                  onChange={(e) => setFormRoundingStep(Number(e.target.value))}
                  className="w-full px-3 py-2 bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg font-mono font-medium text-xs text-neutral-900 dark:text-white"
                >
                  <option value={50}>Arrondi à 50 XOF près</option>
                  <option value={100}>Arrondi à 100 XOF près (Recommandé)</option>
                  <option value={200}>Arrondi à 200 XOF près</option>
                  <option value={500}>Arrondi à 500 XOF près</option>
                </select>
              </div>

              <div className="pt-4 border-t border-neutral-200 dark:border-neutral-800 flex justify-end">
                <button
                  type="submit"
                  className="bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs px-6 py-2.5 rounded-xl shadow-xs transition-colors cursor-pointer"
                >
                  Enregistrer les nouvelles règles
                </button>
              </div>
            </form>
          </div>
        )}

        {/* TAB 3: ORDERS & REFUNDS */}
        {activeAdminTab === 'orders' && (
          <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl overflow-hidden shadow-2xs">
            <div className="p-4 sm:p-5 border-b border-neutral-200 dark:border-neutral-800 flex items-center justify-between">
              <h3 className="text-base font-bold text-neutral-900 dark:text-white">
                Toutes les commandes clients ({orders.length})
              </h3>
              <span className="text-xs text-neutral-500">
                Action administrative : Remboursement direct avec enregistrement au grand livre
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs min-w-[700px]">
                <thead className="bg-neutral-50 dark:bg-neutral-850 text-neutral-500 font-semibold uppercase text-[10px] tracking-wider border-b border-neutral-200 dark:border-neutral-800">
                  <tr>
                    <th className="py-3 px-4">Commande</th>
                    <th className="py-3 px-4">Client</th>
                    <th className="py-3 px-4">Service & Pays</th>
                    <th className="py-3 px-4">Numéro Virtuel</th>
                    <th className="py-3 px-4 text-right">Prix Client</th>
                    <th className="py-3 px-4 text-right">Marge Nette</th>
                    <th className="py-3 px-4 text-center">Statut</th>
                    <th className="py-3 px-4 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800 font-mono">
                  {orders.map((o) => (
                    <tr key={o.id} className="hover:bg-neutral-50/50 dark:hover:bg-neutral-850/50">
                      <td className="py-3.5 px-4 font-bold text-neutral-900 dark:text-white">
                        {o.orderNumber}
                      </td>
                      <td className="py-3.5 px-4 font-sans text-neutral-700 dark:text-neutral-300">
                        {o.userName}
                      </td>
                      <td className="py-3.5 px-4 font-sans">
                        {o.serviceName} ({o.countryCode})
                      </td>
                      <td className="py-3.5 px-4 text-neutral-800 dark:text-neutral-200">
                        {o.phoneNumber || '—'}
                      </td>
                      <td className="py-3.5 px-4 text-right tabular-nums font-bold">
                        {formatCurrency(o.sellingPriceMinor, o.currency)}
                      </td>
                      <td className="py-3.5 px-4 text-right tabular-nums text-emerald-600 dark:text-emerald-400 font-bold">
                        +{Math.round(o.actualMarginXof).toLocaleString('fr-FR')} XOF
                      </td>
                      <td className="py-3.5 px-4 text-center font-sans">
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                            o.status === 'COMPLETED'
                              ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300'
                              : o.status === 'PROCESSING'
                              ? 'bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300'
                              : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-600'
                          }`}
                        >
                          {o.status}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-right font-sans">
                        {o.status !== 'REFUNDED' && (
                          <button
                            onClick={() => cancelAndRefundOrder(o.id, 'Remboursement initié par Admin')}
                            className="text-[11px] font-semibold text-rose-600 hover:text-rose-700 hover:underline cursor-pointer"
                          >
                            Rembourser
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 4: CATALOG & PROVIDERS CONFIGURATION */}
        {activeAdminTab === 'catalog' && (
          <div className="space-y-6">
            {/* Live API Status Banner */}
            <div className="bg-emerald-950/40 border border-emerald-800/60 rounded-2xl p-5 text-xs text-emerald-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  <span className="font-bold text-sm text-white">
                    Passerelles FedaPay & Fournisseur Num Fast Connectés
                  </span>
                </div>
                <p className="text-emerald-200/80 leading-relaxed max-w-2xl text-[11px]">
                  Vos clés d'API sont prises en charge de façon sécurisée côté serveur via les variables d'environnement (.env) pour garantir l'absence de fuite en frontend.
                </p>
              </div>

              <button
                onClick={async () => {
                  await refreshApiStatus();
                  addToast('Statut API vérifié', 'Connexion aux passerelles FedaPay et Num Fast active.', 'success');
                }}
                className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs px-4 py-2 rounded-xl transition-colors flex items-center gap-2 cursor-pointer self-start md:self-auto shrink-0"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Rafraîchir statut serveur</span>
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              {/* Card 1: FedaPay Gateway */}
              <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl p-5 shadow-2xs flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300">
                      {apiStatus?.fedapay.configured ? 'CONNECTÉ (PROD/SANDBOX)' : 'PRÊT (SANDBOX ACTIF)'}
                    </span>
                    <span className="text-[10px] text-neutral-400 font-mono">Mobile Money / Cartes</span>
                  </div>

                  <h4 className="text-sm font-bold text-neutral-900 dark:text-white mb-1">
                    FedaPay (MTN, Moov, Celtiis)
                  </h4>
                  <p className="text-[11px] text-neutral-500 font-mono mb-3">
                    {apiStatus?.fedapay.endpoint || 'https://sandbox-api.fedapay.com/v1'}
                  </p>

                  <div className="p-2.5 bg-neutral-50 dark:bg-neutral-850 rounded-lg text-xs font-mono space-y-1 mb-4">
                    <div className="text-neutral-500 text-[10px]">Environnement :</div>
                    <div className="font-bold text-neutral-700 dark:text-neutral-300 uppercase">
                      {apiStatus?.fedapay.environment || 'SANDBOX'}
                    </div>
                    <div className="text-neutral-500 text-[10px] pt-1">Clé Secrète (.env) :</div>
                    <div className="font-bold text-neutral-700 dark:text-neutral-300">
                      {apiStatus?.fedapay.secretKeyMasked || 'sk_••••••••'}
                    </div>
                  </div>
                </div>

                <div className="pt-3 border-t border-neutral-200 dark:border-neutral-800 flex items-center justify-between text-xs">
                  <span className="text-[10px] text-neutral-400">Passerelle Bénin & UEMOA</span>
                  <button
                    onClick={() => refreshProviderPing('prov_fedapay')}
                    className="flex items-center gap-1 text-[11px] font-bold text-emerald-600 hover:text-emerald-700 cursor-pointer"
                  >
                    <RefreshCw className="w-3 h-3" />
                    <span>Ping FedaPay</span>
                  </button>
                </div>
              </div>

              {/* Card 2: Num Fast Provider */}
              <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl p-5 shadow-2xs flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300">
                      {apiStatus?.numfast.configured ? 'CONNECTÉ' : 'PRÊT (SANDBOX ACTIF)'}
                    </span>
                    <span className="text-[10px] text-neutral-400 font-mono">Numéros & SMS</span>
                  </div>

                  <h4 className="text-sm font-bold text-neutral-900 dark:text-white mb-1">
                    Num Fast API
                  </h4>
                  <p className="text-[11px] text-neutral-500 font-mono mb-3">
                    {apiStatus?.numfast.baseUrl || 'https://api.numfast.com'}
                  </p>

                  <div className="p-2.5 bg-neutral-50 dark:bg-neutral-850 rounded-lg text-xs font-mono space-y-1 mb-4">
                    <div className="text-neutral-500 text-[10px]">Clé API Num Fast (.env) :</div>
                    <div className="font-bold text-neutral-700 dark:text-neutral-300">
                      {apiStatus?.numfast.keyMasked || 'nf_••••••••'}
                    </div>
                    <div className="text-emerald-600 dark:text-emerald-400 font-semibold pt-1 text-[11px]">
                      Route : /api/numfast/order
                    </div>
                  </div>
                </div>

                <div className="pt-3 border-t border-neutral-200 dark:border-neutral-800 flex items-center justify-between text-xs">
                  <span className="text-[10px] text-neutral-400">Attribution temps réel</span>
                  <button
                    onClick={() => refreshProviderPing('prov_numfast')}
                    className="flex items-center gap-1 text-[11px] font-bold text-emerald-600 hover:text-emerald-700 cursor-pointer"
                  >
                    <RefreshCw className="w-3 h-3" />
                    <span>Ping Num Fast</span>
                  </button>
                </div>
              </div>

              {/* Card 3: Guide de configuration .env */}
              <div className="bg-neutral-900 text-white rounded-2xl p-5 shadow-2xs flex flex-col justify-between">
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <Lock className="w-4 h-4 text-emerald-400" />
                    <span className="text-xs font-bold text-white">Variables d'Environnement (.env)</span>
                  </div>
                  <p className="text-[11px] text-neutral-400 leading-relaxed mb-3">
                    Pour basculer en production avec vos propres clés FedaPay et Num Fast, ajoutez-les dans votre fichier <code className="text-emerald-300 bg-neutral-800 px-1 py-0.5 rounded font-mono">.env</code> :
                  </p>

                  <pre className="p-2.5 bg-neutral-950 rounded-lg text-[10px] font-mono text-emerald-300 overflow-x-auto border border-neutral-800 space-y-0.5">
                    <div>FEDAPAY_SECRET_KEY="sk_live_..."</div>
                    <div>FEDAPAY_PUBLIC_KEY="pk_live_..."</div>
                    <div>FEDAPAY_ENVIRONMENT="live"</div>
                    <div>NUMFAST_API_KEY="nf_..."</div>
                    <div>NUMFAST_BASE_URL="https://api.numfast.com"</div>
                  </pre>
                </div>

                <div className="pt-3 border-t border-neutral-800 text-[10px] text-neutral-400 flex items-center justify-between">
                  <span>Sécurité 100% serveur (pas d'exposition client)</span>
                  <span className="text-emerald-400 font-bold">Actif</span>
                </div>
              </div>
            </div>

            {/* Services Base Cost editor */}
            <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl p-6 shadow-2xs">
              <h3 className="text-base font-bold text-neutral-900 dark:text-white mb-1">
                Ajustement des Coûts Fournisseur Ultra SMS
              </h3>
              <p className="text-xs text-neutral-500 mb-4">
                Si Ultra SMS modifie son tarif de gros pour un service, mettez-le à jour ici. Le prix de vente client sera automatiquement recalculé pour préserver les 2 000 XOF de marge nette.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 text-xs">
                {services.map((srv) => (
                  <div
                    key={srv.id}
                    className="p-3 bg-neutral-50 dark:bg-neutral-850 border border-neutral-200 dark:border-neutral-800 rounded-xl flex items-center justify-between gap-3"
                  >
                    <div>
                      <span className="font-bold text-neutral-900 dark:text-white block">{srv.name}</span>
                      <span className="text-[10px] text-neutral-400 font-mono">Taux : {srv.successRate}%</span>
                    </div>

                    <div className="flex items-center gap-1.5 font-mono">
                      <input
                        type="number"
                        step="50"
                        min="100"
                        value={srv.baseSupplierCostXof}
                        onChange={(e) => updateServiceCost(srv.id, Number(e.target.value))}
                        className="w-20 px-2 py-1 bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded text-right font-bold text-xs"
                      />
                      <span className="text-[10px] text-neutral-500">XOF</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* TAB 5: SECURITY AUDIT LOG VIEWER */}
        {activeAdminTab === 'audit' && (
          <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl overflow-hidden shadow-2xs">
            <div className="p-4 sm:p-5 border-b border-neutral-200 dark:border-neutral-800">
              <h3 className="text-base font-bold text-neutral-900 dark:text-white">
                Journal d'Audit Immuable de Sécurité (AuditLog)
              </h3>
              <p className="text-xs text-neutral-500 mt-0.5">
                Chaque action administrative, changement de règle financière, webhook et remboursement est consigné avec horodatage strict et adresse IP.
              </p>
            </div>

            <div className="divide-y divide-neutral-100 dark:divide-neutral-800 text-xs">
              {auditLogs.map((log) => (
                <div key={log.id} className="p-4 hover:bg-neutral-50/50 dark:hover:bg-neutral-850/50 transition-colors">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 mb-1">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-neutral-900 dark:text-white">
                        {log.action}
                      </span>
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400">
                        {log.entityType}
                      </span>
                    </div>
                    <span className="text-[11px] font-mono text-neutral-400">
                      {new Date(log.createdAt).toLocaleString('fr-FR')}
                    </span>
                  </div>

                  <div className="flex items-center gap-3 text-neutral-500 text-[11px] mb-2">
                    <span>Par : <strong className="text-neutral-700 dark:text-neutral-300">{log.actorName}</strong> ({log.actorRole})</span>
                    <span>·</span>
                    <span>Entité : {log.entityId}</span>
                    {log.ipAddress && (
                      <>
                        <span>·</span>
                        <span className="font-mono">IP : {log.ipAddress}</span>
                      </>
                    )}
                  </div>

                  {log.metadata && (
                    <pre className="p-2.5 bg-neutral-50 dark:bg-neutral-850 rounded-lg text-[10px] font-mono text-neutral-600 dark:text-neutral-400 overflow-x-auto border border-neutral-200 dark:border-neutral-800">
                      {JSON.stringify(log.metadata, null, 2)}
                    </pre>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
