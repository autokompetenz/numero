import { Currency, NumberType, PaymentMethod, Prisma, ServiceCategory } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { prisma } from '../db/prisma.js';
import { logger } from '../config/logger.js';
import { notFound } from '../lib/errors.js';
import { Decimal, convertCurrencyMinorToXofMinor } from '../lib/money.js';
import { getExchangeRates, rateForCurrency } from './exchangeRates.js';
import { getPricingConfig, calculatePrice, PriceBreakdown } from './pricing.js';
import { getUltraSmsProvider } from '../providers/ultrasms/index.js';

export interface CatalogQuery {
  currency: Currency;
  paymentMethod: PaymentMethod;
  countryCode?: string;
  serviceId?: string;
  type?: NumberType;
  category?: ServiceCategory;
  search?: string;
  page?: number;
  limit?: number;
}

const DEFAULT_PAGE_SIZE = 24;
const MAX_PAGE_SIZE = 60;

export async function listEnabledCountries() {
  const countries = await prisma.country.findMany({
    where: { enabled: true },
    orderBy: [{ popular: 'desc' }, { name: 'asc' }],
  });
  return countries.map((country) => ({
    code: country.code,
    name: country.name,
    flag: country.flag,
    prefix: country.prefix,
    popular: country.popular,
  }));
}

export interface CatalogEntryDto {
  id: string;
  countryCode: string;
  serviceId: string;
  type: NumberType;
  availableCount: number;
  enabled: boolean;
  supplierCostXof: number;
  sellingPriceXof: number;
  sellingPriceMinor: number;
  sellingPriceFormatted: string;
  currency: Currency;
  paymentMethod: PaymentMethod;
  paymentFeeXof: number;
  estimatedNetMarginXof: number;
}

function formatPrice(minor: number, currency: Currency, decimals: number): string {
  return new Decimal(minor)
    .div(new Decimal(10).pow(decimals))
    .toFixed(decimals);
}

export async function listCatalog(query: CatalogQuery) {
  const page = Math.max(1, Math.trunc(query.page ?? 1));
  const limit = Math.min(
    MAX_PAGE_SIZE,
    Math.max(1, Math.trunc(query.limit ?? DEFAULT_PAGE_SIZE)),
  );
  const countryCode = query.countryCode?.trim().toUpperCase() || undefined;
  const search = query.search?.trim() || undefined;

  const baseWhere: Prisma.CatalogItemWhereInput = {
    enabled: true,
    availableCount: { gt: 0 },
    country: { enabled: true },
    service: { enabled: true },
    ...(query.type ? { type: query.type } : {}),
    ...(countryCode ? { countryCode } : {}),
    ...(query.serviceId ? { serviceId: query.serviceId } : {}),
  };

  const filters: Prisma.CatalogItemWhereInput[] = [];
  if (query.category) {
    filters.push({ service: { category: query.category } });
  }
  if (search) {
    filters.push({
      OR: [
        { service: { name: { contains: search, mode: 'insensitive' } } },
        { country: { name: { contains: search, mode: 'insensitive' } } },
        { country: { prefix: { contains: search } } },
        { countryCode: { equals: search.toUpperCase() } },
      ],
    });
  }
  const where: Prisma.CatalogItemWhereInput = filters.length
    ? { AND: [baseWhere, ...filters] }
    : baseWhere;

  const optionWhere: Prisma.CatalogItemWhereInput = {
    enabled: true,
    availableCount: { gt: 0 },
    country: { enabled: true },
    service: { enabled: true },
    ...(query.type ? { type: query.type } : {}),
  };

  const [items, total, allServiceGroups, serviceOptionGroups, config, rates] =
    await Promise.all([
      prisma.catalogItem.findMany({
        where,
        orderBy: [{ countryCode: 'asc' }, { service: { name: 'asc' } }],
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.catalogItem.count({ where }),
      prisma.catalogItem.groupBy({
        by: ['serviceId'],
        where: optionWhere,
      }),
      prisma.catalogItem.groupBy({
        by: ['serviceId'],
        where: {
          ...optionWhere,
          ...(countryCode ? { countryCode } : {}),
        },
      }),
      getPricingConfig(),
      getExchangeRates(),
    ]);

  const [countries, services, serviceOptions] = await Promise.all([
    listEnabledCountries(),
    prisma.service.findMany({
      where: {
        enabled: true,
        id: { in: [...new Set(items.map((item) => item.serviceId))] },
      },
      orderBy: { name: 'asc' },
    }),
    prisma.service.findMany({
      where: {
        enabled: true,
        id: { in: serviceOptionGroups.map((group) => group.serviceId) },
      },
      orderBy: { name: 'asc' },
    }),
  ]);

  const entries: CatalogEntryDto[] = [];
  for (const item of items) {
    let breakdown: PriceBreakdown;
    try {
      breakdown = calculatePrice({
        supplierCostXofMinor: item.supplierCostXofMinor,
        paymentMethod: query.paymentMethod,
        currency: query.currency,
        config,
        rates,
      });
    } catch (error) {
      logger.debug(
        { err: error, itemId: item.id },
        'Article ignoré : marge minimale non atteignable',
      );
      continue;
    }
    const decimals = query.currency === 'XOF' ? 0 : 2;
    entries.push({
      id: item.id,
      countryCode: item.countryCode,
      serviceId: item.serviceId,
      type: item.type,
      availableCount: item.availableCount,
      enabled: item.enabled,
      supplierCostXof: Number(item.supplierCostXofMinor),
      sellingPriceXof: Number(breakdown.sellingPriceXofMinor),
      sellingPriceMinor: Number(breakdown.sellingPriceCurrencyMinor),
      sellingPriceFormatted: formatPrice(
        Number(breakdown.sellingPriceCurrencyMinor),
        query.currency,
        decimals,
      ),
      currency: query.currency,
      paymentMethod: query.paymentMethod,
      paymentFeeXof: Number(breakdown.paymentFeeMinor),
      estimatedNetMarginXof: Number(breakdown.estimatedNetMarginXof),
    });
  }

  return {
    countries,
    services: services.map((service) => ({
      id: service.id,
      name: service.name,
      iconName: service.iconName,
      category: service.category,
      popular: service.popular,
      providerCode: service.providerCode,
    })),
    serviceOptions: serviceOptions.map((service) => ({
      id: service.id,
      name: service.name,
      iconName: service.iconName,
      category: service.category,
      popular: service.popular,
      providerCode: service.providerCode,
    })),
    serviceTotal: allServiceGroups.length,
    items: entries,
    page,
    limit,
    total,
    hasMore: page * limit < total,
    currency: query.currency,
    paymentMethod: query.paymentMethod,
  };
}

export async function getCatalogItemOrThrow(itemId: string) {
  const item = await prisma.catalogItem.findUnique({
    where: { id: itemId },
    include: { country: true, service: true },
  });
  if (!item || !item.enabled) {
    throw notFound("Ce numéro n'est plus disponible.");
  }
  return item;
}

export async function quoteItem(params: {
  itemId: string;
  paymentMethod: PaymentMethod;
  currency: Currency;
}) {
  const item = await getCatalogItemOrThrow(params.itemId);
  const [config, rates] = await Promise.all([getPricingConfig(), getExchangeRates()]);
  const breakdown = calculatePrice({
    supplierCostXofMinor: item.supplierCostXofMinor,
    paymentMethod: params.paymentMethod,
    currency: params.currency,
    config,
    rates,
  });

  return {
    item: { id: item.id, countryCode: item.countryCode, serviceId: item.serviceId, type: item.type },
    price: serializeBreakdown(breakdown),
  };
}

export function serializeBreakdown(breakdown: PriceBreakdown) {
  return {
    supplierCostXof: Number(breakdown.supplierCostXofMinor),
    targetMarginXof: breakdown.targetMarginXof,
    paymentFeeXof: Number(breakdown.paymentFeeMinor),
    fxFeeXof: Number(breakdown.fxFeeXofMinor),
    rawPriceXof: Number(breakdown.rawPriceXof.toFixed(0)),
    sellingPriceXof: Number(breakdown.sellingPriceXofMinor),
    estimatedNetMarginXof: Number(breakdown.estimatedNetMarginXof),
    currency: breakdown.currency,
    sellingPriceMinor: Number(breakdown.sellingPriceCurrencyMinor),
    sellingPriceInCurrency: Number(
      new Decimal(breakdown.sellingPriceCurrencyMinor.toString())
        .div(new Decimal(10).pow(breakdown.currency === 'XOF' ? 0 : 2))
        .toFixed(breakdown.currency === 'XOF' ? 0 : 2),
    ),
    sellingPriceFormatted: new Decimal(breakdown.sellingPriceCurrencyMinor.toString())
      .div(new Decimal(10).pow(breakdown.currency === 'XOF' ? 0 : 2))
      .toFixed(breakdown.currency === 'XOF' ? 0 : 2),
    rateApplied: Number(breakdown.rateApplied.toFixed(8)),
    paymentRate: Number(breakdown.paymentRate.toFixed(6)),
  };
}

const CATALOG_TYPE: NumberType = 'TEMPORARY';

const SYNC_CONCURRENCY = 6;
const UPSERT_CHUNK_SIZE = 400;

/** Exécute une tâche asynchrone sur une liste avec une concurrence bornée. */
async function mapWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  task: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let cursor = 0;
  const workers = Array.from(
    { length: Math.min(Math.max(1, concurrency), items.length) },
    async () => {
      while (cursor < items.length) {
        const index = cursor;
        cursor += 1;
        results[index] = await task(items[index]!, index);
      }
    },
  );
  await Promise.all(workers);
  return results;
}

interface CatalogUpsertRow {
  id: string;
  countryCode: string;
  serviceId: string;
  supplierCostXofMinor: bigint;
  supplierPriceMinor: bigint;
  availableCount: number;
  providerProductId: string;
}

/**
 * Écrit les offres par paquets via un upsert SQL unique. Les contraintes
 * d'unicité (pays, service, type) évitent les doublons et les allers-retours
 * un par un, indispensables avec plusieurs dizaines de milliers d'offres.
 */
async function bulkUpsertCatalog(rows: CatalogUpsertRow[], syncedAt: Date): Promise<number> {
  let written = 0;

  for (let offset = 0; offset < rows.length; offset += UPSERT_CHUNK_SIZE) {
    const chunk = rows.slice(offset, offset + UPSERT_CHUNK_SIZE);
    const values = chunk.map(
      (row) => Prisma.sql`(
        ${row.id},
        ${row.countryCode},
        ${row.serviceId},
        ${CATALOG_TYPE}::"NumberType",
        ${row.supplierCostXofMinor},
        ${row.supplierPriceMinor},
        ${'USD'},
        ${row.providerProductId},
        ${row.availableCount},
        ${true},
        ${syncedAt},
        ${syncedAt},
        ${syncedAt}
      )`,
    );

    await prisma.$executeRaw(
      Prisma.sql`
        INSERT INTO "CatalogItem" (
          "id",
          "countryCode",
          "serviceId",
          "type",
          "supplierCostXofMinor",
          "supplierPriceMinor",
          "supplierCurrency",
          "providerProductId",
          "availableCount",
          "enabled",
          "lastSyncedAt",
          "createdAt",
          "updatedAt"
        ) VALUES ${Prisma.join(values)}
        ON CONFLICT ("countryCode", "serviceId", "type") DO UPDATE SET
          "supplierCostXofMinor" = EXCLUDED."supplierCostXofMinor",
          "supplierPriceMinor" = EXCLUDED."supplierPriceMinor",
          "supplierCurrency" = EXCLUDED."supplierCurrency",
          "providerProductId" = EXCLUDED."providerProductId",
          "availableCount" = EXCLUDED."availableCount",
          "lastSyncedAt" = EXCLUDED."lastSyncedAt",
          "updatedAt" = EXCLUDED."updatedAt"
      `,
    );
    written += chunk.length;
  }

  return written;
}

/**
 * Synchronise le catalogue depuis Ultra SMS, pays par pays.
 *
 * L'API fournisseur ne renvoie que le Brésil quand aucun pays n'est demandé :
 * il faut donc interroger chaque pays séparément. Les pays en échec sont
 * ignorés et conservent leurs offres précédentes.
 */
export async function syncCatalogFromProvider(actorId?: string | null) {
  const provider = getUltraSmsProvider();
  const runStartedAt = new Date();
  const [providerCountries, providerServices, rates] = await Promise.all([
    provider.getCountries(),
    provider.getServices(),
    getExchangeRates(true),
  ]);

  // Pays
  const uniqueCountries = new Map<string, { code: string; name: string; dialCode: string }>();
  for (const country of providerCountries) {
    const code = country.code.toUpperCase();
    if (!code) continue;
    uniqueCountries.set(code, {
      code,
      name: country.name,
      dialCode: country.dialCode,
    });
  }

  for (const country of uniqueCountries.values()) {
    const prefix = country.dialCode ? `+${country.dialCode.replace(/^\+/, '')}` : '';
    await prisma.country.upsert({
      where: { code: country.code },
      create: {
        code: country.code,
        name: country.name,
        prefix,
        flag: '🌐',
        enabled: true,
      },
      update: { name: country.name, ...(prefix ? { prefix } : {}) },
    });
  }

  // Services : rattachement par code fournisseur, puis par nom.
  const existingServices = await prisma.service.findMany();
  const serviceIdByCode = new Map<string, string>();
  for (const service of existingServices) {
    if (service.providerCode) serviceIdByCode.set(service.providerCode, service.id);
  }

  for (const service of providerServices) {
    const code = service.code.toLowerCase();
    const existing = existingServices.find(
      (item) =>
        item.providerCode === code ||
        item.name.toLowerCase() === service.name.toLowerCase(),
    );
    if (existing) {
      serviceIdByCode.set(code, existing.id);
      if (!existing.providerCode) {
        await prisma.service.update({
          where: { id: existing.id },
          data: { providerCode: code },
        });
      }
      continue;
    }
    const id = `svc_${code}`;
    await prisma.service.upsert({
      where: { id },
      create: {
        id,
        name: service.name,
        iconName: 'MessageCircle',
        category: 'tech',
        providerCode: code,
        enabled: true,
      },
      update: { providerCode: code, name: service.name },
    });
    serviceIdByCode.set(code, id);
  }

  // Prix : une requête par pays, avec une concurrence bornée pour ne pas
  // saturer le fournisseur.
  const countryResults = await mapWithConcurrency(
    [...uniqueCountries.keys()],
    SYNC_CONCURRENCY,
    async (countryCode) => {
      for (let attempt = 0; attempt < 2; attempt += 1) {
        try {
          const prices = await provider.getPrices({ country: countryCode });
          return { countryCode, prices, ok: true as const };
        } catch (error) {
          const status =
            error instanceof Error && 'statusCode' in error
              ? Number((error as { statusCode?: number }).statusCode)
              : undefined;
          const retryable = status === undefined || status === 429 || status >= 500;
          if (!retryable || attempt === 1) {
            logger.warn(
              { err: error, countryCode },
              'Ultra SMS : prix indisponibles pour ce pays, offres précédentes conservées',
            );
            return { countryCode, prices: [], ok: false as const };
          }
          await new Promise((resolve) => setTimeout(resolve, 350));
        }
      }
      return { countryCode, prices: [], ok: false as const };
    },
  );

  const successfulCountries = countryResults.filter(
    (result) => result.ok && result.prices.length > 0,
  );
  const failedCountries = countryResults
    .filter((result) => !result.ok)
    .map((result) => result.countryCode);

  // Meilleur tarif par couple service/pays, tous serveurs confondus.
  const best = new Map<
    string,
    {
      priceCents: number;
      count: number;
      serviceCode: string;
      countryCode: string;
    }
  >();

  for (const result of successfulCountries) {
    for (const price of result.prices) {
      const serviceCode = price.service.toLowerCase();
      const countryCode = price.country.toUpperCase() || result.countryCode;
      if (!serviceCode || !countryCode || !serviceIdByCode.has(serviceCode)) continue;
      if (!Number.isFinite(price.priceCents) || price.priceCents <= 0) continue;

      const key = `${countryCode}:${serviceCode}`;
      const current = best.get(key);
      if (!current || price.priceCents < current.priceCents) {
        best.set(key, {
          priceCents: price.priceCents,
          count: Math.max(price.count, 1),
          serviceCode,
          countryCode,
        });
      } else {
        current.count = Math.max(current.count, price.count);
      }
    }
  }

  const usdRate = rateForCurrency(rates, 'USD');
  const syncedAt = new Date();
  const rowsByKey = new Map<string, CatalogUpsertRow>();

  for (const entry of best.values()) {
    const serviceId = serviceIdByCode.get(entry.serviceCode);
    if (!serviceId) continue;

    const supplierCostXofMinor = convertCurrencyMinorToXofMinor(
      BigInt(entry.priceCents),
      'USD',
      usdRate,
    );
    // Deux codes fournisseur peuvent pointer vers le même service interne :
    // on ne garde qu'une ligne par contrainte d'unicité (pays, service, type),
    // avec le coût fournisseur le plus bas.
    const key = `${entry.countryCode}:${serviceId}:${CATALOG_TYPE}`;
    const existing = rowsByKey.get(key);
    if (existing && existing.supplierCostXofMinor <= supplierCostXofMinor) continue;

    rowsByKey.set(key, {
      id: existing?.id ?? randomUUID(),
      countryCode: entry.countryCode,
      serviceId,
      supplierCostXofMinor,
      supplierPriceMinor: BigInt(entry.priceCents),
      availableCount: entry.count,
      providerProductId: `${entry.serviceCode}:${entry.countryCode}`,
    });
  }

  const rows = [...rowsByKey.values()];
  const upserted = await bulkUpsertCatalog(rows, syncedAt);
  const syncedCountryCodes = [...new Set(successfulCountries.map((result) => result.countryCode))];

  // Les offres absentes de cette synchronisation sont vidées, uniquement pour
  // les pays interrogés avec succès : un échec ponctuel ne doit pas casser le
  // catalogue existant.
  if (syncedCountryCodes.length > 0) {
    await prisma.catalogItem.updateMany({
      where: {
        type: CATALOG_TYPE,
        countryCode: { in: syncedCountryCodes },
        OR: [{ lastSyncedAt: null }, { lastSyncedAt: { lt: runStartedAt } }],
      },
      data: { availableCount: 0 },
    });
  }

  await prisma.provider.upsert({
    where: { name: 'ultrasms' },
    create: {
      name: 'ultrasms',
      type: 'SMS_NUMBER',
      status: 'ACTIVE',
      config: { mode: provider.mode },
    },
    update: { status: 'ACTIVE', config: { mode: provider.mode } },
  });

  await prisma.auditLog.create({
    data: {
      actorId: actorId ?? null,
      action: 'catalog.sync',
      entityType: 'CatalogItem',
      entityId: 'all',
      metadata: {
        upserted,
        countries: uniqueCountries.size,
        syncedCountries: syncedCountryCodes.length,
        failedCountries,
        mode: provider.mode,
      },
    },
  });

  return {
    upserted,
    countries: uniqueCountries.size,
    syncedCountries: syncedCountryCodes.length,
    failedCountries,
    services: providerServices.length,
  };
}

export async function updateCatalogItem(
  id: string,
  data: { enabled?: boolean; availableCount?: number; supplierCostXofMinor?: bigint },
) {
  await prisma.catalogItem.update({
    where: { id },
    data: {
      ...(data.enabled !== undefined ? { enabled: data.enabled } : {}),
      ...(data.availableCount !== undefined ? { availableCount: data.availableCount } : {}),
      ...(data.supplierCostXofMinor !== undefined
        ? { supplierCostXofMinor: data.supplierCostXofMinor }
        : {}),
    },
  });
}

export async function listAllCatalogItems() {
  return prisma.catalogItem.findMany({
    include: { country: true, service: true },
    orderBy: [{ countryCode: 'asc' }, { serviceId: 'asc' }],
  });
}

export interface AdminCatalogQuery {
  page?: number;
  limit?: number;
  search?: string;
  countryCode?: string;
  serviceId?: string;
  type?: NumberType;
}

/** Catalogue admin paginé : la table contient plusieurs dizaines de milliers d'offres. */
export async function listAdminCatalog(query: AdminCatalogQuery) {
  const page = Math.max(1, Math.trunc(query.page ?? 1));
  const limit = Math.min(200, Math.max(1, Math.trunc(query.limit ?? 50)));
  const search = query.search?.trim();

  const where: Prisma.CatalogItemWhereInput = {
    ...(query.countryCode ? { countryCode: query.countryCode.toUpperCase() } : {}),
    ...(query.serviceId ? { serviceId: query.serviceId } : {}),
    ...(query.type ? { type: query.type } : {}),
    ...(search
      ? {
          OR: [
            { service: { name: { contains: search, mode: 'insensitive' } } },
            { country: { name: { contains: search, mode: 'insensitive' } } },
            { country: { prefix: { contains: search } } },
            { countryCode: { equals: search.toUpperCase() } },
            { serviceId: { equals: search.toLowerCase() } },
          ],
        }
      : {}),
  };

  const [items, total] = await Promise.all([
    prisma.catalogItem.findMany({
      where,
      include: { country: true, service: true },
      orderBy: [{ countryCode: 'asc' }, { service: { name: 'asc' } }],
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.catalogItem.count({ where }),
  ]);

  return { items, total, page, limit, hasMore: page * limit < total };
}

export type CatalogItemWithRelations = Prisma.CatalogItemGetPayload<{
  include: { country: true; service: true };
}>;
