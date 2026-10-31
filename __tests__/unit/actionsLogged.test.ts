/**
 * @jest-environment node
 *
 * Garde-fou (RGPD-29) : chaque Server Action de admin.ts et users.ts écrit le journal
 * d'administration, sauf les exceptions listées. Les actions des autres fichiers passent par
 * une Edge Function qui journalise elle-même (commission-settings, admin-privatization-incidents,
 * subscription-prices, migration-tools, admin-onboarding).
 */
import fs from 'fs';
import path from 'path';

const ROOT = path.resolve(__dirname, '../..');
const FILES = ['lib/actions/admin.ts', 'lib/actions/users.ts'];
const EXEMPT: Record<string, string> = {
  getStatsAction: 'comptes agrégés, aucune donnée personnelle',
  getConfigAction: 'réglages de la plateforme',
  getAuditLogsAction: 'lecture du journal lui-même',
};

function exportedActions(src: string): { name: string; body: string }[] {
  const parts = src.split(/(?=^export async function )/m).slice(1);
  return parts.map((part) => ({ name: /^export async function (\w+)/.exec(part)![1], body: part }));
}

const actions = FILES.flatMap((file) =>
  exportedActions(fs.readFileSync(path.join(ROOT, file), 'utf8')).map((a) => ({ file, ...a })));

describe('Server Actions journalisées', () => {
  it('trouve les actions des deux fichiers', () => {
    for (const file of FILES) expect(actions.filter((a) => a.file === file).length).toBeGreaterThan(2);
  });

  it('chaque exception désigne une action existante', () => {
    expect(Object.keys(EXEMPT).filter((name) => !actions.some((a) => a.name === name))).toEqual([]);
  });

  it.each(actions.filter((a) => !(a.name in EXEMPT)).map((a) => [`${a.file} : ${a.name}`, a.body]))(
    '%s',
    (_label, body) => {
      expect(/\blogAdmin(Action|ReadOrThrow)\(/.test(body)).toBe(true);
    },
  );
});
