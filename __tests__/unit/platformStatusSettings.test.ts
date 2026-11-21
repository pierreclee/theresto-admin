/**
 * @jest-environment node
 *
 * Mode maintenance : saisie validée comme l'Edge Function platform-status-settings, heures de
 * Paris, état affiché (désactivée, programmée, annoncée, en cours, terminée), erreurs
 * traduites, corps transmis à la fonction, historique lu sans donnée personnelle.
 */
const invokeEdgeFunction = jest.fn();
const periodsQuery = { select: jest.fn(), order: jest.fn(), limit: jest.fn() };
const from = jest.fn();
jest.mock('@supabase/ssr', () => ({ createServerClient: jest.fn() }));
jest.mock('next/headers', () => ({ cookies: jest.fn() }));
jest.mock('@/lib/supabase/server', () => ({
  requireAdmin: jest.fn().mockResolvedValue({ id: 'admin-1' }),
  createClient: jest.fn(),
  getAdminClient: jest.fn(async () => ({ from })),
}));
jest.mock('@/lib/supabase/invokeFunction', () => ({ invokeEdgeFunction: (...a: unknown[]) => invokeEdgeFunction(...a) }));

import { requireAdmin } from '@/lib/supabase/server';
import {
  getMaintenancePeriodsAction,
  getPlatformStatusAction,
  updatePlatformStatusAction,
} from '@/lib/actions/platformStatusSettings';
import {
  announcementText,
  disableInput,
  draftFromStatus,
  formatDuration,
  isConflict,
  maintenancePhase,
  parisInputToIso,
  parseMaintenanceDraft,
  platformStatusErrorMessage,
  PLATFORM_STATUS_CONFLICT_MESSAGE,
  toParisInput,
  type MaintenanceDraft,
} from '@/lib/utils/platformStatus';
import type { PlatformStatus } from '@/lib/types/platformStatus';

const T0 = '2026-12-01T10:00:00.123456+00:00';
const NOW = new Date('2026-12-01T10:00:00Z'); // 11:00 à Paris
const HOUR = 3600 * 1000;
const at = (h: number) => new Date(NOW.getTime() + h * HOUR).toISOString();

const off: PlatformStatus = {
  enabled: false, level: 'clients', startsAt: null, endsAt: null, message: null,
  active: false, announced: false, updatedAt: T0,
};
const draft: MaintenanceDraft = {
  level: 'all', startMode: 'scheduled', startsAt: '2026-12-02T02:00', endMode: 'scheduled', endsAt: '2026-12-02T04:00',
  message: '  Migration de la base de données.  ',
};

describe('heure de Paris', () => {
  it('hiver (+1 h) et été (+2 h)', () => {
    expect(parisInputToIso('2026-12-02T02:00')).toBe('2026-12-02T01:00:00.000Z');
    expect(parisInputToIso('2026-07-01T02:00')).toBe('2026-07-01T00:00:00.000Z');
    expect(toParisInput('2026-12-02T01:00:00Z')).toBe('2026-12-02T02:00');
    expect(toParisInput('2026-07-01T00:00:00+00:00')).toBe('2026-07-01T02:00');
  });

  it('jours du changement d heure', () => {
    expect(parisInputToIso('2026-03-29T04:00')).toBe('2026-03-29T02:00:00.000Z');
    expect(parisInputToIso('2026-10-25T04:00')).toBe('2026-10-25T03:00:00.000Z');
  });

  it('valeur illisible : null', () => {
    expect(parisInputToIso('')).toBeNull();
    expect(parisInputToIso('2026-13-01T02:00')).toBeNull();
    expect(parisInputToIso('demain')).toBeNull();
    expect(toParisInput(null)).toBe('');
  });

  it('durées', () => {
    expect(formatDuration(45 * 60000)).toBe('45 min');
    expect(formatDuration(2 * HOUR)).toBe('2 h');
    expect(formatDuration(2.5 * HOUR)).toBe('2 h 30');
  });
});

describe('état', () => {
  const on = (startsAt: string, endsAt: string | null = null) => ({ ...off, enabled: true, startsAt, endsAt });
  it.each([
    ['désactivée', off, 'disabled'],
    ['activée sans début', { ...off, enabled: true }, 'disabled'],
    ['programmée à plus de 48 h', on(at(49)), 'scheduled'],
    ['annoncée (48 h au plus)', on(at(48)), 'announced'],
    ['en cours sans fin', on(at(-1)), 'active'],
    ['en cours avant la fin', on(at(-1), at(1)), 'active'],
    ['terminée (fin atteinte, exclue)', on(at(-2), at(0)), 'ended'],
  ])('%s', (_name, status, phase) => expect(maintenancePhase(status, NOW)).toBe(phase));

  it('annonce : urgence sans préavis, bandeau immédiat, ou 48 h avant', () => {
    expect(announcementText(at(0), NOW)).toContain('sans préavis');
    expect(announcementText(at(10), NOW)).toContain('dès l’enregistrement');
    expect(announcementText(at(72), NOW)).toContain('à partir du 2 déc. 2026');
  });
});

describe('saisie', () => {
  it('corps complet : dates de Paris en UTC, message nettoyé, version lue', () => {
    expect(parseMaintenanceDraft(draft, off, NOW)).toEqual({
      ok: true,
      value: {
        enabled: true, level: 'all', startsAt: '2026-12-02T01:00:00.000Z', endsAt: '2026-12-02T03:00:00.000Z',
        message: 'Migration de la base de données.', expectedUpdatedAt: T0,
      },
    });
  });

  it('« Maintenant », sans fin, message vide : début à l heure de l envoi, null', () => {
    const r = parseMaintenanceDraft({ ...draft, startMode: 'now', endMode: 'none', message: ' ' }, off, NOW);
    expect(r.ok && [r.value.startsAt, r.value.endsAt, r.value.message]).toEqual([NOW.toISOString(), null, null]);
  });

  it('maintenance en cours : début inchangé gardé à la valeur exacte du serveur (prolongation)', () => {
    const active: PlatformStatus = {
      ...off, enabled: true, level: 'all', startsAt: '2026-12-01T09:00:30.5+00:00', endsAt: at(1), active: true,
    };
    const d = draftFromStatus(active, NOW);
    expect(d).toMatchObject({ startMode: 'scheduled', startsAt: '2026-12-01T10:00', endMode: 'scheduled', level: 'all' });
    const r = parseMaintenanceDraft({ ...d, endsAt: '2026-12-01T14:00' }, active, NOW);
    expect(r.ok && [r.value.startsAt, r.value.endsAt]).toEqual(['2026-12-01T09:00:30.5+00:00', '2026-12-01T13:00:00.000Z']);
  });

  it('maintenance terminée ou désactivée : nouvelle saisie', () => {
    const ended: PlatformStatus = { ...off, enabled: true, startsAt: at(-3), endsAt: at(-1), message: 'x' };
    expect(draftFromStatus(ended, NOW)).toEqual({
      level: 'clients', startMode: 'now', startsAt: '', endMode: 'none', endsAt: '', message: '',
    });
  });

  it.each([
    [{ startsAt: '' }, 'Début'],
    [{ startsAt: '2026-12-01T09:00' }, 'Début déjà passé'],
    [{ endsAt: '' }, 'Fin'],
    [{ endsAt: '2026-12-02T02:00' }, 'après le début'],
    [{ startMode: 'now' as const, endsAt: '2026-12-01T10:30' }, 'après le début'],
    [{ message: 'x'.repeat(301) }, '300 caractères'],
  ])('%o refusé', (patch, text) => {
    const r = parseMaintenanceDraft({ ...draft, ...patch }, off, NOW);
    expect(!r.ok && r.error).toContain(text);
  });

  it('maintenance en cours : une fin déjà passée est refusée', () => {
    const active: PlatformStatus = { ...off, enabled: true, startsAt: at(-3), endsAt: at(1) };
    const r = parseMaintenanceDraft({ ...draftFromStatus(active, NOW), endsAt: '2026-12-01T10:00' }, active, NOW);
    expect(!r.ok && r.error).toContain('déjà passée');
  });

  it('désactivation : niveau, dates et message gardés', () => {
    const active: PlatformStatus = { ...off, enabled: true, level: 'all', startsAt: at(-1), endsAt: at(1), message: 'm' };
    expect(disableInput(active)).toEqual({
      enabled: false, level: 'all', startsAt: at(-1), endsAt: at(1), message: 'm', expectedUpdatedAt: T0,
    });
  });
});

describe('erreurs de l Edge Function', () => {
  it.each([
    ['permission-denied', undefined, 'nouveau code'],
    ['conflict', undefined, PLATFORM_STATUS_CONFLICT_MESSAGE],
    ['audit-log-failed', undefined, "journal d'administration"],
    ['invalid-argument', 'endsAt must be in the future when enabled', 'déjà passée'],
    ['invalid-argument', 'level must be clients or all', 'Valeurs refusées'],
    ['unauthenticated', undefined, 'Session expirée'],
    ['not-found', undefined, 'introuvable'],
    [undefined, undefined, 'a échoué'],
  ])('%s %s', (code, message, text) => expect(platformStatusErrorMessage(code, message)).toContain(text));

  it('conflit reconnu', () => {
    expect(isConflict('conflict')).toBe(true);
    expect(isConflict('failed-precondition')).toBe(true);
    expect(isConflict('audit-log-failed')).toBe(false);
  });
});

describe('actions serveur', () => {
  beforeEach(() => {
    invokeEdgeFunction.mockReset().mockResolvedValue({ ok: true, data: {} });
    from.mockReset().mockReturnValue(periodsQuery);
    periodsQuery.select.mockReturnValue(periodsQuery);
    periodsQuery.order.mockReturnValue(periodsQuery);
  });

  it('lecture : action getPlatformStatus', async () => {
    await getPlatformStatusAction();
    expect(invokeEdgeFunction).toHaveBeenCalledWith('platform-status-settings', { action: 'getPlatformStatus' });
  });

  it('modification : champs du contrat seulement, tous présents', async () => {
    const parsed = parseMaintenanceDraft({ ...draft, endMode: 'none', message: '' }, off, NOW);
    if (!parsed.ok) throw new Error(parsed.error);
    await updatePlatformStatusAction({ ...parsed.value, updatedBy: 'x', extra: 1 } as never);
    expect(invokeEdgeFunction).toHaveBeenCalledWith('platform-status-settings', {
      action: 'updatePlatformStatus', enabled: true, level: 'all', startsAt: '2026-12-02T01:00:00.000Z',
      endsAt: null, message: null, expectedUpdatedAt: T0,
    });
  });

  it('historique : colonnes sans donnée personnelle, plus récentes d abord', async () => {
    periodsQuery.limit.mockResolvedValue({
      data: [{ id: 2, level: 'all', started_at: at(-5), ended_at: at(-4) }], error: null,
    });
    await expect(getMaintenancePeriodsAction()).resolves.toEqual({
      ok: true, data: { periods: [{ id: 2, level: 'all', startedAt: at(-5), endedAt: at(-4) }] },
    });
    expect(from).toHaveBeenCalledWith('platform_maintenance_periods');
    expect(periodsQuery.select).toHaveBeenCalledWith('id, level, started_at, ended_at');
    expect(periodsQuery.order).toHaveBeenCalledWith('started_at', { ascending: false });
  });

  it('historique illisible (table absente) : refus lisible, pas d exception', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
    periodsQuery.limit.mockResolvedValue({ data: null, error: { code: '42P01', message: 'relation does not exist' } });
    await expect(getMaintenancePeriodsAction()).resolves.toMatchObject({
      ok: false, error: expect.stringContaining('indisponible'),
    });
  });

  it('refus de requireAdmin : rien n est appelé', async () => {
    (requireAdmin as jest.Mock).mockRejectedValueOnce(new Error('Unauthorized'));
    await expect(updatePlatformStatusAction(disableInput(off))).rejects.toThrow();
    (requireAdmin as jest.Mock).mockRejectedValueOnce(new Error('Unauthorized'));
    await expect(getMaintenancePeriodsAction()).rejects.toThrow();
    expect(invokeEdgeFunction).not.toHaveBeenCalled();
    expect(from).not.toHaveBeenCalled();
  });
});
