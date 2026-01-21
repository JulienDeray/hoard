import { describe, it, expect } from 'vitest';
import {
  getHttpStatus,
  formatErrorResponse,
} from '../../src/api/error-handler.js';
import {
  SnapshotNotFoundError,
  SnapshotAlreadyExistsError,
  AssetNotFoundError,
  HoldingNotFoundError,
  InvalidDateError,
  InvalidAmountError,
  AllocationTargetsSumError,
  DuplicateAllocationTargetError,
  NoAllocationTargetsError,
  PriceFetchError,
  ServiceError,
} from '../../src/errors/index.js';

describe('API Error Handler', () => {
  describe('getHttpStatus', () => {
    it('should return 404 for not found errors', () => {
      expect(getHttpStatus(new SnapshotNotFoundError('2024-01-01'))).toBe(404);
      expect(getHttpStatus(new AssetNotFoundError('BTC'))).toBe(404);
      expect(getHttpStatus(new HoldingNotFoundError('BTC', '2024-01-01'))).toBe(404);
      expect(getHttpStatus(new NoAllocationTargetsError())).toBe(404);
    });

    it('should return 409 for conflict errors', () => {
      expect(getHttpStatus(new SnapshotAlreadyExistsError('2024-01-01', 5))).toBe(409);
    });

    it('should return 400 for validation errors', () => {
      expect(getHttpStatus(new InvalidDateError('invalid'))).toBe(400);
      expect(getHttpStatus(new InvalidAmountError(-1))).toBe(400);
      expect(getHttpStatus(new AllocationTargetsSumError(95))).toBe(400);
      expect(getHttpStatus(new DuplicateAllocationTargetError('BTC'))).toBe(400);
    });

    it('should return 502 for external API errors', () => {
      expect(getHttpStatus(new PriceFetchError('BTC', 'API error'))).toBe(502);
    });

    it('should return 500 for unknown error codes', () => {
      const unknownError = new ServiceError('Unknown', 'UNKNOWN_CODE');
      expect(getHttpStatus(unknownError)).toBe(500);
    });
  });

  describe('formatErrorResponse', () => {
    it('should format error with message and code', () => {
      const error = new SnapshotNotFoundError('2024-01-01');
      const response = formatErrorResponse(error);

      expect(response).toEqual({
        error: 'No snapshot found for 2024-01-01',
        code: 'SNAPSHOT_NOT_FOUND',
      });
    });

    it('should include error details from different error types', () => {
      const error = new SnapshotAlreadyExistsError('2024-01-01', 5);
      const response = formatErrorResponse(error);

      expect(response.code).toBe('SNAPSHOT_ALREADY_EXISTS');
      expect(response.error).toContain('2024-01-01');
      expect(response.error).toContain('5 holding');
    });
  });
});
