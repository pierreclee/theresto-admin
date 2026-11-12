/**
 * @jest-environment node
 *
 * Cibles des liens courts : lib/links/shortLinkRules.ts doit dire exactement ce que dit
 * public.short_link_target_allowed (migration 20261127110000_short_links.sql de theresto_app).
 *
 * 1. Les motifs (TARGET_PATTERNS) figurent mot pour mot dans la fonction SQL, quand le dépôt
 *    theresto_app est à côté (THERESTO_APP_DIR, sinon ../theresto_app_p10 ou ../theresto_app) ;
 *    sans lui, ce test est sauté (CI de l'admin).
 * 2. Table des cas limites, avec le résultat de la fonction SQL pour chaque portée.
 */
import fs from 'fs';
import path from 'path';
import { isTargetAllowed, TARGET_PATTERNS, type TargetScope } from '@/lib/links/shortLinkRules';

const MIGRATION = 'supabase/migrations/20261127110000_short_links.sql';
const candidates = [
  process.env.THERESTO_APP_DIR,
  path.resolve(__dirname, '../../../theresto_app_p10'),
  path.resolve(__dirname, '../../../theresto_app'),
].filter((d): d is string => Boolean(d));
const sqlFile = candidates.map((d) => path.join(d, MIGRATION)).find((f) => fs.existsSync(f));

/** Corps de la fonction short_link_target_allowed, sans les commentaires. */
function functionBody(sql: string): string {
  const start = sql.indexOf('CREATE OR REPLACE FUNCTION public.short_link_target_allowed');
  const end = sql.indexOf('$$;', start);
  return sql.slice(start, end).replace(/--.*$/gm, '');
}

(sqlFile ? describe : describe.skip)('motifs recopiés de la fonction SQL', () => {
  const body = sqlFile ? functionBody(fs.readFileSync(sqlFile, 'utf8')) : '';

  it.each(Object.entries(TARGET_PATTERNS))('%s', (_name, pattern) => {
    expect(body).toContain(`'${pattern}'`);
  });

  it('opérateurs : chemin refusé (!~), exclusion de l App sans casse (!~*), BOM, contrôles', () => {
    expect(body).toContain(`p_url !~ '${TARGET_PATTERNS.badPath}'`);
    expect(body).toContain(`p_url !~* '${TARGET_PATTERNS.appExcluded}'`);
    expect(body).toContain('strpos(p_url, chr(65279)) = 0');
    expect(body).toContain("p_url !~ '[[:space:][:cntrl:]\\\\]'");
    expect(body).toContain('char_length(p_url) <= 2000');
    // Toutes les comparaisons de motifs de la fonction sont connues ici.
    const used = [...body.matchAll(/~\*? '([^']+)'/g)].map((m) => m[1]).filter((p) => p !== '[[:space:][:cntrl:]\\\\]');
    expect(new Set(used)).toEqual(new Set(Object.values(TARGET_PATTERNS)));
  });
});

// [url, any, app_store, play] : résultat de short_link_target_allowed pour chaque portée.
const BOM = String.fromCharCode(0xfeff);
const CASES: [string, boolean, boolean, boolean][] = [
  ['https://theresto.fr', true, false, false],
  ['https://hub.theresto.fr/a/b?x=..//', true, false, false], // la requête peut contenir // et ..
  ['https://app.theresto.fr/restaurant/x', true, false, false],
  ['https://app.theresto.fr/telecharger', false, false, false],
  ['https://app.theresto.fr/Telecharger/', false, false, false],
  ['https://app.theresto.fr/telechargerx', false, false, false],
  ['https://app.theresto.fr/?next=/telecharger', true, false, false],
  ['https://app.theresto.fr/a%20b', false, false, false],
  ['https://app.theresto.fr/a?q=%20', true, false, false],
  ['https://hub.theresto.fr/a%20b', true, false, false],
  ['https://theresto.fr//x', false, false, false],
  ['https://theresto.fr/a/./b', false, false, false],
  ['https://theresto.fr/a/..', false, false, false],
  ['https://theresto.fr/a/..b', true, false, false],
  ['https://theresto.fr/.well-known', true, false, false],
  [`https://theresto.fr/${BOM}`, false, false, false],
  ['https://theresto.fr/\u0085', false, false, false],
  ['https://www.theresto.fr/', false, false, false],
  ['https://apps.apple.com/app/id1', true, true, false],
  ['https://apps.apple.com/fr/app/theresto-resa/id1234567890#x', true, true, false],
  ['https://apps.apple.com/fra/app/id1', false, false, false],
  ['https://apps.apple.com/fr/app/TheResto/id1', false, false, false],
  ['https://apps.apple.com/fr/app/id1234567890123', false, false, false],
  ['https://apps.apple.com/fr/app/theresto/id1/', false, false, false],
  ['https://play.google.com/store/apps/details?id=com.theresto', true, false, true],
  ['https://play.google.com/store/apps/details?id=com.theresto.application&hl=fr', true, false, true],
  ['https://play.google.com/store/apps/details?id=com.theresto.', false, false, false],
  ['https://play.google.com/store/apps/details?id=com.theresto2', false, false, false],
  ['https://play.google.com/store/apps/details?id=com.theresto.App', false, false, false],
  ['https://play.google.com/store/apps/details?hl=fr&id=com.theresto', false, false, false],
];

describe('cas limites (résultats de short_link_target_allowed)', () => {
  const scopes: TargetScope[] = ['any', 'app_store', 'play'];
  it.each(CASES)('%s', (url, ...expected) => {
    expect(scopes.map((scope) => isTargetAllowed(url, scope))).toEqual(expected);
  });

  it('portée inconnue : refusée', () => {
    expect(isTargetAllowed('https://theresto.fr', 'autre' as TargetScope)).toBe(false);
  });
});
