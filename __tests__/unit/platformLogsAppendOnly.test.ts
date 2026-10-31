/**
 * @jest-environment node
 *
 * Garde-fou (RGPD-29, lot 9, D5) : platform_logs est inaltérable. Le code de theresto-admin ne
 * fait que SELECT et INSERT ; il n'écrit jamais event_type ni actor_id (colonnes supprimées)
 * ni created_at (fixé par la base).
 */
import fs from 'fs';
import path from 'path';

const ROOT = path.resolve(__dirname, '../..');
const DIRS = ['app', 'components', 'lib', 'middleware.ts'];

function sources(entry: string): string[] {
  const full = path.join(ROOT, entry);
  if (!fs.existsSync(full)) return [];
  if (fs.statSync(full).isFile()) return /\.(ts|tsx)$/.test(full) ? [full] : [];
  return fs.readdirSync(full).flatMap((name) => sources(path.join(entry, name)));
}

const files = DIRS.flatMap(sources).map((file) => ({ file, src: fs.readFileSync(file, 'utf8') }));

it('lit des fichiers', () => {
  expect(files.length).toBeGreaterThan(20);
});

it.each(files.filter((f) => f.src.includes("'platform_logs'")).map((f) => [path.relative(ROOT, f.file), f.src]))(
  '%s : platform_logs en SELECT ou INSERT seulement',
  (_label, src) => {
    const calls = [...src.matchAll(/from\('platform_logs'\)\s*\.(\w+)\(/g)].map((m) => m[1]);
    expect(calls.length).toBeGreaterThan(0);
    for (const call of calls) expect(['select', 'insert']).toContain(call);
    const inserts = [...src.matchAll(/from\('platform_logs'\)\s*\.insert\(\{([\s\S]*?)\}\)/g)].map((m) => m[1]);
    for (const body of inserts) expect(body).not.toMatch(/\b(event_type|actor_id|created_at)\s*:/);
  },
);
