// Générateur de QR codes des liens courts (P10), entièrement dans le navigateur : librairie
// qrcode (MIT) pour la matrice, dessin SVG ici, PDF par pdf-lib (MIT). Aucun service tiers.
//
// PDF : lib/links/qrPdf.ts, chargé à la demande (pdf-lib est lourd).
//
// Règles : le QR encode toujours https://<domaine>/<slug> (shortLinkUrl) ; zone de silence de
// 4 modules ; correction d'erreur H dès qu'il y a un logo, logo (fond blanc et marge compris)
// au plus 20 % de la surface du code, posé sur des modules entiers, au centre ; modules
// foncés sur fond clair, contraste d'au moins 4:1.

import { create } from 'qrcode';

export const QUIET_ZONE_MODULES = 4;
/** Part maximale de la surface du code (modules) occupée par le logo et sa marge blanche. */
export const MAX_LOGO_AREA = 0.2;
/** Côté visé du logo, en part du côté du code : surface ≈ 5 %, bien sous la limite. */
const LOGO_SIDE_RATIO = 0.22;
export const MIN_CONTRAST = 4;

export type QrErrorCorrection = 'L' | 'M' | 'Q' | 'H';

export interface QrMatrix {
  /** Côté du code en modules (sans la zone de silence). */
  size: number;
  /** dark[ligne][colonne], modules sous le logo effacés. */
  dark: boolean[][];
  errorCorrection: QrErrorCorrection;
  /** Zone du logo, en modules (début et côté), ou null. */
  logo: { start: number; span: number } | null;
}

/** Matrice du QR de `text` ; avec logo, correction H et modules centraux réservés au logo. */
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

  let logo: QrMatrix['logo'] = null;
  if (options.withLogo) {
    // Côté impair (centré sur le module central), sans dépasser MAX_LOGO_AREA.
    let span = Math.round(size * LOGO_SIDE_RATIO);
    if (span % 2 === 0) span -= 1;
    while (span > 1 && (span * span) / (size * size) > MAX_LOGO_AREA) span -= 2;
    const start = (size - span) / 2;
    for (let r = start; r < start + span; r += 1) {
      for (let c = start; c < start + span; c += 1) dark[r][c] = false;
    }
    logo = { start, span };
  }
  return { size, dark, errorCorrection, logo };
}

/** Part de la surface du code occupée par le logo (0 sans logo). */
export function logoAreaRatio(matrix: QrMatrix): number {
  return matrix.logo ? (matrix.logo.span * matrix.logo.span) / (matrix.size * matrix.size) : 0;
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

// ─── SVG ────────────────────────────────────────────────────────────────────

/** Place le SVG du logo (fichier de public/) dans le QR : x, y, côté en unités de module. */
export function nestLogoSvg(logoSvg: string, x: number, y: number, side: number): string {
  const svg = logoSvg.replace(/<\?xml[^>]*\?>/i, '').trim();
  // Notre propre fichier, mais on refuse tout ce qui chargerait ou exécuterait quelque chose.
  if (!svg.startsWith('<svg') || /<script|<foreignObject|\shref=|xlink:href|\son[a-z]+=/i.test(svg)) {
    throw new Error('Logo SVG refusé');
  }
  return svg.replace(/^<svg/, `<svg x="${x}" y="${y}" width="${side}" height="${side}"`);
}

/**
 * SVG du QR (zone de silence comprise), carré de `pixels` px ; une unité = un module.
 * `logoSvg` : contenu du fichier du logo, obligatoire si la matrice a une zone de logo.
 */
export function qrSvg(
  matrix: QrMatrix,
  options: { darkColor: string; lightColor: string; logoSvg?: string; pixels?: number },
): string {
  const check = checkQrColors(options.darkColor, options.lightColor);
  if (!check.ok) throw new Error(check.error);
  const total = matrix.size + QUIET_ZONE_MODULES * 2;
  const q = QUIET_ZONE_MODULES;
  // Suites horizontales de modules foncés : un tracé compact.
  const runs: string[] = [];
  for (let r = 0; r < matrix.size; r += 1) {
    let c = 0;
    while (c < matrix.size) {
      if (!matrix.dark[r][c]) { c += 1; continue; }
      const startCol = c;
      while (c < matrix.size && matrix.dark[r][c]) c += 1;
      runs.push(`M${startCol + q} ${r + q}h${c - startCol}v1h-${c - startCol}z`);
    }
  }
  const px = options.pixels ?? 512;
  const parts = [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${total} ${total}" width="${px}" height="${px}" shape-rendering="crispEdges">`,
    `<rect width="${total}" height="${total}" fill="${options.lightColor}"/>`,
    `<path fill="${options.darkColor}" d="${runs.join('')}"/>`,
  ];
  if (matrix.logo) {
    if (!options.logoSvg) throw new Error('Logo manquant');
    const start = matrix.logo.start + q;
    // Fond blanc et marge d'un demi-module (au moins) autour du logo.
    const margin = Math.max(0.5, matrix.logo.span * 0.08);
    parts.push(`<rect x="${start}" y="${start}" width="${matrix.logo.span}" height="${matrix.logo.span}" fill="#FFFFFF"/>`);
    parts.push(nestLogoSvg(options.logoSvg, start + margin, start + margin, matrix.logo.span - margin * 2));
  }
  parts.push('</svg>');
  return parts.join('');
}
