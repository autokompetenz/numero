import { Currency, Prisma, WalletTransactionType } from '@prisma/client';
import { prisma } from '../db/prisma.js';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';
import { insufficientFunds, notFound } from '../lib/errors.js';
import { formatMinor } from '../lib/money.js';
import { newReference } from '../lib/ids.js';

export const SUPPORTED_CURRENCIES: Currency[] = ['XOF', 'EUR', 'USD'];

type Tx = Prisma.TransactionClient;

export async function ensureWallets(userId: string, tx: Tx = prisma): Promise<void> {
  for (const currency of SUPPORTED_CURRENCIES) {
    await tx.wallet.upsert({
      where: { userId_currency: { userId, currency } },
      create: { userId, currency, balanceMinor: 0n },
      update: {},
    });
  }
}

export async function getWallet(userId: string, currency: Currency, tx: Tx = prisma) {
  const wallet = await tx.wallet.findUnique({
    where: { userId_currency: { userId, currency } },
  });
  if (!wallet) throw notFound(`Portefeuille ${currency} introuvable.`);
  return wallet;
}

export async function listWallets(userId: string) {
  return prisma.wallet.findMany({
    where: { userId },
    orderBy: { currency: 'asc' },
  });
}

export async function listTransactions(userId: string, currency: Currency, limit = 100) {
  const wallet = await getWallet(userId, currency);
  return prisma.walletTransaction.findMany({
    where: { walletId: wallet.id },
    orderBy: { createdAt: 'desc' },
    take: Math.min(Math.max(limit, 1), 200),
  });
}

interface LedgerEntry {
  userId: string;
  currency: Currency;
  amountMinor: bigint;
  type: WalletTransactionType;
  description: string;
  idempotencyKey: string;
  metadata?: Prisma.InputJsonValue;
  referencePrefix?: string;
}

/**
 * Applique un mouvement au ledger de façon atomique.
 * - amountMinor > 0 : crédit
 * - amountMinor < 0 : débit (refusé si le solde deviendrait négatif)
 * - idempotent via idempotencyKey
 */
async function applyLedgerEntry(entry: LedgerEntry, transaction?: Tx) {
  const apply = async (tx: Tx) => {
    const existing = await tx.walletTransaction.findUnique({
      where: { idempotencyKey: entry.idempotencyKey },
    });
    if (existing) return existing;

    const wallet = await tx.wallet.findUnique({
      where: { userId_currency: { userId: entry.userId, currency: entry.currency } },
    });
    if (!wallet) throw notFound(`Portefeuille ${entry.currency} introuvable.`);

    const delta = entry.amountMinor;
    if (delta === 0n) throw new Error('Le montant du mouvement ne peut pas être nul.');

    const rows = await tx.$queryRaw<Array<{ balanceMinor: bigint }>>`
        UPDATE "Wallet"
        SET "balanceMinor" = "balanceMinor" + ${delta},
            "version" = "version" + 1,
            "updatedAt" = NOW()
        WHERE "id" = ${wallet.id}
          AND ("balanceMinor" + ${delta}) >= 0
        RETURNING "balanceMinor"
    `;

    const updated = rows[0];
    if (!updated) {
      throw insufficientFunds(
        `Solde ${entry.currency} insuffisant. Solde actuel : ${formatMinor(wallet.balanceMinor, entry.currency)}.`,
      );
    }

    return tx.walletTransaction.create({
      data: {
        walletId: wallet.id,
        type: entry.type,
        status: 'CONFIRMED',
        amountMinor: delta,
        balanceAfterMinor: updated.balanceMinor,
        currency: entry.currency,
        reference: newReference(entry.referencePrefix ?? 'TX'),
        idempotencyKey: entry.idempotencyKey,
        description: entry.description,
        metadata: entry.metadata,
      },
    });
  };

  if (transaction) return apply(transaction);

  try {
    return await prisma.$transaction(apply);
  } catch (error) {
    // Course entre deux requêtes idempotentes : renvoyer l'écriture déjà créée.
    if (error instanceof PrismaClientKnownRequestError && error.code === 'P2002') {
      const duplicate = await prisma.walletTransaction.findUnique({
        where: { idempotencyKey: entry.idempotencyKey },
      });
      if (duplicate) return duplicate;
    }
    throw error;
  }
}

export function creditWallet(params: {
  userId: string;
  currency: Currency;
  amountMinor: bigint;
  type?: Extract<WalletTransactionType, 'DEPOSIT' | 'REFUND' | 'ADJUSTMENT'>;
  description: string;
  idempotencyKey: string;
  metadata?: Prisma.InputJsonValue;
  referencePrefix?: string;
  tx?: Tx;
}) {
  if (params.amountMinor <= 0n) throw new Error('Le crédit doit être strictement positif.');
  return applyLedgerEntry({
    userId: params.userId,
    currency: params.currency,
    amountMinor: params.amountMinor,
    type: params.type ?? 'DEPOSIT',
    description: params.description,
    idempotencyKey: params.idempotencyKey,
    metadata: params.metadata,
    referencePrefix: params.referencePrefix ?? 'DEP',
  }, params.tx);
}

export function debitWallet(params: {
  userId: string;
  currency: Currency;
  amountMinor: bigint;
  description: string;
  idempotencyKey: string;
  metadata?: Prisma.InputJsonValue;
  referencePrefix?: string;
  tx?: Tx;
}) {
  if (params.amountMinor <= 0n) throw new Error('Le débit doit être strictement positif.');
  return applyLedgerEntry({
    userId: params.userId,
    currency: params.currency,
    amountMinor: -params.amountMinor,
    type: 'PURCHASE',
    description: params.description,
    idempotencyKey: params.idempotencyKey,
    metadata: params.metadata,
    referencePrefix: params.referencePrefix ?? 'PUR',
  }, params.tx);
}

export function adjustWallet(params: {
  userId: string;
  currency: Currency;
  amountMinor: bigint; // signé
  description: string;
  idempotencyKey: string;
  metadata?: Prisma.InputJsonValue;
  actorId: string;
}) {
  return applyLedgerEntry({
    userId: params.userId,
    currency: params.currency,
    amountMinor: params.amountMinor,
    type: 'ADJUSTMENT',
    description: params.description,
    idempotencyKey: params.idempotencyKey,
    metadata: { ...(params.metadata as object), actorId: params.actorId },
    referencePrefix: 'ADJ',
  });
}
