import {
  ADMIN_SESSION_MAX_AGE_SECONDS,
  adminSessionExpiresAt,
  hasAal2,
  hasRecentTotp,
  RECENT_MFA_MAX_AGE_SECONDS,
} from '@/lib/utils/recentMfa';

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

describe('hasAal2', () => {
  it('accepte une session AAL2, quel que soit l’âge du TOTP', () => {
    expect(hasAal2(jwt({ aal: 'aal2', amr: [{ method: 'totp', timestamp: 1 }] }))).toBe(true);
  });

  it('refuse AAL1, un jeton absent ou illisible', () => {
    expect(hasAal2(jwt({ aal: 'aal1' }))).toBe(false);
    expect(hasAal2(undefined)).toBe(false);
    expect(hasAal2(null)).toBe(false);
    expect(hasAal2('pas-un-jwt')).toBe(false);
  });
});

describe('adminSessionExpiresAt (règle navigateur = règle de requireAdmin)', () => {
  it('vaut le dernier TOTP vérifié + 2 h, en millisecondes', () => {
    expect(adminSessionExpiresAt({
      currentLevel: 'aal2',
      currentAuthenticationMethods: [
        { method: 'password', timestamp: NOW + 500 },
        { method: 'totp', timestamp: NOW - 100 },
        { method: 'totp', timestamp: NOW },
      ],
    })).toBe((NOW + ADMIN_SESSION_MAX_AGE_SECONDS) * 1000);
  });

  it('suit hasRecentTotp de part et d’autre de l’échéance', () => {
    const token = jwt({ aal: 'aal2', amr: [{ method: 'totp', timestamp: NOW }] });
    const expiresAt = adminSessionExpiresAt({
      currentLevel: 'aal2',
      currentAuthenticationMethods: [{ method: 'totp', timestamp: NOW }],
    })!;
    const justBefore = Math.floor((expiresAt - 1000) / 1000);
    expect(hasRecentTotp(token, justBefore, ADMIN_SESSION_MAX_AGE_SECONDS)).toBe(true);
    expect(hasRecentTotp(token, Math.floor(expiresAt / 1000) + 1, ADMIN_SESSION_MAX_AGE_SECONDS)).toBe(false);
  });

  it('null hors AAL2, sans TOTP, ou avec des amr sans horodatage', () => {
    expect(adminSessionExpiresAt(null)).toBeNull();
    expect(adminSessionExpiresAt({
      currentLevel: 'aal1',
      currentAuthenticationMethods: [{ method: 'totp', timestamp: NOW }],
    })).toBeNull();
    expect(adminSessionExpiresAt({
      currentLevel: 'aal2',
      currentAuthenticationMethods: [{ method: 'password', timestamp: NOW }],
    })).toBeNull();
    expect(adminSessionExpiresAt({ currentLevel: 'aal2', currentAuthenticationMethods: ['password', 'totp'] })).toBeNull();
  });
});
