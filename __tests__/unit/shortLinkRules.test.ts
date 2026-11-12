/**
 * @jest-environment node
 *
 * Liens courts (P10) : règles de saisie identiques à la base (migration
 * 20261127110000_short_links.sql du dépôt theresto_app), domaine par environnement,
 * URL du QR et traduction des refus de la base.
 */
import {
  isTargetAllowed,
  RESERVED_SLUGS,
  shortLinkDbErrorMessage,
  shortLinkDomain,
  shortLinkUrl,
  slugError,
  TARGET_RULE_MESSAGE,
  validateShortLinkInput,
  validateShortLinkSettingsInput,
  changedFields,
} from '@/lib/links/shortLinkRules';

const base = {
  slug: 'flyer-lyon',
  label: 'Flyers Lyon',
  kind: 'download',
  targetDefault: 'https://app.theresto.fr/',
  targetIos: null,
  targetAndroid: '',
  forwardParams: 'none',
  src: 'Flyer',
  ville: 'lyon',
  persona: 'client',
  campaign: null,
  expiresAt: null,
};

describe('slug', () => {
  it.each(['ab', 'flyer-lyon', '0a', 'a'.repeat(40), 'telecharger'])('%s accepté', (slug) => {
    expect(slugError(slug)).toBeNull();
  });

  it.each(['a', '-ab', 'Ab', 'café', 'a_b', 'a'.repeat(41), 'a/b', ''])('%s refusé', (slug) => {
    expect(slugError(slug)).not.toBeNull();
  });

  it('mots réservés de la base refusés', () => {
    expect(RESERVED_SLUGS).toHaveLength(20);
    for (const slug of RESERVED_SLUGS) expect(slugError(slug)).toContain('réservé');
  });

  it('mis en minuscules à la saisie', () => {
    const r = validateShortLinkInput({ ...base, slug: ' Flyer-Lyon ' });
    expect(r.ok && r.value.slug).toBe('flyer-lyon');
  });
});

describe('cibles autorisées (anti open redirect)', () => {
  it.each([
    'https://theresto.fr',
    'https://theresto.fr/',
    'https://app.theresto.fr/restaurant/x?src=qr#top',
    'https://hub.theresto.fr?x=1',
    'https://widget.theresto.fr#a',
    'https://apps.apple.com/fr/app/theresto/id123',
    'https://apps.apple.com/app/id123456789',
    'https://apps.apple.com/app/theresto/id1?ct=x',
    'https://play.google.com/store/apps/details?id=com.theresto',
    'https://play.google.com/store/apps/details?id=com.theresto.application',
    'https://play.google.com/store/apps/details?id=com.theresto.application&hl=fr',
  ])('%s', (url) => expect(isTargetAllowed(url, 'any')).toBe(true));

  it.each([
    'http://app.theresto.fr/',
    'https://evil.com/',
    'https://theresto.fr.evil.com/',
    'https://app.theresto.fr@evil.com/',
    'https://user@app.theresto.fr/',
    'https://app.theresto.fr:8443/',
    'https://www.theresto.fr/',
    'https://APP.theresto.fr/',
    'https://app.theresto.fr/a b',
    'https://app.theresto.fr/\\evil',
    'https://app.theresto.fr/\n',
    'https://play.google.com/store/apps/details?id=com.autre',
    'https://play.google.com/store/apps/details?id=com.theresto.app/../x',
    'https://apps.apple.com',
    'https://apps.apple.com/fr/developer/theresto/id1',
    'https://apps.apple.com/fr/app/theresto/id1/../x',
    'https://play.google.com/store/apps/details?id=com.therestoevil',
    'https://app.theresto.fr/telecharger',
    'https://app.theresto.fr/TELECHARGER?src=x',
    'https://app.theresto.fr/a%2F..',
    'https://theresto.fr//evil.com',
    'https://hub.theresto.fr/a/../b',
    'https://hub.theresto.fr/.',
    `https://app.theresto.fr/a${String.fromCharCode(0xfeff)}`,
    `https://app.theresto.fr/${'a'.repeat(2000)}`,
    'javascript:alert(1)',
  ])('%s refusée', (url) => expect(isTargetAllowed(url, 'any')).toBe(false));

  it('portées des réglages : App Store et fiche Play seulement', () => {
    expect(isTargetAllowed('https://apps.apple.com/fr/app/theresto/id1', 'app_store')).toBe(true);
    expect(isTargetAllowed('https://apps.apple.com/fr/app/x', 'app_store')).toBe(false);
    expect(isTargetAllowed('https://app.theresto.fr/', 'app_store')).toBe(false);
    expect(isTargetAllowed('https://play.google.com/store/apps/details?id=com.theresto.application', 'play')).toBe(true);
    expect(isTargetAllowed('https://apps.apple.com/fr/app/theresto/id1', 'play')).toBe(false);
  });

  it('cible refusée : message de la règle', () => {
    const r = validateShortLinkInput({ ...base, targetIos: 'https://evil.com/' });
    expect(r).toEqual({ ok: false, error: `Cible iPhone : ${TARGET_RULE_MESSAGE}` });
  });
});

describe('validateShortLinkInput', () => {
  it('normalise : vides → null, attributs en minuscules, date ISO', () => {
    const r = validateShortLinkInput({ ...base, expiresAt: '2027-01-01T10:00:00+01:00' });
    expect(r).toEqual({
      ok: true,
      value: {
        slug: 'flyer-lyon', label: 'Flyers Lyon', kind: 'download',
        target_default: 'https://app.theresto.fr/', target_ios: null, target_android: null,
        forward_params: 'none', src: 'flyer', ville: 'lyon', persona: 'client', campaign: null,
        expires_at: '2027-01-01T09:00:00.000Z',
      },
    });
  });

  it.each([
    [{ kind: 'autre' }, 'Type'],
    [{ forwardParams: 'all' }, 'Paramètres'],
    [{ persona: 'admin' }, 'Persona'],
    [{ ville: 'saint étienne' }, 'Ville'],
    [{ campaign: 'a'.repeat(41) }, 'Campagne'],
    [{ targetDefault: '' }, 'Cible par défaut : obligatoire'],
    [{ label: 'x'.repeat(201) }, 'Libellé'],
    [{ expiresAt: 'demain' }, 'Expiration'],
    [{ slug: 'admin' }, 'réservé'],
  ])('%o refusé', (patch, message) => {
    const r = validateShortLinkInput({ ...base, ...patch });
    expect(r.ok).toBe(false);
    expect(!r.ok && r.error).toContain(message);
  });

  it('saisie illisible', () => {
    expect(validateShortLinkInput(null).ok).toBe(false);
    expect(validateShortLinkInput({ ...base, slug: 12 }).ok).toBe(false);
  });
});

describe('réglages des stores', () => {
  it('acceptés et vides → null', () => {
    expect(validateShortLinkSettingsInput({
      appStoreUrl: 'https://apps.apple.com/fr/app/theresto/id1',
      playStoreUrl: ' ',
      appStoreProviderToken: '123456',
    })).toEqual({
      ok: true,
      value: { app_store_url: 'https://apps.apple.com/fr/app/theresto/id1', play_store_url: null, app_store_provider_token: '123456' },
    });
  });

  it.each([
    [{ appStoreUrl: 'https://play.google.com/store/apps/details?id=com.theresto.application' }, 'App Store'],
    [{ playStoreUrl: 'https://play.google.com/store/apps/details?id=com.other' }, 'Google Play'],
    [{ appStoreProviderToken: 'abc' }, 'Provider token'],
    [{ appStoreProviderToken: '1'.repeat(21) }, 'Provider token'],
  ])('%o refusé', (patch, message) => {
    const r = validateShortLinkSettingsInput({ appStoreUrl: null, playStoreUrl: null, appStoreProviderToken: null, ...patch });
    expect(!r.ok && r.error).toContain(message);
  });
});

describe('domaine et URL du QR', () => {
  it('domaine selon l environnement', () => {
    expect(shortLinkDomain('production')).toBe('go.theresto.fr');
    expect(shortLinkDomain('staging')).toBe('theresto-go-staging.pierrecleepro.workers.dev');
  });

  it('toujours https://<domaine>/<slug>', () => {
    expect(shortLinkUrl('go.theresto.fr', 'Telecharger')).toBe('https://go.theresto.fr/telecharger');
    expect(() => shortLinkUrl('go.theresto.fr', '../x')).toThrow();
  });
});

describe('refus de la base', () => {
  it.each([
    ['22023', 'Cible non autorisée'],
    ['23505', 'déjà pris'],
    ['23514', 'Format refusé'],
    ['XX000', "L'enregistrement a échoué"],
  ])('%s', (code, text) => {
    expect(shortLinkDbErrorMessage({ code, message: 'raw english message' })).toContain(text);
    expect(shortLinkDbErrorMessage({ code, message: 'raw english message' })).not.toContain('raw');
  });
});

it('changedFields : noms des colonnes modifiées seulement', () => {
  expect(changedFields({ a: 1, b: null, c: 'x' }, { a: 1, b: 'y', c: 'z' })).toEqual(['b', 'c']);
});
