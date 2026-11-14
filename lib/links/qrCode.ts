// Générateur de QR codes des liens courts (P10), entièrement dans le navigateur : librairie
// qrcode (MIT) pour la matrice, dessin SVG ici, PDF par pdf-lib (MIT). Aucun service tiers.
//
// PDF : lib/links/qrPdf.ts, chargé à la demande (pdf-lib est lourd). Style enregistré :
// lib/links/qrStyle.ts.
//
// Règles : le QR encode toujours https://<domaine>/<slug> (shortLinkUrl) ; zone de silence de
// 4 modules ; modules foncés sur fond clair, contraste d'au moins 4:1 (checkQrColors) ;
// correction d'erreur H dès qu'il y a un logo, M sinon.
//
// Dessin : les 3 motifs de repérage (7×7 aux coins) sont dessinés à part, cadre (anneau 7×7
// d'épaisseur 1, fill-rule evenodd) et point (3×3) chacun dans sa forme ; les modules
// ordinaires ne les redessinent jamais. Les motifs d'alignement (5×5) sont dessinés de même,
// d'une pièce, dans les formes du cadre et du point : faits de points ou d'étoiles séparés,
// des lecteurs ne les retrouvent plus sur les grands codes. Les autres modules (timing
// compris) prennent la forme choisie, centrés sur leur case (c'est le centre que lisent les
// lecteurs).
//
// Lisibilité vérifiée par rendu (resvg) et décodage (ZXing pour tous les cas, jsQR pour les
// repères de même forme) : __tests__/unit/qrReadability.test.ts.
//
// Zone du logo : un disque centré sur le code, de rayon R (en modules).
//   - Un module est effacé si son centre est dans le disque (distance ≤ R) ; le disque, de la
//     couleur du fond, est dessiné par-dessus, ce qui donne un bord rond net.
//   - R visé : 17 % du côté du code (≈ 9 % des modules effacés) ; il ne dépasse jamais
//     (côté/2 − 7) − 0,5, pour ne toucher ni la ligne ni la colonne de timing (6), ni
//     √2·(côté/2 − 8) − 0,5, pour ne toucher aucun carré de 8×8 aux coins (repère + séparateur).
//   - Règle des 20 % : le nombre de modules effacés (clairs ou foncés, comptés un à un) reste
//     au plus 20 % des modules du code ; sinon R diminue d'un quart de module jusqu'à y être.
//   - Le logo est inscrit dans un carré centré de côté 1,06·R (ses coins à 75 % du rayon) :
//     marge d'au moins 0,47·R entre le logo et les modules, contre un demi-module avant.
//   - Le logo (SVG ou image) est découpé au disque (clipPath) : un logo importé qui
//     déborderait de son viewBox ne peut pas recouvrir les modules.

import { create } from 'qrcode';
import type { QrEyeShape, QrModuleShape } from './qrStyle';
import { sanitizeSvgLogo } from './svgSanitize';

export const QUIET_ZONE_MODULES = 4;
/** Part maximale des modules du code effacés sous le logo. */
export const MAX_LOGO_AREA = 0.2;
/** Rayon visé du disque du logo, en part du côté du code. */
export const LOGO_RADIUS_RATIO = 0.17;
/** Côté du carré du logo, en part du rayon du disque. */
export const LOGO_SIDE_IN_RADIUS = 1.06;
/** Écart minimal, en modules, entre le disque et les zones protégées (repères, timing). */
const LOGO_GUARD = 0.5;
export const MIN_CONTRAST = 4;
/** Taille maximale d'un logo importé (octets décodés), comme le bucket qr-logos. */
export const MAX_LOGO_BYTES = 512 * 1024;

export type QrErrorCorrection = 'L' | 'M' | 'Q' | 'H';

export interface QrLogoZone {
  /** Centre du disque (même valeur sur les deux axes), en modules depuis le bord du code. */
  center: number;
  /** Rayon du disque, en modules. */
  radius: number;
  /** Côté du carré où le logo est inscrit, en modules. */
  side: number;
  /** Nombre de modules effacés (centre dans le disque). */
  erased: number;
}

export interface QrMatrix {
  /** Côté du code en modules (sans la zone de silence). */
  size: number;
  /** dark[ligne][colonne], modules sous le logo effacés. */
  dark: boolean[][];
  errorCorrection: QrErrorCorrection;
  /** Zone du logo, ou null. */
  logo: QrLogoZone | null;
}

function cellInDisk(r: number, c: number, center: number, radius: number): boolean {
  const dx = c + 0.5 - center;
  const dy = r + 0.5 - center;
  return dx * dx + dy * dy <= radius * radius;
}

function countInDisk(size: number, center: number, radius: number): number {
  let n = 0;
  for (let r = 0; r < size; r += 1) {
    for (let c = 0; c < size; c += 1) if (cellInDisk(r, c, center, radius)) n += 1;
  }
  return n;
}

/** Matrice du QR de `text` ; avec logo, correction H et modules du disque central effacés. */
export function buildQrMatrix(text: string, options: { withLogo: boolean }): QrMatrix {
  const errorCorrection: QrErrorCorrection = options.withLogo ? 'H' : 'M';
  const qr = create(text, { errorCorrectionLevel: errorCorrection });
  const size = qr.modules.size;
  const dark: boolean[][] = [];
  for (let r = 0; r < size; r += 1) {
    const row: boolean[] = [];
    for (let c = 0; c < size; c += 1) row.push(Boolean(qr.modules.get(r, c)));
    dark.push(row);
  }

  let logo: QrLogoZone | null = null;
  if (options.withLogo) {
    const center = size / 2;
    let radius = Math.min(
      size * LOGO_RADIUS_RATIO,
      center - 7 - LOGO_GUARD,
      Math.SQRT2 * (center - 8) - LOGO_GUARD,
    );
    let erased = countInDisk(size, center, radius);
    while (radius > 0.25 && erased > MAX_LOGO_AREA * size * size) {
      radius -= 0.25;
      erased = countInDisk(size, center, radius);
    }
    for (let r = 0; r < size; r += 1) {
      for (let c = 0; c < size; c += 1) if (cellInDisk(r, c, center, radius)) dark[r][c] = false;
    }
    logo = { center, radius, side: radius * LOGO_SIDE_IN_RADIUS, erased };
  }
  return { size, dark, errorCorrection, logo };
}

/** Part des modules du code effacés sous le logo (0 sans logo). */
export function logoAreaRatio(matrix: QrMatrix): number {
  return matrix.logo ? matrix.logo.erased / (matrix.size * matrix.size) : 0;
}

// ─── Couleurs ───────────────────────────────────────────────────────────────

const HEX_COLOR = /^#([0-9a-f]{6})$/i;

export function parseHexColor(color: string): [number, number, number] | null {
  const m = HEX_COLOR.exec(color.trim());
  if (!m) return null;
  const n = parseInt(m[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** Luminance relative (WCAG 2). */
export function relativeLuminance([r, g, b]: [number, number, number]): number {
  const lin = (v: number) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

export function contrastRatio(a: string, b: string): number | null {
  const ca = parseHexColor(a);
  const cb = parseHexColor(b);
  if (!ca || !cb) return null;
  const la = relativeLuminance(ca);
  const lb = relativeLuminance(cb);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

export type ColorCheck = { ok: true; ratio: number } | { ok: false; ratio: number | null; error: string };

/** Modules foncés sur fond clair, contraste d'au moins 4:1 (sinon des lecteurs échouent). */
export function checkQrColors(darkColor: string, lightColor: string): ColorCheck {
  const dark = parseHexColor(darkColor);
  const light = parseHexColor(lightColor);
  if (!dark || !light) return { ok: false, ratio: null, error: 'Couleur invalide : format #RRVVBB attendu.' };
  const ratio = contrastRatio(darkColor, lightColor)!;
  if (relativeLuminance(dark) >= relativeLuminance(light)) {
    return { ok: false, ratio, error: 'Le fond doit être plus clair que les modules (QR inversé refusé).' };
  }
  if (ratio < MIN_CONTRAST) {
    return { ok: false, ratio, error: `Contraste insuffisant (${ratio.toFixed(1)}:1, 4:1 au moins).` };
  }
  return { ok: true, ratio };
}

// ─── Logos ──────────────────────────────────────────────────────────────────

export type RasterMime = 'image/png' | 'image/jpeg';

/** Logo du QR : SVG (filtré, recopié dans le QR) ou image PNG / JPEG embarquée en base64. */
export type LogoSource =
  | { kind: 'svg'; markup: string }
  | { kind: 'raster'; mime: RasterMime; base64: string };

/** Octets magiques : PNG 89 50 4E 47, JPEG FF D8 FF. */
export function rasterMimeOf(bytes: ArrayLike<number>): RasterMime | null {
  if (bytes.length >= 4 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) {
    return 'image/png';
  }
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'image/jpeg';
  return null;
}

/** Base64 strict : alphabet standard, longueur multiple de 4, « = » seulement à la fin. */
const BASE64 = /^[A-Za-z0-9+/]+={0,2}$/;

/** Message de refus d'une image embarquée, ou null si elle est acceptée. */
export function rasterLogoError(mime: string, base64: string): string | null {
  if (mime !== 'image/png' && mime !== 'image/jpeg') return 'Logo refusé : PNG ou JPEG attendu.';
  if (typeof base64 !== 'string' || base64.length % 4 !== 0 || !BASE64.test(base64)) {
    return 'Logo refusé : contenu illisible.';
  }
  const padding = base64.endsWith('==') ? 2 : base64.endsWith('=') ? 1 : 0;
  if ((base64.length / 4) * 3 - padding > MAX_LOGO_BYTES) return 'Logo trop lourd : 512 Kio au plus.';
  const head = atob(base64.slice(0, 8));
  const magic = Array.from(head, (ch) => ch.charCodeAt(0));
  if (rasterMimeOf(magic) !== mime) return 'Logo refusé : le contenu ne correspond pas au format annoncé.';
  return null;
}

export function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

/**
 * Filtre d'un logo SVG (intégré ou importé) : liste blanche après analyse XML
 * (lib/links/svgSanitize.ts). Renvoie le contenu de la racine, ids préfixés par `idPrefix`, et
 * son viewBox, ou lève une erreur en français.
 */
export function sanitizeLogoSvg(
  logoSvg: string,
  idPrefix?: string,
): { inner: string; viewBox: [number, number, number, number] } {
  return sanitizeSvgLogo(logoSvg, idPrefix);
}

/** Numéro unique des ids posés dans un QR (logo, découpe) : plusieurs QR peuvent cohabiter dans une page. */
let idSequence = 0;
function nextIdNumber(): number {
  idSequence += 1;
  return idSequence;
}

// ─── SVG ────────────────────────────────────────────────────────────────────

/** Arrondi court pour les attributs (évite 0.30000000000000004). */
function fmt(n: number): string {
  return String(Math.round(n * 1e6) / 1e6);
}

/**
 * Place le logo SVG dans le QR : x, y, côté en unités de module.
 * Le contenu du logo est recopié dans un `<g transform="translate(…) scale(…)">`, jamais dans
 * un `<svg x y>` imbriqué : MuPDF et des logiciels d'imprimeur ignorent x/y d'un `<svg>`
 * imbriqué et posent alors le logo en haut à gauche, sur un motif de repérage (QR illisible).
 * Mise à l'échelle uniforme et centrée, comme le `xMidYMid meet` par défaut du viewBox.
 */
export function placeLogoSvg(
  logoSvg: string,
  x: number,
  y: number,
  side: number,
  idPrefix = `lg-${nextIdNumber()}-`,
): string {
  const { inner, viewBox: [minX, minY, w, h] } = sanitizeLogoSvg(logoSvg, idPrefix);
  const scale = side / Math.max(w, h);
  const tx = x + (side - w * scale) / 2 - minX * scale;
  const ty = y + (side - h * scale) / 2 - minY * scale;
  return `<g transform="translate(${fmt(tx)} ${fmt(ty)}) scale(${fmt(scale)})">${inner}</g>`;
}

/**
 * Place une image PNG / JPEG embarquée : seule exception à l'interdiction de href, un
 * `data:image/png|jpeg;base64,…` contrôlé (base64 strict, octets magiques, 512 Kio au plus).
 */
export function placeLogoRaster(mime: RasterMime, base64: string, x: number, y: number, side: number): string {
  const error = rasterLogoError(mime, base64);
  if (error) throw new Error(error);
  return `<image x="${fmt(x)}" y="${fmt(y)}" width="${fmt(side)}" height="${fmt(side)}" `
    + `preserveAspectRatio="xMidYMid meet" href="data:${mime};base64,${base64}"/>`;
}

/** Rectangle à coins arrondis (rayons tl, tr, br, bl), sens horaire ; rayon 0 = coin droit. */
function roundedRect(x: number, y: number, w: number, h: number, [tl, tr, br, bl]: number[]): string {
  const arc = (r: number, ex: number, ey: number) => (r > 0 ? `A${fmt(r)} ${fmt(r)} 0 0 1 ${fmt(ex)} ${fmt(ey)}` : '');
  return `M${fmt(x + tl)} ${fmt(y)}H${fmt(x + w - tr)}${arc(tr, x + w, y + tr)}`
    + `V${fmt(y + h - br)}${arc(br, x + w - br, y + h)}`
    + `H${fmt(x + bl)}${arc(bl, x, y + h - bl)}`
    + `V${fmt(y + tl)}${arc(tl, x + tl, y)}Z`;
}

type Corner = 'tl' | 'tr' | 'bl';

/**
 * Rayons des coins (tl, tr, br, bl) d'un carré de côté `side`, pour une forme de repère.
 * `rounded` et `leaf` : rayon donné (arrondi modéré ; feuille très arrondie). Feuille : deux
 * coins opposés arrondis, les deux autres droits, le coin droit tourné vers le centre du code.
 */
function shapeRadii(shape: QrEyeShape, side: number, rounded: number, leaf: number, corner: Corner): number[] {
  switch (shape) {
    case 'square':
      return [0, 0, 0, 0];
    case 'rounded':
      return [rounded, rounded, rounded, rounded];
    case 'circle':
      return [side / 2, side / 2, side / 2, side / 2];
    case 'leaf': {
      return corner === 'tl' ? [0, leaf, 0, leaf] : [leaf, 0, leaf, 0];
    }
  }
}

function isFinderCell(r: number, c: number, size: number): boolean {
  return (r < 7 && c < 7) || (r < 7 && c >= size - 7) || (r >= size - 7 && c < 7);
}

/** Centres des motifs d'alignement (norme ISO 18004, annexe E), hors motifs de repérage. */
export function alignmentCenters(size: number): [number, number][] {
  const version = (size - 17) / 4;
  if (version < 2) return [];
  const count = Math.floor(version / 7) + 2;
  const step = size === 145 ? 26 : Math.ceil((size - 13) / (2 * count - 2)) * 2;
  const positions = [size - 7];
  for (let i = 1; i < count - 1; i += 1) positions.push(positions[i - 1] - step);
  positions.push(6);
  positions.reverse();
  const centers: [number, number][] = [];
  for (const r of positions) {
    for (const c of positions) {
      if ((r === 6 && c === 6) || (r === 6 && c === size - 7) || (r === size - 7 && c === 6)) continue;
      centers.push([r, c]);
    }
  }
  return centers;
}

/**
 * Motifs de repérage (cadre 7×7 et son creux 5×5 en evenodd, point 3×3) et d'alignement
 * (cadre 5×5, creux 3×3, point 1×1) dessinés d'une pièce, dans les formes du cadre et du
 * point. Un motif d'alignement qui touche le disque du logo reste en modules ordinaires.
 */
function eyesPaths(matrix: QrMatrix, q: number, frame: QrEyeShape, dot: QrEyeShape) {
  const { size } = matrix;
  const origins: [number, number, Corner][] = [[0, 0, 'tl'], [0, size - 7, 'tr'], [size - 7, 0, 'bl']];
  let frames = '';
  let dots = '';
  for (const [r, c, corner] of origins) {
    const x = c + q;
    const y = r + q;
    frames += roundedRect(x, y, 7, 7, shapeRadii(frame, 7, 2, 3, corner));
    frames += roundedRect(x + 1, y + 1, 5, 5, shapeRadii(frame, 5, 1, 2, corner));
    dots += roundedRect(x + 2, y + 2, 3, 3, shapeRadii(dot, 3, 0.75, 1.3, corner));
  }
  const aligned = new Set<string>();
  for (const [r, c] of alignmentCenters(size)) {
    if (matrix.logo && Math.hypot(c + 0.5 - matrix.logo.center, r + 0.5 - matrix.logo.center) < matrix.logo.radius + 3.6) continue;
    // Garde-fou : le motif dessiné doit être celui de la matrice (anneau foncé, creux, centre).
    let matches = true;
    for (let dr = -2; dr <= 2; dr += 1) {
      for (let dc = -2; dc <= 2; dc += 1) {
        const ring = Math.max(Math.abs(dr), Math.abs(dc));
        if (matrix.dark[r + dr]?.[c + dc] !== (ring !== 1)) matches = false;
      }
    }
    if (!matches) continue;
    for (let dr = -2; dr <= 2; dr += 1) for (let dc = -2; dc <= 2; dc += 1) aligned.add(`${r + dr},${c + dc}`);
    const x = c - 2 + q;
    const y = r - 2 + q;
    frames += roundedRect(x, y, 5, 5, shapeRadii(frame, 5, 1.4, 2.1, 'tl'));
    frames += roundedRect(x + 1, y + 1, 3, 3, shapeRadii(frame, 3, 0.4, 1.1, 'tl'));
    dots += roundedRect(x + 2, y + 2, 1, 1, shapeRadii(dot, 1, 0.25, 0.45, 'tl'));
  }
  return { frames, dots, aligned };
}

/** Demi-diagonale du losange : un peu plus que le losange inscrit (0,5), pour rester lisible. */
const DIAMOND_HALF = 0.56;
/** Étoile à 4 branches : pointes à 0,6, creux à 0,32 du centre (≈ moitié de la case). */
const STAR_OUTER = 0.6;
const STAR_INNER = 0.32;
/** Rayon des points (diamètre 0,9). */
const DOT_RADIUS = 0.45;

function modulesPath(matrix: QrMatrix, q: number, shape: QrModuleShape, skip: Set<string>): string {
  const { size } = matrix;
  const on = (r: number, c: number) =>
    r >= 0 && c >= 0 && r < size && c < size && matrix.dark[r][c] && !isFinderCell(r, c, size) && !skip.has(`${r},${c}`);
  const parts: string[] = [];
  if (shape === 'square') {
    // Suites horizontales de modules foncés : un tracé compact.
    for (let r = 0; r < size; r += 1) {
      let c = 0;
      while (c < size) {
        if (!on(r, c)) { c += 1; continue; }
        const startCol = c;
        while (c < size && on(r, c)) c += 1;
        parts.push(`M${startCol + q} ${r + q}h${c - startCol}v1h-${c - startCol}z`);
      }
    }
    return parts.join('');
  }
  for (let r = 0; r < size; r += 1) {
    for (let c = 0; c < size; c += 1) {
      if (!on(r, c)) continue;
      const x = c + q;
      const y = r + q;
      const cx = x + 0.5;
      const cy = y + 0.5;
      if (shape === 'rounded') {
        // « Liquide » : coin arrondi seulement s'il n'a aucun voisin foncé de ses deux côtés ;
        // les modules voisins se touchent et se fondent en une seule forme.
        const up = on(r - 1, c);
        const down = on(r + 1, c);
        const left = on(r, c - 1);
        const right = on(r, c + 1);
        const k = 0.5;
        parts.push(roundedRect(x, y, 1, 1, [
          !up && !left ? k : 0, !up && !right ? k : 0, !down && !right ? k : 0, !down && !left ? k : 0,
        ]));
      } else if (shape === 'dots') {
        const d = DOT_RADIUS;
        parts.push(`M${fmt(cx - d)} ${fmt(cy)}a${d} ${d} 0 1 1 ${fmt(2 * d)} 0a${d} ${d} 0 1 1 ${fmt(-2 * d)} 0z`);
      } else if (shape === 'diamond') {
        const d = DIAMOND_HALF;
        parts.push(`M${fmt(cx)} ${fmt(cy - d)}L${fmt(cx + d)} ${fmt(cy)}L${fmt(cx)} ${fmt(cy + d)}L${fmt(cx - d)} ${fmt(cy)}z`);
      } else {
        const pts: string[] = [];
        for (let i = 0; i < 8; i += 1) {
          const a = (-90 + i * 45) * (Math.PI / 180);
          const rad = i % 2 === 0 ? STAR_OUTER : STAR_INNER;
          pts.push(`${fmt(cx + rad * Math.cos(a))} ${fmt(cy + rad * Math.sin(a))}`);
        }
        parts.push(`M${pts.join('L')}z`);
      }
    }
  }
  return parts.join('');
}

export interface QrSvgOptions {
  darkColor: string;
  lightColor: string;
  /** Formes : carrées par défaut. */
  modules?: QrModuleShape;
  eyeFrame?: QrEyeShape;
  eyeDot?: QrEyeShape;
  /** Logo, obligatoire si la matrice a une zone de logo. */
  logo?: LogoSource;
  pixels?: number;
}

/** SVG du QR (zone de silence comprise), carré de `pixels` px ; une unité = un module. */
export function qrSvg(matrix: QrMatrix, options: QrSvgOptions): string {
  const check = checkQrColors(options.darkColor, options.lightColor);
  if (!check.ok) throw new Error(check.error);
  const modules = options.modules ?? 'square';
  const eyeFrame = options.eyeFrame ?? 'square';
  const eyeDot = options.eyeDot ?? 'square';
  const total = matrix.size + QUIET_ZONE_MODULES * 2;
  const q = QUIET_ZONE_MODULES;
  const px = options.pixels ?? 512;
  // Bords nets pour les formes carrées seulement (crispEdges abîme les courbes).
  const crisp = (square: boolean) => (square ? ' shape-rendering="crispEdges"' : '');
  const eyes = eyesPaths(matrix, q, eyeFrame, eyeDot);
  const fg = options.darkColor;
  const parts = [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${total} ${total}" width="${px}" height="${px}">`,
    `<rect width="${total}" height="${total}" fill="${options.lightColor}"/>`,
    `<path fill="${fg}"${crisp(modules === 'square')} d="${modulesPath(matrix, q, modules, eyes.aligned)}"/>`,
    `<path fill="${fg}" fill-rule="evenodd"${crisp(eyeFrame === 'square')} d="${eyes.frames}"/>`,
    `<path fill="${fg}"${crisp(eyeDot === 'square')} d="${eyes.dots}"/>`,
  ];
  if (matrix.logo) {
    if (!options.logo) throw new Error('Logo manquant');
    const { center, radius, side } = matrix.logo;
    const c = center + q;
    // Disque de la couleur du fond, par-dessus les bords des modules voisins.
    parts.push(`<circle cx="${fmt(c)}" cy="${fmt(c)}" r="${fmt(radius)}" fill="${options.lightColor}"/>`);
    const at = c - side / 2;
    const n = nextIdNumber();
    const logo = options.logo.kind === 'svg'
      ? placeLogoSvg(options.logo.markup, at, at, side, `lg-${n}-`)
      : placeLogoRaster(options.logo.mime, options.logo.base64, at, at, side);
    // Logo découpé au disque : quoi qu'il contienne, il ne dessine jamais sur les modules.
    const clipId = `qr-logo-clip-${n}`;
    parts.push(`<defs><clipPath id="${clipId}"><circle cx="${fmt(c)}" cy="${fmt(c)}" r="${fmt(radius)}"/></clipPath></defs>`);
    parts.push(`<g clip-path="url(#${clipId})">${logo}</g>`);
  }
  parts.push('</svg>');
  return parts.join('');
}
