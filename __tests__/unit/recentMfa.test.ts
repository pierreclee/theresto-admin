import { hasRecentTotp, RECENT_MFA_MAX_AGE_SECONDS } from '@/lib/utils/recentMfa';

function jwt(claims: Record<string, unknown>): string {
  const b64 = (o: unknown) => Buffer.from(JSON.stringify(o)).toString('base64url');
  return `${b64({ alg: 'HS256' })}.${b64(claims)}.sig`;
}

const NOW = 1_800_000_000;

describe('hasRecentTotp', () => {
  it('accepte une session AAL2 avec un TOTP vérifié il y a moins de 5 min', () => {
    const token = jwt({ aal: 'aal2', amr: [{ method: 'totp', timestamp: NOW - 60 }] });
    expect(hasRecentTotp(token, NOW)).toBe(true);
  });

  it('refuse un TOTP plus ancien que 5 min', () => {
    const token = jwt({ aal: 'aal2', amr: [{ method: 'totp', timestamp: NOW - RECENT_MFA_MAX_AGE_SECONDS - 1 }] });
    expect(hasRecentTotp(token, NOW)).toBe(false);
  });

  it('refuse une session AAL1 même avec un amr récent', () => {
    const token = jwt({ aal: 'aal1', amr: [{ method: 'totp', timestamp: NOW }] });
    expect(hasRecentTotp(token, NOW)).toBe(false);
  });

  it('refuse sans TOTP (mot de passe seul) ou sans amr', () => {
    expect(hasRecentTotp(jwt({ aal: 'aal2', amr: [{ method: 'password', timestamp: NOW }] }), NOW)).toBe(false);
    expect(hasRecentTotp(jwt({ aal: 'aal2' }), NOW)).toBe(false);
  });

  it('refuse un jeton absent ou illisible', () => {
    expect(hasRecentTotp(undefined, NOW)).toBe(false);
    expect(hasRecentTotp('pas-un-jwt', NOW)).toBe(false);
  });
});
