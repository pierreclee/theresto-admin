/**
 * @jest-environment node
 *
 * Garde-fou (RGPD-28) : toute Server Action lit et écrit avec la clé service,
 * donc chacune doit appeler requireAdmin() (admin + AAL2 + TOTP < 2 h) avant
 * tout getAdminClient(). Analyse du code source avec le compilateur TypeScript.
 */
import fs from 'fs';
import path from 'path';
import ts from 'typescript';

const ROOT = path.resolve(__dirname, '../..');
const ACTIONS_DIR = path.join(ROOT, 'lib/actions');
const SCANNED_DIRS = ['app', 'lib', 'components', 'middleware.ts'];

function listSourceFiles(entry: string): string[] {
  const full = path.join(ROOT, entry);
  if (!fs.existsSync(full)) return [];
  if (fs.statSync(full).isFile()) return /\.(ts|tsx)$/.test(full) ? [full] : [];
  return fs.readdirSync(full).flatMap((name) => listSourceFiles(path.join(entry, name)));
}

function parse(file: string): ts.SourceFile {
  return ts.createSourceFile(file, fs.readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true);
}

function hasUseServerDirective(sf: ts.SourceFile): boolean {
  const first = sf.statements[0];
  return !!first && ts.isExpressionStatement(first) && ts.isStringLiteral(first.expression)
    && first.expression.text === 'use server';
}

const rel = (file: string) => path.relative(ROOT, file).split(path.sep).join('/');

function isCallTo(node: ts.Node, name: string): boolean {
  return ts.isCallExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === name;
}

/** Position du premier appel à [name] dans [node], ou -1. */
function firstCallPos(node: ts.Node, name: string): number {
  let pos = -1;
  const visit = (n: ts.Node) => {
    if (pos !== -1) return;
    if (isCallTo(n, name)) { pos = n.getStart(); return; }
    ts.forEachChild(n, visit);
  };
  visit(node);
  return pos;
}

/** Vrai si l'instruction est `await requireAdmin();` ou `const x = await requireAdmin();`. */
function isTopLevelRequireAdmin(stmt: ts.Statement): boolean {
  const awaited = (e: ts.Expression | undefined) =>
    !!e && ts.isAwaitExpression(e) && isCallTo(e.expression, 'requireAdmin');
  if (ts.isExpressionStatement(stmt)) return awaited(stmt.expression);
  if (ts.isVariableStatement(stmt)) return stmt.declarationList.declarations.some((d) => awaited(d.initializer));
  return false;
}

interface ExportedAction { name: string; body: ts.Block | undefined }

function exportedActions(sf: ts.SourceFile): { actions: ExportedAction[]; unsupported: string[] } {
  const actions: ExportedAction[] = [];
  const unsupported: string[] = [];
  for (const stmt of sf.statements) {
    const exported = ts.canHaveModifiers(stmt)
      && ts.getModifiers(stmt)?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword);
    if (ts.isFunctionDeclaration(stmt) && exported) {
      actions.push({ name: stmt.name?.text ?? 'default', body: stmt.body });
    } else if (ts.isVariableStatement(stmt) && exported) {
      for (const d of stmt.declarationList.declarations) {
        const init = d.initializer;
        if (init && (ts.isArrowFunction(init) || ts.isFunctionExpression(init)) && ts.isBlock(init.body)) {
          actions.push({ name: d.name.getText(), body: init.body });
        } else {
          unsupported.push(d.name.getText());
        }
      }
    } else if (ts.isExportDeclaration(stmt) || ts.isExportAssignment(stmt)) {
      unsupported.push(stmt.getText());
    }
  }
  return { actions, unsupported };
}

const actionFiles = listSourceFiles('lib/actions').filter((f) => hasUseServerDirective(parse(f)));

describe('Server Actions : requireAdmin() avant la clé service', () => {
  it('trouve les fichiers de Server Actions', () => {
    expect(actionFiles.length).toBeGreaterThan(0);
  });

  it.each(actionFiles.map((f) => [rel(f), f]))('%s', (_name, file) => {
    const sf = parse(file);
    const { actions, unsupported } = exportedActions(sf);
    const problems: string[] = unsupported.map((u) => `export non analysable : ${u}`);
    for (const { name, body } of actions) {
      if (!body) { problems.push(`${name} : pas de corps`); continue; }
      const guard = body.statements.find(isTopLevelRequireAdmin);
      if (!guard) {
        problems.push(`${name} : n'appelle pas « await requireAdmin() » au premier niveau du corps`);
        continue;
      }
      const adminClientPos = firstCallPos(body, 'getAdminClient');
      if (adminClientPos !== -1 && adminClientPos < guard.getStart()) {
        problems.push(`${name} : getAdminClient() appelé avant requireAdmin()`);
      }
    }
    expect(problems).toEqual([]);
  });

  it("aucun fichier 'use server' hors de lib/actions/", () => {
    const outside = SCANNED_DIRS.flatMap(listSourceFiles)
      .filter((f) => !f.startsWith(ACTIONS_DIR + path.sep))
      .filter((f) => hasUseServerDirective(parse(f)))
      .map(rel);
    expect(outside).toEqual([]);
  });

  it("getAdminClient n'est utilisé que dans lib/actions/, lib/supabase/ et le journal d'administration", () => {
    const allowed = [ACTIONS_DIR, path.join(ROOT, 'lib/supabase')].map((d) => d + path.sep);
    // Journal d'administration (RGPD-29) : pas un fichier 'use server' (test ci-dessus), il
    // n'est appelé que par une Server Action, après requireAdmin(), avec l'admin vérifié.
    const allowedFiles = [path.join(ROOT, 'lib/audit/adminLog.ts')];
    const offenders = SCANNED_DIRS.flatMap(listSourceFiles)
      .filter((f) => !allowed.some((d) => f.startsWith(d)) && !allowedFiles.includes(f))
      .filter((f) => /\bgetAdminClient\b/.test(fs.readFileSync(f, 'utf8')))
      .map(rel);
    expect(offenders).toEqual([]);
  });
});
