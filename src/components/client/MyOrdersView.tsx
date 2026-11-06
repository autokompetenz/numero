/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { formatCurrency } from '../../services/pricingEngine';
import {
  Smartphone,
  Copy,
  Check,
  RotateCcw,
  Clock,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  MessageSquare,
  Sparkles,
  ShoppingBag,
} from 'lucide-react';

interface MyOrdersViewProps {
  onOpenBuyModal: () => void;
}

export const MyOrdersView: React.FC<MyOrdersViewProps> = ({ onOpenBuyModal }) => {
  const { orders, cancelAndRefundOrder, simulateIncomingSms, addToast, currency } = useApp();

  const [copiedText, setCopiedText] = useState<string | null>(null);
  const [filter, setFilter] = useState<'ALL' | 'ACTIVE' | 'COMPLETED' | 'REFUNDED'>('ALL');

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopiedText(text);
    addToast(`${label} copié !`, text, 'info');
    setTimeout(() => setCopiedText(null), 2500);
  };

  const filteredOrders = orders.filter((o) => {
    if (filter === 'ACTIVE') return o.status === 'PROCESSING' || o.status === 'PAID';
    if (filter === 'COMPLETED') return o.status === 'COMPLETED';
    if (filter === 'REFUNDED') return o.status === 'REFUNDED';
    return true;
  });

  return (
    <div className="py-6 sm:py-8 bg-neutral-50 dark:bg-neutral-950 border-b border-neutral-200 dark:border-neutral-800 min-h-[600px] transition-colors">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 sm:mb-8">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-neutral-900 dark:text-white">
              Mes Numéros Virtuels & SMS Reçus
            </h1>
            <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">
              Consultez vos numéros actifs, surveillez l’arrivée de vos codes OTP et gérez vos garanties de remboursement.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={onOpenBuyModal}
              className="w-full sm:w-auto flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs px-4 py-2.5 rounded-xl shadow-xs transition-colors cursor-pointer min-h-[44px]"
            >
              <ShoppingBag className="w-4 h-4" />
              <span>Nouveau numéro</span>
            </button>
          </div>
        </div>

        {/* Filter Segmented Control with horizontal scroll on mobile */}
        <div className="overflow-x-auto pb-2 -mx-4 px-4 sm:mx-0 sm:px-0">
          <div className="flex items-center gap-1.5 p-1 bg-white dark:bg-neutral-900 rounded-xl border border-neutral-200 dark:border-neutral-800 w-max sm:w-fit mb-4 text-xs font-medium">
            <button
              onClick={() => setFilter('ALL')}
              className={`px-3 py-2 rounded-lg transition-colors cursor-pointer min-h-[40px] whitespace-nowrap ${
                filter === 'ALL'
                  ? 'bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 font-bold shadow-2xs'
                  : 'text-neutral-500 hover:text-neutral-900 dark:hover:text-white'
              }`}
            >
              Toutes ({orders.length})
            </button>
            <button
              onClick={() => setFilter('ACTIVE')}
              className={`px-3 py-2 rounded-lg transition-colors cursor-pointer min-h-[40px] whitespace-nowrap ${
                filter === 'ACTIVE'
                  ? 'bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 font-bold shadow-2xs'
                  : 'text-neutral-500 hover:text-neutral-900 dark:hover:text-white'
              }`}
            >
              En attente SMS ({orders.filter((o) => o.status === 'PROCESSING' || o.status === 'PAID').length})
            </button>
            <button
              onClick={() => setFilter('COMPLETED')}
              className={`px-3 py-2 rounded-lg transition-colors cursor-pointer min-h-[40px] whitespace-nowrap ${
                filter === 'COMPLETED'
                  ? 'bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 font-bold shadow-2xs'
                  : 'text-neutral-500 hover:text-neutral-900 dark:hover:text-white'
              }`}
            >
              SMS reçus ({orders.filter((o) => o.status === 'COMPLETED').length})
            </button>
            <button
              onClick={() => setFilter('REFUNDED')}
              className={`px-3 py-2 rounded-lg transition-colors cursor-pointer min-h-[40px] whitespace-nowrap ${
                filter === 'REFUNDED'
                  ? 'bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 font-bold shadow-2xs'
                  : 'text-neutral-500 hover:text-neutral-900 dark:hover:text-white'
              }`}
            >
              Remboursées ({orders.filter((o) => o.status === 'REFUNDED').length})
            </button>
          </div>
        </div>

        {/* Orders List */}
        {filteredOrders.length === 0 ? (
          <div className="text-center py-16 bg-white dark:bg-neutral-900 rounded-2xl border border-dashed border-neutral-300 dark:border-neutral-800">
            <Smartphone className="w-10 h-10 text-neutral-400 mx-auto mb-3" />
            <h3 className="text-sm font-bold text-neutral-800 dark:text-neutral-200">
              Aucune commande dans cette catégorie
            </h3>
            <p className="text-xs text-neutral-500 mt-1 max-w-sm mx-auto">
              Commandez votre premier numéro virtuel pour commencer à recevoir des SMS de vérification.
            </p>
            <button
              onClick={onOpenBuyModal}
              className="mt-4 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs px-5 py-2.5 rounded-xl transition-colors cursor-pointer min-h-[44px]"
            >
              Acheter un numéro maintenant
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredOrders.map((order) => {
              const isProcessing = order.status === 'PROCESSING' || order.status === 'PAID';
              const isCompleted = order.status === 'COMPLETED';
              const isRefunded = order.status === 'REFUNDED';

              return (
                <div
                  key={order.id}
                  className={`bg-white dark:bg-neutral-900 border rounded-2xl p-4 sm:p-5 shadow-2xs transition-all ${
                    isProcessing
                      ? 'border-emerald-500/50 ring-1 ring-emerald-500/20'
                      : 'border-neutral-200 dark:border-neutral-800'
                  }`}
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 sm:pb-4 border-b border-neutral-100 dark:border-neutral-800">
                    {/* Service & Order metadata */}
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-950/80 border border-emerald-100 dark:border-emerald-800 flex items-center justify-center font-bold text-emerald-700 dark:text-emerald-300 shrink-0">
                        {order.countryCode}
                      </div>

                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="text-base font-bold text-neutral-900 dark:text-white">
                            {order.serviceName}
                          </h3>
                          <span className="text-xs text-neutral-500">({order.countryName})</span>
                        </div>

                        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-neutral-500 mt-0.5">
                          <span>N° {order.orderNumber}</span>
                          <span>·</span>
                          <span>{new Date(order.createdAt).toLocaleDateString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</span>
                          <span>·</span>
                          <span className="font-mono">{order.paymentMethod === 'MOBILE_MONEY' ? `${order.paymentOperator} MoMo` : order.paymentMethod}</span>
                        </div>
                      </div>
                    </div>

                    {/* Status Badge & Price */}
                    <div className="flex items-center justify-between sm:justify-end gap-3 self-stretch sm:self-auto pt-2 sm:pt-0 border-t sm:border-0 border-neutral-100 dark:border-neutral-800">
                      <div className="text-left sm:text-right">
                        <span className="text-[10px] text-neutral-400 block uppercase font-medium">Montant payé</span>
                        <span className="text-base font-bold font-mono text-neutral-900 dark:text-white tabular-nums">
                          {formatCurrency(order.sellingPriceMinor, order.currency)}
                        </span>
                      </div>

                      {isProcessing && (
                        <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-50 dark:bg-amber-950/60 border border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-300 text-xs font-semibold">
                          <Clock className="w-3.5 h-3.5 animate-spin" />
                          <span>En attente (20 min)</span>
                        </div>
                      )}

                      {isCompleted && (
                        <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 text-xs font-semibold">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>SMS reçu</span>
                        </div>
                      )}

                      {isRefunded && (
                        <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 text-xs font-semibold">
                          <RotateCcw className="w-3.5 h-3.5" />
                          <span>Remboursée</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Body: Virtual Phone Number & SMS Section */}
                  <div className="pt-4 grid grid-cols-1 md:grid-cols-12 gap-4 sm:gap-6 items-start sm:items-center">
                    {/* Left: Phone Number Display */}
                    <div className="md:col-span-5 bg-neutral-50 dark:bg-neutral-850 p-3.5 sm:p-4 rounded-xl border border-neutral-200 dark:border-neutral-800">
                      <span className="text-[10px] uppercase font-bold text-neutral-500 block mb-1">
                        Numéro virtuel attribué
                      </span>
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-lg sm:text-2xl font-bold font-mono text-neutral-900 dark:text-white tracking-wide break-all">
                          {order.phoneNumber || 'Génération en cours...'}
                        </span>
                        {order.phoneNumber && (
                          <button
                            onClick={() => copyToClipboard(order.phoneNumber!, 'Numéro de téléphone')}
                            className="w-11 h-11 bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-xl hover:bg-neutral-100 dark:hover:bg-neutral-750 text-neutral-700 dark:text-neutral-200 flex items-center justify-center transition-colors cursor-pointer shrink-0"
                            title="Copier le numéro"
                            aria-label="Copier le numéro de téléphone"
                          >
                            {copiedText === order.phoneNumber ? (
                              <Check className="w-5 h-5 text-emerald-600" />
                            ) : (
                              <Copy className="w-5 h-5" />
                            )}
                          </button>
                        )}
                      </div>
                      <p className="text-[11px] text-neutral-500 mt-2">
                        Collez ce numéro dans l’application {order.serviceName} pour déclencher l’envoi du code.
                      </p>
                    </div>

                    {/* Right: SMS Message or Waiting State */}
                    <div className="md:col-span-7">
                      {order.smsMessages.length > 0 ? (
                        <div className="space-y-3">
                          {order.smsMessages.map((sms) => (
                            <div
                              key={sms.id}
                              className="p-3.5 sm:p-4 bg-emerald-50/70 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-xl"
                            >
                              <div className="flex items-center justify-between mb-1.5">
                                <span className="text-xs font-bold text-emerald-900 dark:text-emerald-300">
                                  SMS de {sms.sender}
                                </span>
                                <span className="text-[10px] text-neutral-500 font-mono">
                                  {new Date(sms.receivedAt).toLocaleTimeString('fr-FR')}
                                </span>
                              </div>

                              <p className="text-xs text-neutral-800 dark:text-neutral-200 leading-relaxed mb-3">
                                {sms.text}
                              </p>

                              {sms.extractedCode && (
                                <div className="flex items-center justify-between bg-white dark:bg-neutral-900 p-3 rounded-xl border border-emerald-300 dark:border-emerald-800">
                                  <div>
                                    <span className="text-[10px] text-neutral-400 uppercase font-semibold block">
                                      Code OTP de validation
                                    </span>
                                    <span className="text-2xl sm:text-3xl font-bold font-mono text-emerald-600 dark:text-emerald-400 tracking-wider">
                                      {sms.extractedCode}
                                    </span>
                                  </div>
                                  <button
                                    onClick={() => copyToClipboard(sms.extractedCode!, 'Code OTP')}
                                    className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs px-3.5 py-2.5 rounded-xl transition-colors cursor-pointer min-h-[44px]"
                                    aria-label="Copier le code OTP"
                                  >
                                    <Copy className="w-4 h-4" />
                                    <span>Copier</span>
                                  </button>
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      ) : isProcessing ? (
                        <div className="p-3.5 sm:p-4 bg-neutral-50 dark:bg-neutral-850 rounded-xl border border-neutral-200 dark:border-neutral-800 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 sm:gap-4">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full border-2 border-emerald-500 border-t-transparent animate-spin shrink-0"></div>
                            <div>
                              <h4 className="text-xs font-bold text-neutral-900 dark:text-white">
                                En attente de réception du SMS...
                              </h4>
                              <p className="text-[11px] text-neutral-500">
                                Réception automatique via l'API Num Fast dès son émission.
                              </p>
                            </div>
                          </div>

                          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 shrink-0 pt-2 sm:pt-0 border-t sm:border-0 border-neutral-200 dark:border-neutral-800">
                            {/* Simulator button for instant test */}
                            <button
                              onClick={() => simulateIncomingSms(order.id)}
                              className="px-3 py-2 bg-emerald-50 dark:bg-emerald-950/80 hover:bg-emerald-100 text-emerald-700 dark:text-emerald-300 text-xs font-semibold rounded-lg border border-emerald-200 dark:border-emerald-800 transition-colors cursor-pointer min-h-[40px] text-center"
                              title="Déclencher manuellement l'arrivée du SMS pour tester"
                            >
                              Tester réception
                            </button>

                            {/* Cancel & Refund Guarantee */}
                            <button
                              onClick={() => cancelAndRefundOrder(order.id, 'Annulation volontaire client')}
                              className="px-3 py-2 bg-white dark:bg-neutral-800 hover:bg-rose-50 dark:hover:bg-rose-950/40 text-rose-600 dark:text-rose-400 text-xs font-semibold rounded-lg border border-neutral-200 dark:border-neutral-700 hover:border-rose-300 transition-colors cursor-pointer min-h-[40px] text-center"
                            >
                              Annuler & Recréditer
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="p-3.5 bg-neutral-100 dark:bg-neutral-850 rounded-xl text-xs text-neutral-500 text-center">
                          Cette commande a été clôturée ou remboursée sur votre portefeuille.
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
