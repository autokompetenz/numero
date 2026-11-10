export type FedaPayMode = 'mock' | 'sandbox' | 'live';

export type FedaPayTransactionStatus =
  | 'pending'
  | 'approved'
  | 'declined'
  | 'canceled'
  | 'cancelled'
  | 'refunded'
  | 'transferred'
  | 'approved_partially_refunded'
  | 'transferred_partially_refunded';

export interface FedaPayCustomer {
  firstname?: string;
  lastname?: string;
  email: string;
  phoneNumber?: {
    number: string;
    country: string;
  };
}

export interface FedaPayTransaction {
  id: string;
  reference: string;
  amount: number;
  currency: string;
  status: FedaPayTransactionStatus | string;
  description?: string;
  customer?: unknown;
  metadata?: unknown;
  createdAt?: string;
  updatedAt?: string;
}

export interface CreateFedaPayTransactionInput {
  description: string;
  amount: number;
  currency: string;
  callbackUrl?: string;
  customer?: FedaPayCustomer;
}

export interface FedaPayToken {
  token: string;
  url: string;
}

export interface FedaPayClient {
  readonly mode: FedaPayMode;
  createTransaction(input: CreateFedaPayTransactionInput): Promise<FedaPayTransaction>;
  generateToken(transactionId: string): Promise<FedaPayToken>;
  getTransaction(transactionId: string): Promise<FedaPayTransaction>;
}

export class FedaPayApiError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly statusCode: number,
  ) {
    super(message);
    this.name = 'FedaPayApiError';
  }
}
