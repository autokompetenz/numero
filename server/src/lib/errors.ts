export type ErrorCode =
  | 'VALIDATION_ERROR'
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'INSUFFICIENT_FUNDS'
  | 'PRICE_NOT_AVAILABLE'
  | 'MARGIN_TOO_LOW'
  | 'PROVIDER_ERROR'
  | 'PROVIDER_UNAVAILABLE'
  | 'PAYMENT_ERROR'
  | 'IDEMPOTENCY_CONFLICT'
  | 'RATE_LIMITED'
  | 'INTERNAL_ERROR';

export class AppError extends Error {
  readonly statusCode: number;
  readonly code: ErrorCode;
  readonly details?: unknown;
  readonly expose: boolean;

  constructor(
    statusCode: number,
    code: ErrorCode,
    message: string,
    options?: { details?: unknown; expose?: boolean; cause?: unknown },
  ) {
    super(message, { cause: options?.cause });
    this.name = 'AppError';
    this.statusCode = statusCode;
    this.code = code;
    this.details = options?.details;
    this.expose = options?.expose ?? true;
  }
}

export const badRequest = (message: string, details?: unknown) =>
  new AppError(400, 'VALIDATION_ERROR', message, { details });

export const unauthorized = (message = 'Authentification requise.') =>
  new AppError(401, 'UNAUTHORIZED', message);

export const forbidden = (message = 'Accès refusé.') =>
  new AppError(403, 'FORBIDDEN', message);

export const notFound = (message = 'Ressource introuvable.') =>
  new AppError(404, 'NOT_FOUND', message);

export const conflict = (message: string, details?: unknown) =>
  new AppError(409, 'CONFLICT', message, { details });

export const insufficientFunds = (message = 'Solde insuffisant.') =>
  new AppError(409, 'INSUFFICIENT_FUNDS', message);

export const marginTooLow = (message: string, details?: unknown) =>
  new AppError(409, 'MARGIN_TOO_LOW', message, { details });

export const providerError = (message: string, details?: unknown) =>
  new AppError(502, 'PROVIDER_ERROR', message, { details });

export const paymentError = (message: string, details?: unknown) =>
  new AppError(502, 'PAYMENT_ERROR', message, { details });
