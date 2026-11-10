import { randomUUID } from 'node:crypto';
import { env } from '../../config/env.js';
import {
  CreateFedaPayTransactionInput,
  FedaPayApiError,
  FedaPayClient,
  FedaPayToken,
  FedaPayTransaction,
} from './types.js';

/**
 * Client de simulation locale. Il n'est jamais instancié en production :
 * env.ts refuse PAYMENTS_MODE=mock lorsque NODE_ENV=production.
 */
export class MockFedaPayClient implements FedaPayClient {
  readonly mode = 'mock' as const;
  private readonly transactions = new Map<string, FedaPayTransaction>();

  async createTransaction(
    input: CreateFedaPayTransactionInput,
  ): Promise<FedaPayTransaction> {
    if (!Number.isInteger(input.amount) || input.amount <= 0) {
      throw new FedaPayApiError('invalid_amount', 'Montant de test invalide.', 400);
    }
    const id = `mock_${randomUUID()}`;
    const transaction: FedaPayTransaction = {
      id,
      reference: `MOCK-${id.slice(-8).toUpperCase()}`,
      amount: input.amount,
      currency: input.currency,
      status: 'pending',
      description: input.description,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    this.transactions.set(id, transaction);
    return transaction;
  }

  async generateToken(transactionId: string): Promise<FedaPayToken> {
    const transaction = this.transactions.get(transactionId);
    if (!transaction) {
      throw new FedaPayApiError('not_found', 'Transaction de test introuvable.', 404);
    }
    return {
      token: `tok_${transactionId}`,
      url: `${env.FRONTEND_URL}/?mock_payment=${encodeURIComponent(transactionId)}`,
    };
  }

  async getTransaction(transactionId: string): Promise<FedaPayTransaction> {
    const transaction = this.transactions.get(transactionId);
    if (!transaction) {
      throw new FedaPayApiError('not_found', 'Transaction de test introuvable.', 404);
    }
    return { ...transaction };
  }

  /** Réservé au mode développement : simule la décision du client sur la page FedaPay. */
  markStatus(transactionId: string, status: 'approved' | 'declined' | 'canceled'): void {
    const transaction = this.transactions.get(transactionId);
    if (!transaction) {
      throw new FedaPayApiError('not_found', 'Transaction de test introuvable.', 404);
    }
    transaction.status = status;
    transaction.updatedAt = new Date().toISOString();
  }

  /** Réservé au mode développement : force l'arrivée d'une transaction approuvée. */
  forceApprove(transactionId: string): FedaPayTransaction {
    this.markStatus(transactionId, 'approved');
    return this.transactions.get(transactionId)!;
  }
}
