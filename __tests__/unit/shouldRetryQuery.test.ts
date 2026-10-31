import { ActionError, shouldRetryQuery } from '@/lib/api/actionResult';
import { ADMIN_LOG_FAILED_MESSAGE } from '@/lib/audit/messages';

describe('shouldRetryQuery', () => {
  it('ne relance pas un refus faute de journal (code ou message)', () => {
    expect(shouldRetryQuery(0, new ActionError('x', 'audit-log-failed'))).toBe(false);
    expect(shouldRetryQuery(0, new Error(ADMIN_LOG_FAILED_MESSAGE))).toBe(false);
  });

  it("relance les autres erreurs jusqu'à 3 fois", () => {
    expect(shouldRetryQuery(0, new Error('réseau'))).toBe(true);
    expect(shouldRetryQuery(2, new Error('réseau'))).toBe(true);
    expect(shouldRetryQuery(3, new Error('réseau'))).toBe(false);
  });
});
