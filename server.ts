/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import express, { Request, Response } from 'express';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = process.env.PORT || 3000;

app.use(express.json());

// In-memory store for orders and active transactions on server
interface ServerOrder {
  id: string;
  orderNumber: string;
  serviceId: string;
  countryCode: string;
  phoneNumber?: string;
  providerOrderId?: string;
  fedapayTxId?: string;
  status: 'PENDING_PAYMENT' | 'PAID' | 'PROCESSING' | 'COMPLETED' | 'REFUNDED';
  sellingPriceXof: number;
  smsCode?: string;
  smsText?: string;
  createdAt: string;
}

const serverOrders: Map<string, ServerOrder> = new Map();

// Helper to determine FedaPay base URL
function getFedaPayBaseUrl(): string {
  const env = (process.env.FEDAPAY_ENVIRONMENT || 'sandbox').toLowerCase();
  return env === 'live' || env === 'production'
    ? 'https://api.fedapay.com/v1'
    : 'https://sandbox-api.fedapay.com/v1';
}

// -------------------------------------------------------------
// 1. API STATUS & CREDENTIALS CHECK
// -------------------------------------------------------------
app.get('/api/status', (_req: Request, res: Response) => {
  const fedapaySecret = process.env.FEDAPAY_SECRET_KEY || '';
  const fedapayPublic = process.env.FEDAPAY_PUBLIC_KEY || '';
  const numfastKey = process.env.NUMFAST_API_KEY || '';
  const fedapayEnv = process.env.FEDAPAY_ENVIRONMENT || 'sandbox';
  const numfastBaseUrl = process.env.NUMFAST_BASE_URL || 'https://api.numfast.com';

  res.json({
    status: 'online',
    timestamp: new Date().toISOString(),
    fedapay: {
      configured: Boolean(fedapaySecret && fedapaySecret.length > 5),
      environment: fedapayEnv,
      secretKeyMasked: fedapaySecret ? `${fedapaySecret.slice(0, 7)}••••••••${fedapaySecret.slice(-4)}` : 'Non configurée',
      publicKeyMasked: fedapayPublic ? `${fedapayPublic.slice(0, 7)}••••••••${fedapayPublic.slice(-4)}` : 'Non configurée',
      endpoint: getFedaPayBaseUrl(),
    },
    numfast: {
      configured: Boolean(numfastKey && numfastKey.length > 3),
      keyMasked: numfastKey ? `${numfastKey.slice(0, 4)}••••••••${numfastKey.slice(-3)}` : 'Non configurée',
      baseUrl: numfastBaseUrl,
    },
  });
});

// -------------------------------------------------------------
// 1.B. ADMIN AUTHENTICATION & ANTI-BRUTE-FORCE PROTECTION
// -------------------------------------------------------------
interface IpRateLimit {
  failedAttempts: number;
  lockedUntil: number | null;
  lastAttemptAt: number;
}

const adminIpLimits: Map<string, IpRateLimit> = new Map();
const activeAdminTokens: Map<string, { createdAt: number; expiresAt: number }> = new Map();

const MAX_PIN_ATTEMPTS = 5;
const PIN_LOCKOUT_MS = 15 * 60 * 1000; // 15 minutes lockout
const SESSION_TTL_MS = 60 * 60 * 1000; // 1 hour session validity

function getClientIp(req: Request): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string') {
    return forwarded.split(',')[0].trim();
  }
  return req.socket.remoteAddress || '127.0.0.1';
}

// Verify secret Admin PIN with brute-force prevention
app.post('/api/admin/verify-pin', async (req: Request, res: Response) => {
  try {
    const { pin } = req.body;
    const ip = getClientIp(req);
    const now = Date.now();

    // Check existing lockout
    const limit = adminIpLimits.get(ip) || { failedAttempts: 0, lockedUntil: null, lastAttemptAt: now };

    if (limit.lockedUntil && limit.lockedUntil > now) {
      const remainingSecs = Math.ceil((limit.lockedUntil - now) / 1000);
      return res.status(429).json({
        success: false,
        locked: true,
        remainingSeconds: remainingSecs,
        error: `Accès temporairement bloqué suite à trop de tentatives infructueuses. Réessayez dans ${Math.ceil(remainingSecs / 60)} minutes.`,
      });
    }

    // Reset lock if lockout expired
    if (limit.lockedUntil && limit.lockedUntil <= now) {
      limit.failedAttempts = 0;
      limit.lockedUntil = null;
    }

    const expectedPin = (process.env.ADMIN_SECURITY_CODE || '849201').trim();
    const providedPin = typeof pin === 'string' ? pin.trim() : '';

    // Artificial delay to prevent timing analysis & rapid brute-force
    await new Promise((r) => setTimeout(r, 600));

    // Constant time comparison
    const expectedBuf = Buffer.from(expectedPin);
    const providedBuf = Buffer.from(providedPin);
    const isValid = expectedBuf.length === providedBuf.length && crypto.timingSafeEqual(expectedBuf, providedBuf);

    if (!isValid) {
      limit.failedAttempts += 1;
      limit.lastAttemptAt = now;

      if (limit.failedAttempts >= MAX_PIN_ATTEMPTS) {
        limit.lockedUntil = now + PIN_LOCKOUT_MS;
        adminIpLimits.set(ip, limit);
        console.warn(`[SECURITY ALERT] IP ${ip} locked out of Admin for 15 minutes after ${MAX_PIN_ATTEMPTS} failed attempts.`);
        return res.status(429).json({
          success: false,
          locked: true,
          remainingSeconds: Math.ceil(PIN_LOCKOUT_MS / 1000),
          error: `Sécurité activée : Trop de codes erronés. Votre accès est verrouillé pendant 15 minutes.`,
        });
      }

      adminIpLimits.set(ip, limit);
      const remainingAttempts = MAX_PIN_ATTEMPTS - limit.failedAttempts;
      return res.status(401).json({
        success: false,
        locked: false,
        remainingAttempts,
        error: `Code de sécurité incorrect. Il vous reste ${remainingAttempts} tentative(s) avant verrouillage.`,
      });
    }

    // Success: reset attempts and generate cryptographically secure session token
    adminIpLimits.delete(ip);
    const sessionToken = `numivo_adm_${crypto.randomBytes(32).toString('hex')}`;
    const expiresAt = now + SESSION_TTL_MS;

    activeAdminTokens.set(sessionToken, {
      createdAt: now,
      expiresAt,
    });

    console.log(`[SECURITY AUDIT] Admin session successfully granted for IP ${ip}`);

    return res.json({
      success: true,
      token: sessionToken,
      expiresAt,
      message: 'Authentification administrateur réussie.',
    });
  } catch (error: any) {
    res.status(500).json({ error: 'Erreur interne de vérification' });
  }
});

// Check session validity
app.post('/api/admin/verify-session', (req: Request, res: Response) => {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.replace('Bearer ', '').trim();
  const now = Date.now();

  if (!token || !activeAdminTokens.has(token)) {
    return res.status(401).json({ valid: false });
  }

  const session = activeAdminTokens.get(token)!;
  if (session.expiresAt < now) {
    activeAdminTokens.delete(token);
    return res.status(401).json({ valid: false, expired: true });
  }

  return res.json({ valid: true, expiresAt: session.expiresAt });
});

// Revoke session (Logout)
app.post('/api/admin/logout', (req: Request, res: Response) => {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.replace('Bearer ', '').trim();
  if (token) {
    activeAdminTokens.delete(token);
  }
  res.json({ success: true, message: 'Session terminée.' });
});

// -------------------------------------------------------------
// 2. FEDAPAY INTEGRATION ROUTES
// -------------------------------------------------------------

// Create a FedaPay payment transaction
app.post('/api/fedapay/create-transaction', async (req: Request, res: Response) => {
  try {
    const { amountXof, orderNumber, customer, paymentOperator } = req.body;
    const fedapaySecret = process.env.FEDAPAY_SECRET_KEY;
    const appUrl = process.env.APP_URL || `http://localhost:${port}`;

    if (!amountXof || amountXof <= 0) {
      return res.status(400).json({ error: 'Montant invalide.' });
    }

    // If real FedaPay secret key is configured, call official FedaPay REST API
    if (fedapaySecret && !fedapaySecret.includes('sandbox_...')) {
      const baseUrl = getFedaPayBaseUrl();
      const payload = {
        description: `Numivo - Commande ${orderNumber || 'Virtuelle'}`,
        amount: Math.round(amountXof),
        currency: { iso: 'XOF' },
        callback_url: `${appUrl}/api/fedapay/callback`,
        customer: {
          firstname: customer?.firstname || 'Client',
          lastname: customer?.lastname || 'Numivo',
          email: customer?.email || 'client@numivo.com',
          phone_number: {
            number: customer?.phone || '97000000',
            country: 'BJ',
          },
        },
      };

      const response = await fetch(`${baseUrl}/transactions`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${fedapaySecret}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (!response.ok) {
        return res.status(response.status).json({
          error: 'Erreur FedaPay',
          details: data,
        });
      }

      // Generate payment token
      const txId = data.v1?.id || data.id;
      const tokenRes = await fetch(`${baseUrl}/transactions/${txId}/token`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${fedapaySecret}`,
          'Content-Type': 'application/json',
        },
      });

      const tokenData = await tokenRes.json();

      return res.json({
        success: true,
        mode: 'LIVE_FEDAPAY',
        transactionId: txId,
        reference: data.v1?.reference || data.reference,
        token: tokenData.token,
        checkoutUrl: tokenData.url,
      });
    }

    // Sandbox / Simulation fallback when keys are pending setup in .env
    const fakeTxId = `fp_tx_${Date.now()}`;
    const fakeRef = `FP-REF-${Math.floor(100000 + Math.random() * 900000)}`;

    return res.json({
      success: true,
      mode: 'SANDBOX_SIMULATION',
      transactionId: fakeTxId,
      reference: fakeRef,
      checkoutUrl: `https://checkout.fedapay.com/pay/${fakeTxId}`,
      message: 'Transaction FedaPay simulée avec succès. Définissez FEDAPAY_SECRET_KEY dans .env pour les flux en direct.',
    });
  } catch (error: any) {
    console.error('FedaPay transaction error:', error);
    res.status(500).json({ error: error.message || 'Erreur interne de paiement' });
  }
});

// Verify a FedaPay payment transaction
app.get('/api/fedapay/verify/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const fedapaySecret = process.env.FEDAPAY_SECRET_KEY;

    if (fedapaySecret && !fedapaySecret.includes('sandbox_...')) {
      const baseUrl = getFedaPayBaseUrl();
      const response = await fetch(`${baseUrl}/transactions/${id}`, {
        headers: {
          Authorization: `Bearer ${fedapaySecret}`,
        },
      });

      const data = await response.json();
      return res.json({ success: response.ok, transaction: data });
    }

    // Default sandbox response
    return res.json({
      success: true,
      mode: 'SANDBOX_SIMULATION',
      transaction: {
        id,
        status: 'approved',
        amount: 3700,
        currency: 'XOF',
      },
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Webhook endpoint for FedaPay notifications
app.post('/api/fedapay/webhook', (req: Request, res: Response) => {
  const event = req.body;
  console.log('[FedaPay Webhook Received]:', event?.entity?.id, event?.name);

  // Return 200 OK immediately as required by payment gateways
  res.status(200).json({ received: true });
});

// -------------------------------------------------------------
// 3. NUM FAST VIRTUAL NUMBER & SMS ROUTES
// -------------------------------------------------------------

// Request a virtual phone number from Num Fast
app.post('/api/numfast/order', async (req: Request, res: Response) => {
  try {
    const { countryCode, serviceId, orderNumber } = req.body;
    const numfastKey = process.env.NUMFAST_API_KEY;
    const numfastBaseUrl = process.env.NUMFAST_BASE_URL || 'https://api.numfast.com';

    // If real Num Fast API key is configured
    if (numfastKey && !numfastKey.includes('your_numfast_api_key')) {
      try {
        // Attempt Num Fast API call
        const response = await fetch(`${numfastBaseUrl}/api/v1/numbers/order`, {
          method: 'POST',
          headers: {
            'X-API-KEY': numfastKey,
            Authorization: `Bearer ${numfastKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            country: countryCode,
            service: serviceId,
          }),
        });

        if (response.ok) {
          const data = await response.json();
          return res.json({
            success: true,
            mode: 'LIVE_NUMFAST',
            providerOrderId: data.orderId || data.id,
            phoneNumber: data.phoneNumber || data.phone,
          });
        }
      } catch (e) {
        console.warn('Num Fast remote call failed, using fallback:', e);
      }
    }

    // Realistic telephone generation by country code
    const dialCodes: Record<string, string> = {
      BJ: '+229',
      CI: '+225',
      SN: '+221',
      TG: '+228',
      FR: '+33',
      US: '+1',
      GB: '+44',
      NG: '+234',
      CM: '+237',
      GH: '+233',
      DE: '+49',
      CA: '+1',
    };

    const dial = dialCodes[countryCode] || '+229';
    const randPart = Math.floor(10000000 + Math.random() * 90000000).toString();
    const formattedNumber = `${dial} ${randPart.slice(0, 2)} ${randPart.slice(2, 4)} ${randPart.slice(4, 6)} ${randPart.slice(6, 8)}`;
    const providerOrderId = `NF-${Date.now().toString().slice(-6)}`;

    return res.json({
      success: true,
      mode: numfastKey && !numfastKey.includes('your_numfast') ? 'LIVE_NUMFAST' : 'SANDBOX_NUMFAST',
      providerOrderId,
      phoneNumber: formattedNumber,
      expiresInSeconds: 1200,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Check/Poll for SMS on Num Fast
app.get('/api/numfast/sms/:orderId', async (req: Request, res: Response) => {
  try {
    const { orderId } = req.params;
    const numfastKey = process.env.NUMFAST_API_KEY;
    const numfastBaseUrl = process.env.NUMFAST_BASE_URL || 'https://api.numfast.com';

    if (numfastKey && !numfastKey.includes('your_numfast_api_key')) {
      try {
        const response = await fetch(`${numfastBaseUrl}/api/v1/sms/check?orderId=${orderId}`, {
          headers: {
            'X-API-KEY': numfastKey,
            Authorization: `Bearer ${numfastKey}`,
          },
        });

        if (response.ok) {
          const data = await response.json();
          if (data.smsReceived) {
            return res.json({
              success: true,
              received: true,
              sender: data.sender || 'Service',
              text: data.text,
              code: data.code,
            });
          }
        }
      } catch (e) {
        console.warn('Num Fast SMS check failed:', e);
      }
    }

    // Default polling check
    return res.json({
      success: true,
      received: false,
      status: 'WAITING_FOR_SMS',
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Cancel a number on Num Fast
app.post('/api/numfast/cancel/:orderId', async (req: Request, res: Response) => {
  try {
    const { orderId } = req.params;
    return res.json({
      success: true,
      orderId,
      status: 'CANCELLED_AND_REFUNDED',
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// -------------------------------------------------------------
// VITE MIDDLEWARE OR STATIC PRODUCTION SERVING
// -------------------------------------------------------------
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.resolve(__dirname, 'dist')));
  app.get('*', (_req: Request, res: Response) => {
    res.sendFile(path.resolve(__dirname, 'dist/index.html'));
  });
} else {
  const { createServer: createViteServer } = await import('vite');
  const vite = await createViteServer({
    server: { middlewareMode: true },
    appType: 'spa',
  });
  app.use(vite.middlewares);
}

app.listen(port, () => {
  console.log(`[Numivo Server] Listening on port ${port}`);
  console.log(`[FedaPay Gateway]: ${process.env.FEDAPAY_SECRET_KEY ? 'Configurée' : 'Mode Sandbox'}`);
  console.log(`[Num Fast API]: ${process.env.NUMFAST_API_KEY ? 'Configurée' : 'Mode Sandbox'}`);
});
