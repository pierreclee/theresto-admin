/**
 * @jest-environment node
 *
 * Garde-fou (RGPD-29, lot 9) : chaque Server Action exportée par un fichier de lib/actions/
 * appelle logAdminAction(, hors commentaires, sauf celles de la table EXEMPT, chacune avec sa
 * raison. Une nouvelle action non journalisée fait échouer ce test : la journaliser ou
 * l'ajouter à EXEMPT en disant pourquoi.
 */
import fs from 'fs';
import path from 'path';

const ACTIONS_DIR = path.resolve(__dirname, '../../lib/actions');

const EXEMPT: Record<string, string> = {
  // admin.ts
  getStatsAction: 'comptes agrégés, aucune donnée personnelle (D1)',
  getConfigAction: 'réglages de la plateforme, non personnels (D1)',
  getAuditLogsAction: 'lecture du journal lui-même (D1)',
  // billing.ts
  getRevenueSummaryAction: 'agrégats de revenus du restaurant (RPC admin_restaurant_revenue_summary), non personnels',
  getStripeOverviewAction:
    "Edge Function admin-restaurant-billing, lecture seule, qui ne journalise PAS : état Stripe du restaurant, "
    + 'hors des consultations retenues par D1 (montre toutefois l e-mail du client Stripe : à réexaminer)',
  backfillPlatformRevenueAction: 'journalisée par l Edge Function migration-tools (platform_logs)',
  // commissionSettings.ts
  getCommissionSettingsAction: 'tarifs et totaux mensuels, non personnels',
  getRestaurantCommissionAction: 'tarif d un restaurant, non personnel',
  updateGlobalCommissionRatesAction: 'journalisée par l Edge Function commission-settings',
  updateRestaurantCommissionRatesAction: 'journalisée par l Edge Function commission-settings',
  resetRestaurantCommissionRatesAction: 'journalisée par l Edge Function commission-settings',
  updateGlobalOnlineRatesAction: 'journalisée par l Edge Function commission-settings',
  setRestaurantOnlineRateAction: 'journalisée par l Edge Function commission-settings',
  updateGlobalPrivatizationRatesAction: 'journalisée par l Edge Function commission-settings',
  setRestaurantPrivatizationRateAction: 'journalisée par l Edge Function commission-settings',
  // invitations.ts
  inviteRestaurantOwnerAction:
    'Edge Function admin-onboarding : journal prévu par la tâche 8 du plan du lot 9 (pas encore livré)',
  // privatizationIncidents.ts
  listPrivatizationIncidentsAction:
    'Edge Function admin-privatization-incidents : journal de la liste prévu par la tâche 8 du plan du lot 9 (pas encore livré)',
  retryPrivatizationRefundAction: 'journalisée par l Edge Function admin-privatization-incidents',
  returnPrivatizationCustomerBalanceAction: 'journalisée par l Edge Function admin-privatization-incidents',
  resolvePrivatizationIncidentAction: 'journalisée par l Edge Function admin-privatization-incidents',
  // subscriptionPrices.ts
  getSubscriptionPricesAction: 'prix Stripe des abonnements, non personnels',
  updateSubscriptionPriceAction: 'journalisée par l Edge Function subscription-prices',
};

/** Retire les commentaires (bloc et fin de ligne, hors « :// » des URL). */
function stripComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
}

const EXPORT_START = /^export\s+(?:async\s+function\s+(\w+)|const\s+(\w+)\s*=\s*async\b)/;

/** Actions exportées (`export async function x` ou `export const x = async`), corps jusqu'à l'export suivant. */
function exportedActions(src: string): { name: string; body: string }[] {
  return src
    .split(/(?=^export\s)/m)
    .map((part) => ({ match: EXPORT_START.exec(part), part }))
    .filter(({ match }) => match)
    .map(({ match, part }) => ({ name: (match![1] ?? match![2])!, body: stripComments(part) }));
}

const FILES = fs.readdirSync(ACTIONS_DIR).filter((f) => f.endsWith('.ts')).sort();
const actions = FILES.flatMap((file) =>
  exportedActions(fs.readFileSync(path.join(ACTIONS_DIR, file), 'utf8')).map((a) => ({ file, ...a })));

describe('analyse des fichiers', () => {
  it('reconnaît les deux formes d export', () => {
    const src = 'export async function aAction() {}\nexport const bAction = async () => {};\nexport type T = 1;\n';
    expect(exportedActions(src).map((a) => a.name)).toEqual(['aAction', 'bAction']);
  });

  it('ignore logAdminAction( en commentaire', () => {
    const [action] = exportedActions(
      'export async function a() {\n  // logAdminAction(admin, x)\n  /* logAdminAction( */\n  return "https://x";\n}\n',
    );
    expect(action.body).not.toContain('logAdminAction(');
    expect(action.body).toContain('https://x');
  });
});

describe('Server Actions journalisées', () => {
  it('lit tous les fichiers de lib/actions', () => {
    expect(FILES).toEqual(expect.arrayContaining(['admin.ts', 'billing.ts', 'users.ts']));
    for (const file of FILES) expect(actions.filter((a) => a.file === file).length).toBeGreaterThan(0);
  });

  it('chaque exception désigne une action existante et donne sa raison', () => {
    expect(Object.keys(EXEMPT).filter((name) => !actions.some((a) => a.name === name))).toEqual([]);
    for (const reason of Object.values(EXEMPT)) expect(reason.trim().length).toBeGreaterThan(10);
  });

  it.each(actions.filter((a) => !(a.name in EXEMPT)).map((a) => [`${a.file} : ${a.name}`, a.body]))(
    '%s',
    (_label, body) => {
      expect(/\blogAdminAction\(/.test(body)).toBe(true);
    },
  );
});
