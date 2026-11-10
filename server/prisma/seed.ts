import 'dotenv/config';
import argon2 from 'argon2';
import { PrismaClient, ServiceCategory, Currency } from '@prisma/client';
import { Decimal } from 'decimal.js';

const prisma = new PrismaClient();

const COUNTRIES = [
  { code: 'BJ', name: 'Bénin', flag: '🇧🇯', prefix: '+229', popular: true },
  { code: 'CI', name: "Côte d'Ivoire", flag: '🇨🇮', prefix: '+225', popular: true },
  { code: 'SN', name: 'Sénégal', flag: '🇸🇳', prefix: '+221', popular: true },
  { code: 'TG', name: 'Togo', flag: '🇹🇬', prefix: '+228', popular: true },
  { code: 'FR', name: 'France', flag: '🇫🇷', prefix: '+33', popular: true },
  { code: 'US', name: 'États-Unis', flag: '🇺🇸', prefix: '+1', popular: true },
  { code: 'GB', name: 'Royaume-Uni', flag: '🇬🇧', prefix: '+44', popular: true },
  { code: 'NG', name: 'Nigéria', flag: '🇳🇬', prefix: '+234' },
  { code: 'CM', name: 'Cameroun', flag: '🇨🇲', prefix: '+237' },
  { code: 'CA', name: 'Canada', flag: '🇨🇦', prefix: '+1' },
  { code: 'DE', name: 'Allemagne', flag: '🇩🇪', prefix: '+49' },
  { code: 'NL', name: 'Pays-Bas', flag: '🇳🇱', prefix: '+31' },
];

const SERVICES: Array<{
  id: string;
  name: string;
  iconName: string;
  category: ServiceCategory;
  popular?: boolean;
  providerCode: string;
}> = [
  { id: 'whatsapp', name: 'WhatsApp', iconName: 'MessageCircle', category: 'messaging', popular: true, providerCode: 'wa' },
  { id: 'telegram', name: 'Telegram', iconName: 'Send', category: 'messaging', popular: true, providerCode: 'tg' },
  { id: 'openai', name: 'OpenAI (ChatGPT)', iconName: 'Bot', category: 'ai', popular: true, providerCode: 'openai' },
  { id: 'google', name: 'Google (Gmail)', iconName: 'Mail', category: 'tech', popular: true, providerCode: 'go' },
  { id: 'tiktok', name: 'TikTok', iconName: 'Video', category: 'social', popular: true, providerCode: 'tk' },
  { id: 'instagram', name: 'Instagram', iconName: 'Camera', category: 'social', popular: true, providerCode: 'ig' },
  { id: 'microsoft', name: 'Microsoft (Outlook)', iconName: 'AppWindow', category: 'tech', providerCode: 'ms' },
  { id: 'tinder', name: 'Tinder', iconName: 'Flame', category: 'social', providerCode: 'tinder' },
  { id: 'uber', name: 'Uber & Bolt', iconName: 'Car', category: 'tech', providerCode: 'uber' },
  { id: 'netflix', name: 'Netflix', iconName: 'Tv', category: 'tech', providerCode: 'netflix' },
  { id: 'binance', name: 'Binance', iconName: 'Coins', category: 'fintech', providerCode: 'binance' },
  { id: 'paypal', name: 'PayPal', iconName: 'CreditCard', category: 'fintech', providerCode: 'paypal' },
];

// Catalogue de repli (coûts fournisseur indicatifs en XOF).
// Il est remplacé par les tarifs réels lors de la synchronisation Ultra SMS.
const FALLBACK_CATALOG: Array<{ country: string; service: string; costXof: number; count: number }> = [
  { country: 'BJ', service: 'whatsapp', costXof: 1200, count: 42 },
  { country: 'CI', service: 'whatsapp', costXof: 1100, count: 88 },
  { country: 'SN', service: 'whatsapp', costXof: 1150, count: 54 },
  { country: 'TG', service: 'whatsapp', costXof: 950, count: 23 },
  { country: 'FR', service: 'whatsapp', costXof: 1500, count: 310 },
  { country: 'US', service: 'whatsapp', costXof: 900, count: 1200 },
  { country: 'GB', service: 'whatsapp', costXof: 1400, count: 450 },
  { country: 'NG', service: 'whatsapp', costXof: 800, count: 160 },
  { country: 'BJ', service: 'telegram', costXof: 1100, count: 65 },
  { country: 'CI', service: 'telegram', costXof: 1050, count: 112 },
  { country: 'FR', service: 'telegram', costXof: 1350, count: 420 },
  { country: 'US', service: 'telegram', costXof: 850, count: 980 },
  { country: 'GB', service: 'telegram', costXof: 1300, count: 390 },
  { country: 'US', service: 'openai', costXof: 1100, count: 840 },
  { country: 'FR', service: 'openai', costXof: 1600, count: 195 },
  { country: 'GB', service: 'openai', costXof: 1550, count: 220 },
  { country: 'DE', service: 'openai', costXof: 1650, count: 140 },
  { country: 'BJ', service: 'google', costXof: 1300, count: 35 },
  { country: 'CI', service: 'google', costXof: 1250, count: 75 },
  { country: 'FR', service: 'google', costXof: 1450, count: 380 },
  { country: 'US', service: 'google', costXof: 950, count: 1450 },
  { country: 'BJ', service: 'tiktok', costXof: 1000, count: 50 },
  { country: 'CI', service: 'tiktok', costXof: 950, count: 90 },
  { country: 'FR', service: 'tiktok', costXof: 1200, count: 270 },
  { country: 'US', service: 'tiktok', costXof: 850, count: 650 },
  { country: 'FR', service: 'instagram', costXof: 1150, count: 340 },
  { country: 'US', service: 'instagram', costXof: 800, count: 890 },
  { country: 'FR', service: 'binance', costXof: 1800, count: 85 },
  { country: 'US', service: 'paypal', costXof: 1750, count: 110 },
];

function numberFromEnv(name: string, fallback: number): number {
  const parsed = Number(process.env[name]);
  return Number.isFinite(parsed) ? parsed : fallback;
}

async function seedAdmin(): Promise<void> {
  const email = (process.env.ADMIN_EMAIL ?? '').trim().toLowerCase();
  const password = (process.env.ADMIN_PASSWORD ?? '').trim();
  if (!email || !password || password.includes('REMPLACER')) {
    console.log('ℹ️  Compte admin non créé : ADMIN_EMAIL / ADMIN_PASSWORD absents.');
    return;
  }
  if (password.length < 12 && process.env.NODE_ENV === 'production') {
    throw new Error("ADMIN_PASSWORD doit contenir au moins 12 caractères en production.");
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    await prisma.user.update({
      where: { id: existing.id },
      data: { role: 'ADMIN', status: 'ACTIVE' },
    });
    console.log(`✅ Admin existant : ${email}`);
    return;
  }

  const passwordHash = await argon2.hash(password, { type: argon2.argon2id });
  const admin = await prisma.user.create({
    data: {
      email,
      passwordHash,
      name: process.env.ADMIN_NAME ?? 'Administrateur Numivo',
      role: 'ADMIN',
      country: process.env.ADMIN_COUNTRY ?? 'Bénin',
    },
  });
  for (const currency of ['XOF', 'EUR', 'USD'] as Currency[]) {
    await prisma.wallet.create({ data: { userId: admin.id, currency, balanceMinor: 0n } });
  }
  console.log(`✅ Admin créé : ${email}`);
}

async function seedDemoClient(): Promise<void> {
  if (process.env.NODE_ENV === 'production') return;
  const email = 'client@numivo.local';
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) return;
  const passwordHash = await argon2.hash('demo123456', { type: argon2.argon2id });
  const user = await prisma.user.create({
    data: {
      email,
      passwordHash,
      name: 'Client Démo',
      role: 'CLIENT',
      country: 'Bénin',
      preferredCurrency: 'XOF',
    },
  });
  for (const currency of ['XOF', 'EUR', 'USD'] as Currency[]) {
    await prisma.wallet.create({ data: { userId: user.id, currency, balanceMinor: 0n } });
  }
  console.log('✅ Client de démonstration créé : client@numivo.local / demo123456');
}

async function main(): Promise<void> {
  for (const country of COUNTRIES) {
    await prisma.country.upsert({
      where: { code: country.code },
      create: { ...country, enabled: true },
      update: {
        name: country.name,
        flag: country.flag,
        prefix: country.prefix,
        popular: country.popular ?? false,
      },
    });
  }
  console.log(`✅ ${COUNTRIES.length} pays`);

  for (const service of SERVICES) {
    await prisma.service.upsert({
      where: { id: service.id },
      create: { ...service, enabled: true },
      update: {
        name: service.name,
        iconName: service.iconName,
        category: service.category,
        popular: service.popular ?? false,
        providerCode: service.providerCode,
      },
    });
  }
  console.log(`✅ ${SERVICES.length} services`);

  const usdXof = new Decimal(numberFromEnv('USD_XOF_RATE', 615));
  const fallbackEnabled = process.env.NODE_ENV !== 'production';
  for (const item of FALLBACK_CATALOG) {
    const cost = BigInt(Math.round(item.costXof));
    const usdCents = BigInt(
      new Decimal(item.costXof).div(usdXof).mul(100).round().toFixed(0),
    );
    await prisma.catalogItem.upsert({
      where: {
        countryCode_serviceId_type: {
          countryCode: item.country,
          serviceId: item.service,
          type: 'TEMPORARY',
        },
      },
      create: {
        countryCode: item.country,
        serviceId: item.service,
        type: 'TEMPORARY',
        supplierCostXofMinor: cost,
        supplierPriceMinor: usdCents,
        supplierCurrency: 'USD',
        providerProductId: `${item.service}:${item.country}`,
        availableCount: fallbackEnabled ? item.count : 0,
        enabled: fallbackEnabled,
      },
      update: {},
    });
  }
  console.log(
    fallbackEnabled
      ? `✅ ${FALLBACK_CATALOG.length} entrées de catalogue de repli`
      : `✅ ${FALLBACK_CATALOG.length} entrées de repli créées désactivées (production)`,
  );

  await prisma.pricingConfig.upsert({
    where: { id: 'default' },
    create: {
      id: 'default',
      targetMarginXof: Math.round(numberFromEnv('TARGET_MARGIN_XOF', 2000)),
      paymentRateMobileMoney: String(numberFromEnv('PAYMENT_RATE_MOBILE_MONEY', 0.018)),
      paymentRateCard: String(numberFromEnv('PAYMENT_RATE_CARD', 0.036)),
      paymentRateWallet: String(numberFromEnv('PAYMENT_RATE_WALLET', 0)),
      fixedPaymentFeeXof: 0,
      fxFeeRate: '0',
      roundingStepXof: Math.round(numberFromEnv('ROUNDING_STEP_XOF', 100)),
    },
    update: {},
  });
  console.log('✅ Configuration de tarification');

  for (const [base, rate] of [
    ['EUR', numberFromEnv('EUR_XOF_RATE', 655.957)],
    ['USD', numberFromEnv('USD_XOF_RATE', 615)],
  ] as const) {
    const existing = await prisma.exchangeRate.findFirst({
      where: { baseCurrency: base, quoteCurrency: 'XOF' },
    });
    if (!existing) {
      await prisma.exchangeRate.create({
        data: {
          baseCurrency: base,
          quoteCurrency: 'XOF',
          rate: String(rate),
          source: 'seed',
          validAt: new Date(),
        },
      });
    }
  }
  console.log('✅ Taux de change');

  await prisma.provider.upsert({
    where: { name: 'ultrasms' },
    create: {
      name: 'ultrasms',
      type: 'SMS_NUMBER',
      status: 'ACTIVE',
      config: { mode: process.env.ULTRASMS_MODE ?? 'mock' },
    },
    update: { status: 'ACTIVE', config: { mode: process.env.ULTRASMS_MODE ?? 'mock' } },
  });

  // En mode simulation, on aligne le catalogue sur les tarifs exacts du
  // fournisseur simulé. Sans cela, le prix de repli peut être inférieur au
  // prix réel et chaque achat serait remboursé pour cause de « prix changé ».
  if ((process.env.ULTRASMS_MODE ?? 'mock') === 'mock') {
    const { syncCatalogFromProvider } = await import('../src/services/catalog.js');
    const synced = await syncCatalogFromProvider(null);
    console.log(
      `✅ Catalogue synchronisé sur le fournisseur simulé (${synced.upserted} offres)`,
    );
  }

  await seedAdmin();
  await seedDemoClient();

  console.log('🌱 Seed terminé.');
}

main()
  .catch((error) => {
    console.error('❌ Seed en échec :', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
