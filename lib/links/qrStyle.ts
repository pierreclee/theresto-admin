// Style du QR code d'un lien court, gardé dans short_links.qr_style (jsonb, NULL = style par
// défaut). La forme est contrôlée par la base (short_link_qr_style_valid, migration
// 20261128100000_short_link_qr_style.sql de theresto_app) : parseQrStyle applique exactement
// les mêmes règles (mêmes clés, mêmes listes, mêmes expressions), pour ne jamais écrire un style
// que la base refuserait ni dessiner un style qu'elle n'aurait pas accepté.

export const QR_MODULE_SHAPES = ['square', 'rounded', 'dots', 'diamond', 'star'] as const;
export const QR_EYE_SHAPES = ['square', 'rounded', 'circle', 'leaf'] as const;
export const QR_LOGO_KINDS = ['none', 'theresto', 'custom'] as const;

export type QrModuleShape = (typeof QR_MODULE_SHAPES)[number];
export type QrEyeShape = (typeof QR_EYE_SHAPES)[number];
export type QrLogoKind = (typeof QR_LOGO_KINDS)[number];

interface QrStyleBase {
  v: 1;
  modules: QrModuleShape;
  eyeFrame: QrEyeShape;
  eyeDot: QrEyeShape;
  /** Modules (foncés), #RRGGBB. */
  fg: string;
  /** Fond (clair), #RRGGBB. */
  bg: string;
}

/** logoPath (fichier du bucket privé qr-logos) seulement pour un logo importé. */
export type QrStyle =
  | (QrStyleBase & { logo: 'none' | 'theresto' })
  | (QrStyleBase & { logo: 'custom'; logoPath: string });

export const DEFAULT_QR_STYLE: QrStyle = Object.freeze({
  v: 1,
  modules: 'square',
  eyeFrame: 'square',
  eyeDot: 'square',
  fg: '#0F1629',
  bg: '#FFFFFF',
  logo: 'theresto',
}) as QrStyle;

const COLOR = /^#[0-9A-Fa-f]{6}$/;
const LOGO_PATH = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(svg|png|jpg)$/;
const BASE_KEYS = ['v', 'modules', 'eyeFrame', 'eyeDot', 'fg', 'bg', 'logo'];

function oneOf<T extends string>(list: readonly T[], value: unknown): value is T {
  return typeof value === 'string' && (list as readonly string[]).includes(value);
}

/** Style valide (règles de la base), ou null pour tout le reste (null compris). */
export function parseQrStyle(value: unknown): QrStyle | null {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return null;
  const o = value as Record<string, unknown>;
  const keys = Object.keys(o);
  const custom = o.logo === 'custom';
  if (keys.length !== (custom ? 8 : 7)) return null;
  if (!BASE_KEYS.every((k) => Object.prototype.hasOwnProperty.call(o, k))) return null;
  if (Object.prototype.hasOwnProperty.call(o, 'logoPath') !== custom) return null;
  if (o.v !== 1) return null;
  if (!oneOf(QR_MODULE_SHAPES, o.modules)) return null;
  if (!oneOf(QR_EYE_SHAPES, o.eyeFrame) || !oneOf(QR_EYE_SHAPES, o.eyeDot)) return null;
  if (typeof o.fg !== 'string' || !COLOR.test(o.fg)) return null;
  if (typeof o.bg !== 'string' || !COLOR.test(o.bg)) return null;
  if (!oneOf(QR_LOGO_KINDS, o.logo)) return null;
  const base: QrStyleBase = { v: 1, modules: o.modules, eyeFrame: o.eyeFrame, eyeDot: o.eyeDot, fg: o.fg, bg: o.bg };
  if (o.logo === 'custom') {
    if (typeof o.logoPath !== 'string' || !LOGO_PATH.test(o.logoPath)) return null;
    return { ...base, logo: 'custom', logoPath: o.logoPath };
  }
  return { ...base, logo: o.logo };
}

/** Style de la colonne, ou le style par défaut (NULL ou valeur refusée). */
export function qrStyleOrDefault(value: unknown): QrStyle {
  return parseQrStyle(value) ?? DEFAULT_QR_STYLE;
}
