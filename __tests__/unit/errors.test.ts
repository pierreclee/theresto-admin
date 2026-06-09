import { parseFirebaseError, AdminError } from '@/lib/utils/errors';

describe('parseFirebaseError', () => {
  it('should parse permission denied error', () => {
    const error = new Error('permission-denied');
    const result = parseFirebaseError(error);
    expect(result).toBeInstanceOf(AdminError);
    expect(result.code).toBe('PERMISSION_DENIED');
  });

  it('should parse invalid argument error', () => {
    const error = new Error('invalid-argument');
    const result = parseFirebaseError(error);
    expect(result.code).toBe('INVALID_ARGUMENT');
  });

  it('should default to INTERNAL error', () => {
    const error = new Error('unknown error');
    const result = parseFirebaseError(error);
    expect(result.code).toBe('INTERNAL');
  });
});
