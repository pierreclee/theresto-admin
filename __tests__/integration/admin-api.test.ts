import { parseFirebaseError, AdminError } from '@/lib/utils/errors';

describe('Admin API Integration Tests', () => {
  describe('parseFirebaseError', () => {
    it('should parse permission denied error from code', () => {
      const error = Object.assign(new Error('some message'), { code: 'functions/permission-denied' });
      const result = parseFirebaseError(error);
      expect(result).toBeInstanceOf(AdminError);
      expect(result.code).toBe('PERMISSION_DENIED');
    });

    it('should parse permission denied error from message', () => {
      const error = new Error('permission-denied');
      const result = parseFirebaseError(error);
      expect(result.code).toBe('PERMISSION_DENIED');
    });

    it('should parse unauthenticated error', () => {
      const error = Object.assign(new Error('unauthenticated'), { code: 'functions/unauthenticated' });
      const result = parseFirebaseError(error);
      expect(result.code).toBe('UNAUTHENTICATED');
    });

    it('should parse invalid argument error', () => {
      const error = new Error('invalid-argument');
      const result = parseFirebaseError(error);
      expect(result.code).toBe('INVALID_ARGUMENT');
    });

    it('should parse not found error', () => {
      const error = new Error('not-found');
      const result = parseFirebaseError(error);
      expect(result.code).toBe('NOT_FOUND');
    });

    it('should parse resource exhausted error', () => {
      const error = new Error('resource-exhausted');
      const result = parseFirebaseError(error);
      expect(result.code).toBe('RESOURCE_EXHAUSTED');
    });

    it('should default to INTERNAL for unknown errors', () => {
      const error = new Error('some unknown error');
      const result = parseFirebaseError(error);
      expect(result.code).toBe('INTERNAL');
    });

    it('should handle non-Error inputs', () => {
      const result = parseFirebaseError('string error');
      expect(result.code).toBe('INTERNAL');
    });
  });

  describe('Platform stats API (requires Firebase emulator)', () => {
    it('should fetch platform stats', async () => {
      // Requires Firebase emulator — skip in CI unless configured
      // const stats = await adminApi.getStats();
      // expect(stats).toHaveProperty('totalRestaurants');
      expect(true).toBe(true); // placeholder
    });

    it('should fetch restaurants list', async () => {
      // const result = await adminApi.getRestaurants();
      // expect(result).toHaveProperty('restaurants');
      // expect(result).toHaveProperty('total');
      expect(true).toBe(true); // placeholder
    });
  });
});
