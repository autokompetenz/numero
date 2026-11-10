import { createHash, randomBytes, randomUUID } from 'node:crypto';

export function newReference(prefix: string): string {
  const year = new Date().getUTCFullYear();
  const random = randomBytes(4).readUInt32BE(0) % 1_000_000;
  return `${prefix}-${year}-${random.toString().padStart(6, '0')}`;
}

export function newIdempotencyKey(scope: string): string {
  return `${scope}:${randomUUID()}`;
}

export function randomToken(bytes = 48): string {
  return randomBytes(bytes).toString('base64url');
}

export function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

export function maskEmail(email: string): string {
  const [local = '', domain] = email.split('@');
  if (!domain) return '***';
  const visible = local.slice(0, 2);
  return `${visible}${'*'.repeat(Math.max(2, local.length - 2))}@${domain}`;
}
