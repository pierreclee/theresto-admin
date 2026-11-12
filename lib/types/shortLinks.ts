import type { ShortLinkForwardParams, ShortLinkKind, ShortLinkPersona } from '@/lib/links/shortLinkRules';
import type { LinkStats, LinksOverview, StatsPeriod } from '@/lib/links/linkStats';

/** Lien court (public.short_links), tel qu'affiché par l'admin. */
export interface ShortLink {
  id: string;
  slug: string;
  label: string | null;
  kind: ShortLinkKind;
  targetDefault: string;
  targetIos: string | null;
  targetAndroid: string | null;
  forwardParams: ShortLinkForwardParams;
  src: string | null;
  ville: string | null;
  persona: ShortLinkPersona | null;
  campaign: string | null;
  active: boolean;
  expiresAt: string | null;
  createdAt: string;
  updatedAt: string;
}

/** Saisie de l'écran (champs texte vides = null). */
export interface ShortLinkFormValues {
  slug: string;
  label: string | null;
  kind: ShortLinkKind;
  targetDefault: string;
  targetIos: string | null;
  targetAndroid: string | null;
  forwardParams: ShortLinkForwardParams;
  src: string | null;
  ville: string | null;
  persona: ShortLinkPersona | null;
  campaign: string | null;
  expiresAt: string | null;
}

export interface ShortLinkSettings {
  appStoreUrl: string | null;
  playStoreUrl: string | null;
  appStoreProviderToken: string | null;
  updatedAt: string;
}

export interface ShortLinksPage {
  links: (ShortLink & { scans30d: number })[];
  settings: ShortLinkSettings | null;
  /** go.theresto.fr ou go-staging.theresto.fr, selon l'environnement du serveur. */
  domain: string;
  /** Scans des 30 derniers jours vers un lien inconnu (slug inexistant, jamais gardé). */
  unknownScans30d: number;
  /** Lecture des compteurs incomplète (plafond de pages atteint). */
  truncated: boolean;
}

export interface ShortLinkDetail {
  link: ShortLink;
  domain: string;
}

export interface ShortLinkStatsResult {
  days: StatsPeriod;
  start: string;
  end: string;
  stats: LinkStats;
  truncated: boolean;
}

export interface ShortLinksOverviewResult {
  days: StatsPeriod;
  start: string;
  end: string;
  overview: LinksOverview;
  truncated: boolean;
}
