// Statistiques des liens courts (P10) : agrégats de public.link_visit_daily, calculés ici.
// Scans seulement, jamais des installations (celles-ci se lisent dans App Store Connect et
// la Play Console). Aucune donnée personnelle : jour, plateforme, pays, attributs du lien.

export const STATS_PERIODS = [30, 90] as const;
export type StatsPeriod = (typeof STATS_PERIODS)[number];

export function isStatsPeriod(value: unknown): value is StatsPeriod {
  return STATS_PERIODS.includes(value as StatsPeriod);
}

export const PLATFORMS = ['ios', 'android', 'desktop', 'other'] as const;
export type LinkPlatform = (typeof PLATFORMS)[number];

export const PLATFORM_LABELS: Record<LinkPlatform, string> = {
  ios: 'iPhone / iPad',
  android: 'Android',
  desktop: 'Ordinateur',
  other: 'Autre',
};

/** Ligne de link_visit_daily (colonnes lues). */
export interface LinkVisitRow {
  link_id: string | null;
  day: string;
  platform: string;
  country: string;
  src: string;
  ville: string;
  persona: string;
  hits: number | string;
  bot_hits: number | string;
}

export const LINK_VISIT_COLUMNS = 'link_id, day, platform, country, src, ville, persona, hits, bot_hits';

const PARIS_DAY = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Europe/Paris', year: 'numeric', month: '2-digit', day: '2-digit',
});

/** Jour de Paris (« AAAA-MM-JJ ») de l'instant donné, comme la colonne day. */
export function parisDay(instant: Date): string {
  return PARIS_DAY.format(instant);
}

/** Jour « AAAA-MM-JJ » décalé de `delta` jours (calendrier, sans fuseau). */
export function addDays(day: string, delta: number): string {
  const [y, m, d] = day.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + delta)).toISOString().slice(0, 10);
}

/** Premier jour inclus d'une période de `days` jours finissant aujourd'hui (Paris). */
export function periodStart(days: number, now: Date = new Date()): string {
  return addDays(parisDay(now), -(days - 1));
}

const count = (value: number | string): number => {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : 0;
};

export interface CountEntry {
  key: string;
  hits: number;
}

export interface LinkStats {
  /** Un point par jour de la période, jours sans scan compris. */
  byDay: { day: string; hits: number; botHits: number }[];
  byPlatform: { platform: LinkPlatform; hits: number }[];
  byCountry: CountEntry[];
  totalHits: number;
  totalBotHits: number;
  /** Part des robots, aperçus et préchargements parmi toutes les requêtes comptées (0 à 1). */
  botShare: number;
}

function sortedEntries(map: Map<string, number>): CountEntry[] {
  return [...map.entries()]
    .map(([key, hits]) => ({ key, hits }))
    .sort((a, b) => b.hits - a.hits || a.key.localeCompare(b.key));
}

/** Agrège les lignes d'un lien sur [start, end] (jours de Paris inclus). */
export function aggregateLinkStats(rows: LinkVisitRow[], start: string, end: string): LinkStats {
  const days = new Map<string, { hits: number; botHits: number }>();
  for (let day = start; day <= end; day = addDays(day, 1)) days.set(day, { hits: 0, botHits: 0 });
  const platforms = new Map<LinkPlatform, number>(PLATFORMS.map((p) => [p, 0]));
  const countries = new Map<string, number>();
  let totalHits = 0;
  let totalBotHits = 0;

  for (const row of rows) {
    const day = days.get(row.day);
    if (!day) continue;
    const hits = count(row.hits);
    const botHits = count(row.bot_hits);
    day.hits += hits;
    day.botHits += botHits;
    totalHits += hits;
    totalBotHits += botHits;
    const platform = (PLATFORMS as readonly string[]).includes(row.platform) ? (row.platform as LinkPlatform) : 'other';
    platforms.set(platform, (platforms.get(platform) ?? 0) + hits);
    if (hits > 0) countries.set(row.country || '--', (countries.get(row.country || '--') ?? 0) + hits);
  }

  const all = totalHits + totalBotHits;
  return {
    byDay: [...days.entries()].map(([day, v]) => ({ day, ...v })),
    byPlatform: PLATFORMS.map((platform) => ({ platform, hits: platforms.get(platform) ?? 0 })),
    byCountry: sortedEntries(countries),
    totalHits,
    totalBotHits,
    botShare: all === 0 ? 0 : totalBotHits / all,
  };
}

/** Scans (hors robots) par lien ; clé '' pour les liens inconnus (link_id NULL). */
export function hitsByLink(rows: LinkVisitRow[]): Map<string, number> {
  const map = new Map<string, number>();
  for (const row of rows) {
    const key = row.link_id ?? '';
    map.set(key, (map.get(key) ?? 0) + count(row.hits));
  }
  return map;
}

export type OverviewDimension = 'persona' | 'ville' | 'campaign';

export interface LinksOverview {
  totalHits: number;
  totalBotHits: number;
  unknownHits: number;
  byPersona: CountEntry[];
  byVille: CountEntry[];
  byCampaign: CountEntry[];
}

/** Libellé des valeurs vides d'un regroupement. */
export const NONE_KEY = '(aucune)';

/**
 * Vue d'ensemble : persona et ville d'après la ligne (attributs du lien, sinon de la requête),
 * campagne d'après le lien (`campaignByLink`). Les scans d'un lien inconnu sont comptés à part.
 */
export function aggregateOverview(rows: LinkVisitRow[], campaignByLink: Map<string, string | null>): LinksOverview {
  const persona = new Map<string, number>();
  const ville = new Map<string, number>();
  const campaign = new Map<string, number>();
  let totalHits = 0;
  let totalBotHits = 0;
  let unknownHits = 0;
  const add = (map: Map<string, number>, key: string | null | undefined, hits: number) =>
    map.set(key || NONE_KEY, (map.get(key || NONE_KEY) ?? 0) + hits);

  for (const row of rows) {
    const hits = count(row.hits);
    totalHits += hits;
    totalBotHits += count(row.bot_hits);
    if (row.link_id === null) {
      unknownHits += hits;
      continue;
    }
    if (hits === 0) continue;
    add(persona, row.persona, hits);
    add(ville, row.ville, hits);
    add(campaign, campaignByLink.get(row.link_id) ?? null, hits);
  }
  return {
    totalHits,
    totalBotHits,
    unknownHits,
    byPersona: sortedEntries(persona),
    byVille: sortedEntries(ville),
    byCampaign: sortedEntries(campaign),
  };
}

// ─── Export CSV ─────────────────────────────────────────────────────────────

export const CSV_HEADER = ['day', 'slug', 'platform', 'country', 'src', 'ville', 'persona', 'hits', 'bot_hits'];

/** Cellule CSV : guillemets si besoin, et neutralisation des formules de tableur (= + - @). */
export function csvCell(value: string | number | null | undefined): string {
  let text = value === null || value === undefined ? '' : String(value);
  if (typeof value === 'string' && /^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return /[",;\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/**
 * CSV des agrégats (une ligne par ligne de link_visit_daily, slug joint ; lien inconnu :
 * slug vide). Séparateur virgule, fins de ligne CRLF (RFC 4180).
 */
export function linkStatsCsv(rows: LinkVisitRow[], slugByLink: Map<string, string>): string {
  const sorted = [...rows].sort((a, b) =>
    a.day.localeCompare(b.day)
    || (a.link_id ? slugByLink.get(a.link_id) ?? '' : '').localeCompare(b.link_id ? slugByLink.get(b.link_id) ?? '' : '')
    || a.platform.localeCompare(b.platform)
    || a.country.localeCompare(b.country));
  const lines = [CSV_HEADER.join(',')];
  for (const row of sorted) {
    lines.push([
      row.day,
      row.link_id ? slugByLink.get(row.link_id) ?? '' : '',
      row.platform,
      row.country,
      row.src,
      row.ville,
      row.persona,
      count(row.hits),
      count(row.bot_hits),
    ].map(csvCell).join(','));
  }
  return `${lines.join('\r\n')}\r\n`;
}
