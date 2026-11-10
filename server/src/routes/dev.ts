import { Router } from 'express';
import { prisma } from '../db/prisma.js';
import { env, isLiveEnvironment } from '../config/env.js';
import { forbidden, notFound } from '../lib/errors.js';
import { getFedaPayClient } from '../providers/fedapay/index.js';
import { MockFedaPayClient } from '../providers/fedapay/mock.js';
import { processFedaPayTransaction } from '../services/payments.js';
import { syncOrderFromProvider } from '../services/fulfillment.js';
import { getUltraSmsProvider } from '../providers/ultrasms/index.js';
import { MockUltraSmsProvider } from '../providers/ultrasms/mock.js';

export const devRouter = Router();

devRouter.use((_req, _res, next) => {
  if (isLiveEnvironment) {
    next(forbidden('Outils de développement désactivés en environnement live.'));
    return;
  }
  next();
});

function mockClient(): MockFedaPayClient {
  const client = getFedaPayClient();
  if (!(client instanceof MockFedaPayClient)) {
    throw forbidden('Ces outils nécessitent PAYMENTS_MODE=mock.');
  }
  return client;
}

function esc(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Page de paiement simulée, ouverte dans un nouvel onglet en local.
 * Elle n'existe jamais en production.
 */
devRouter.get('/checkout/:transactionId', async (req, res, next) => {
  try {
    mockClient();
    const payment = await prisma.payment.findFirst({
      where: { providerTransactionId: req.params.transactionId },
      include: { order: true },
    });
    if (!payment) throw notFound('Paiement de test introuvable.');

    const amount = Number(payment.amountMinor);
    const status = payment.status;
    const base = env.APP_URL.replace(/\/$/, '');
    const payId = payment.id;

    res.type('html').send(`<!doctype html>
<html lang="fr">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Paiement de test — Numivo</title>
  <style>
    :root { color-scheme: dark; }
    * { box-sizing: border-box; }
    body { margin:0; min-height:100vh; display:grid; place-items:center; background:#0b1120; color:#e5e7eb; font-family:ui-sans-serif,system-ui,sans-serif; padding:24px; }
    .card { width:100%; max-width:460px; background:#111827; border:1px solid #1f2937; border-radius:20px; padding:32px; text-align:center; }
    .badge { display:inline-block; font-size:12px; letter-spacing:.08em; text-transform:uppercase; color:#fbbf24; border:1px solid #78350f; background:#451a03; border-radius:999px; padding:6px 12px; }
    h1 { font-size:24px; margin:20px 0 8px; }
    p { color:#9ca3af; line-height:1.5; }
    .amount { font-size:40px; font-weight:700; color:#fff; margin:20px 0; }
    .row { display:flex; gap:12px; margin-top:24px; }
    button { flex:1; padding:14px 18px; border-radius:12px; border:0; font-size:15px; font-weight:600; cursor:pointer; }
    .pay { background:#10b981; color:#052e16; }
    .decline { background:#1f2937; color:#e5e7eb; border:1px solid #374151; }
    button:disabled { opacity:.5; cursor:wait; }
    .status { margin-top:20px; font-size:14px; color:#34d399; min-height:20px; }
    .note { font-size:12px; color:#6b7280; margin-top:28px; }
  </style>
</head>
<body>
  <main class="card">
    <span class="badge">Mode test</span>
    <h1>Paiement simulé</h1>
    <p>${esc(payment.order?.reference ?? payment.reference)}</p>
    <div class="amount">${amount.toLocaleString('fr-FR')} XOF</div>
    <p>Statut actuel : <strong>${esc(status)}</strong></p>
    <div class="row">
      <button class="decline" onclick="decide('decline', this)">Refuser</button>
      <button class="pay" onclick="decide('approve', this)">Payer</button>
    </div>
    <div class="status" id="status"></div>
    <p class="note">Aucun argent réel n'est débité. Page réservée au développement local.</p>
  </main>
  <script>
    async function decide(action, button) {
      const buttons = document.querySelectorAll('button');
      buttons.forEach((item) => { item.disabled = true; });
      const status = document.getElementById('status');
      status.textContent = 'Traitement…';
      try {
        const response = await fetch('${base}/api/dev/payments/${payId}/' + action, { method: 'POST' });
        const data = await response.json();
        if (!response.ok) throw new Error(data?.error?.message || 'Échec');
        status.textContent = action === 'approve'
          ? 'Paiement approuvé. Vous pouvez fermer cet onglet et revenir sur Numivo.'
          : 'Paiement refusé.';
        button.style.visibility = 'hidden';
      } catch (error) {
        status.style.color = '#f87171';
        status.textContent = error.message;
        buttons.forEach((item) => { item.disabled = false; });
      }
    }
  </script>
</body>
</html>`);
  } catch (error) {
    next(error);
  }
});

devRouter.post('/payments/:paymentId/approve', async (req, res, next) => {
  try {
    const client = mockClient();
    const payment = await prisma.payment.findUnique({ where: { id: req.params.paymentId } });
    if (!payment?.providerTransactionId) throw notFound('Paiement de test introuvable.');
    client.forceApprove(payment.providerTransactionId);
    const result = await processFedaPayTransaction(payment.providerTransactionId, 'dev');
    res.json({ ok: true, result });
  } catch (error) {
    next(error);
  }
});

devRouter.post('/payments/:paymentId/decline', async (req, res, next) => {
  try {
    const client = mockClient();
    const payment = await prisma.payment.findUnique({ where: { id: req.params.paymentId } });
    if (!payment?.providerTransactionId) throw notFound('Paiement de test introuvable.');
    client.markStatus(payment.providerTransactionId, 'declined');
    const result = await processFedaPayTransaction(payment.providerTransactionId, 'dev');
    res.json({ ok: true, result });
  } catch (error) {
    next(error);
  }
});

devRouter.post('/orders/:orderId/sms', async (req, res, next) => {
  try {
    const provider = getUltraSmsProvider();
    if (!(provider instanceof MockUltraSmsProvider)) {
      throw forbidden('Ces outils nécessitent ULTRASMS_MODE=mock.');
    }
    const order = await prisma.order.findUnique({ where: { id: req.params.orderId } });
    if (!order?.providerOrderId) throw notFound('Commande fournisseur introuvable.');
    provider.forceReceive(order.providerOrderId);
    await syncOrderFromProvider(order.id);
    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
});

devRouter.post('/orders/:orderId/sync', async (req, res, next) => {
  try {
    await syncOrderFromProvider(req.params.orderId);
    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
});
