import { describe, it, expect } from 'vitest';
import { formatEuro, formatNumber } from '../../src/utils/formatters.js';

describe('formatters', () => {
  describe('formatEuro', () => {
    it('should format numbers with Euro standard (narrow no-break space separator, comma decimal)', () => {
      // French locale uses narrow no-break space (U+202F) as thousand separator
      expect(formatEuro(325140.41)).toBe('€325\u202f140,41');
    });

    it('should format small numbers', () => {
      expect(formatEuro(1234.56)).toBe('€1\u202f234,56');
    });

    it('should format millions', () => {
      expect(formatEuro(1234567.89)).toBe('€1\u202f234\u202f567,89');
    });

    it('should format numbers less than 1000', () => {
      expect(formatEuro(123.45)).toBe('€123,45');
    });

    it('should handle zero', () => {
      expect(formatEuro(0)).toBe('€0,00');
    });

    it('should respect custom decimal places', () => {
      expect(formatEuro(1234.5678, 4)).toBe('€1\u202f234,5678');
    });

    it('should handle integers with 0 decimals', () => {
      expect(formatEuro(1234567, 0)).toBe('€1\u202f234\u202f567');
    });
  });

  describe('formatNumber', () => {
    it('should format numbers without currency symbol', () => {
      expect(formatNumber(325140.41)).toBe('325\u202f140,41');
    });

    it('should format with custom decimal places', () => {
      expect(formatNumber(1234.5, 1)).toBe('1\u202f234,5');
    });
  });
});
