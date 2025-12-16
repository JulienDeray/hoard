import { z } from 'zod';

export const dateStringSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, {
  message: 'Date must be in YYYY-MM-DD format',
});

export const cryptoSymbolSchema = z
  .string()
  .min(1)
  .max(10)
  .transform((s) => s.toUpperCase());

export const positiveNumberSchema = z.number().positive('Amount must be positive');

export function validateDate(date: string): boolean {
  const result = dateStringSchema.safeParse(date);
  return result.success;
}

export function validateCryptoSymbol(symbol: string): boolean {
  const result = cryptoSymbolSchema.safeParse(symbol);
  return result.success;
}

export function validateAmount(amount: number): boolean {
  const result = positiveNumberSchema.safeParse(amount);
  return result.success;
}
