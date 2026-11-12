/**
 * @jest-environment node
 *
 * Statistiques des liens courts (P10) : agrégats de link_visit_daily, période en jours de
 * Paris, vue d'ensemble et export CSV (agrégats seulement, formules de tableur neutralisées).
 */
import {
  addDays,
  aggregateLinkStats,
  aggregateOverview,
  CSV_HEADER,
  csvCell,
  hitsByLink,
  isStatsPeriod,
  linkStatsCsv,
  NONE_KEY,
  parisDay,
  periodStart,
  type LinkVisitRow,
} from '@/lib/links/linkStats';

const row = (patch: Partial<LinkVisitRow>): LinkVisitRow => ({
  link_id: 'l1', day: '2026-11-10', platform: 'ios', country: 'FR', src: '', ville: '', persona: '',
  hits: 1, bot_hits: 0, ...patch,
});

describe('jours de Paris', () => {
  it('jour de Paris, pas d UTC', () => {
    expect(parisDay(new Date('2026-11-10T23:30:00Z'))).toBe('2026-11-11');
    expect(parisDay(new Date('2026-07-10T21:59:00Z'))).toBe('2026-07-10');
  });

  it('période de 30 jours, aujourd hui compris', () => {
    expect(periodStart(30, new Date('2026-11-12T10:00:00Z'))).toBe('2026-10-14');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
  });

  it('périodes 30 et 90 seulement', () => {
    expect(isStatsPeriod(30)).toBe(true);
    expect(isStatsPeriod(90)).toBe(true);
    expect(isStatsPeriod(365)).toBe(false);
    expect(isStatsPeriod('30')).toBe(false);
  });
});

describe('aggregateLinkStats', () => {
  const rows = [
    row({ day: '2026-11-10', platform: 'ios', country: 'FR', hits: 3, bot_hits: 1 }),
    row({ day: '2026-11-10', platform: 'android', country: 'BE', hits: '2', bot_hits: '0' }),
    row({ day: '2026-11-12', platform: 'desktop', country: '--', hits: 1, bot_hits: 4 }),
    row({ day: '2026-11-01', hits: 100 }), // hors période
  ];
  const stats = aggregateLinkStats(rows, '2026-11-10', '2026-11-12');

  it('un point par jour, jours vides compris', () => {
    expect(stats.byDay).toEqual([
      { day: '2026-11-10', hits: 5, botHits: 1 },
      { day: '2026-11-11', hits: 0, botHits: 0 },
      { day: '2026-11-12', hits: 1, botHits: 4 },
    ]);
  });

  it('plateformes, pays, part des robots', () => {
    expect(stats.byPlatform).toEqual([
      { platform: 'ios', hits: 3 }, { platform: 'android', hits: 2 },
      { platform: 'desktop', hits: 1 }, { platform: 'other', hits: 0 },
    ]);
    expect(stats.byCountry).toEqual([{ key: 'FR', hits: 3 }, { key: 'BE', hits: 2 }, { key: '--', hits: 1 }]);
    expect(stats.totalHits).toBe(6);
    expect(stats.totalBotHits).toBe(5);
    expect(stats.botShare).toBeCloseTo(5 / 11);
  });

  it('aucune ligne : part de robots nulle', () => {
    expect(aggregateLinkStats([], '2026-11-10', '2026-11-10').botShare).toBe(0);
  });
});

describe('vue d ensemble', () => {
  it('groupée par persona, ville, campagne ; lien inconnu à part', () => {
    const rows = [
      row({ link_id: 'l1', persona: 'client', ville: 'lyon', hits: 4 }),
      row({ link_id: 'l2', persona: 'pro', ville: '', hits: 2, bot_hits: 3 }),
      row({ link_id: null, hits: 5 }),
    ];
    const o = aggregateOverview(rows, new Map([['l1', 'salon'], ['l2', null]]));
    expect(o.totalHits).toBe(11);
    expect(o.unknownHits).toBe(5);
    expect(o.totalBotHits).toBe(3);
    expect(o.byPersona).toEqual([{ key: 'client', hits: 4 }, { key: 'pro', hits: 2 }]);
    expect(o.byVille).toEqual([{ key: 'lyon', hits: 4 }, { key: NONE_KEY, hits: 2 }]);
    expect(o.byCampaign).toEqual([{ key: 'salon', hits: 4 }, { key: NONE_KEY, hits: 2 }]);
  });

  it('scans par lien (lien inconnu : clé vide)', () => {
    const m = hitsByLink([row({ hits: 2 }), row({ hits: 3, bot_hits: 9 }), row({ link_id: null, hits: 1 })]);
    expect(m.get('l1')).toBe(5);
    expect(m.get('')).toBe(1);
  });
});

describe('CSV', () => {
  it('en-tête, slug joint, tri par jour, CRLF', () => {
    const csv = linkStatsCsv(
      [row({ day: '2026-11-11', hits: 2 }), row({ day: '2026-11-10', link_id: null, platform: 'other', country: '--' })],
      new Map([['l1', 'telecharger']]),
    );
    expect(csv).toBe(
      `${CSV_HEADER.join(',')}\r\n`
      // Pays inconnu « -- » : préfixé, comme toute cellule qui commence par « - ».
      + "2026-11-10,,other,'--,,,,1,0\r\n"
      + '2026-11-11,telecharger,ios,FR,,,,2,0\r\n',
    );
  });

  it('cellules : guillemets et formules neutralisées', () => {
    expect(csvCell('a,b')).toBe('"a,b"');
    expect(csvCell('a"b')).toBe('"a""b"');
    expect(csvCell('=HYPERLINK("x")')).toBe('"\'=HYPERLINK(""x"")"');
    expect(csvCell('-1')).toBe("'-1");
    expect(csvCell(-1)).toBe('-1');
    expect(csvCell(null)).toBe('');
  });
});
