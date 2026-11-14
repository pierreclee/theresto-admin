/**
 * @jest-environment node
 *
 * Générateur de QR (P10) : matrice de la librairie qrcode, disque du logo (correction H, au
 * plus 20 % des modules, centré, loin des repères et du timing), zone de silence, contrôle de
 * contraste, formes des modules et des repères, logo SVG filtré ou PNG / JPEG embarqué, PDF A5.
 * Lisibilité réelle (rendu + décodage) : qrReadability.test.ts.
 */
import fs from 'fs';
import path from 'path';
import { create } from 'qrcode';
import { PDFDocument } from 'pdf-lib';
import {
  alignmentCenters,
  buildQrMatrix,
  bytesToBase64,
  checkQrColors,
  contrastRatio,
  logoAreaRatio,
  MAX_LOGO_AREA,
  MAX_LOGO_BYTES,
  placeLogoRaster,
  placeLogoSvg,
  qrSvg,
  QUIET_ZONE_MODULES,
  rasterLogoError,
  rasterMimeOf,
  sanitizeLogoSvg,
} from '@/lib/links/qrCode';
import { QR_EYE_SHAPES, QR_MODULE_SHAPES } from '@/lib/links/qrStyle';
import { A5_SIZE, buildQrPdf, encodableText } from '@/lib/links/qrPdf';
import { shortLinkUrl } from '@/lib/links/shortLinkRules';

const SVG_NS = 'xmlns="http://www.w3.org/2000/svg"';
const LOGO = fs.readFileSync(path.resolve(__dirname, '../../public/qr-logo.svg'), 'utf8');
const URL_PROD = shortLinkUrl('go.theresto.fr', 'telecharger');
const STAGING = 'theresto-go-staging.pierrecleepro.workers.dev';
// PNG 1×1 blanc.
const PNG_1PX_B64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/x8AAwMCAO+ip1sAAAAASUVORK5CYII=';
const PNG_1PX = Uint8Array.from(Buffer.from(PNG_1PX_B64, 'base64'));
// Début d'un JPEG (SOI + APP0 JFIF).
const JPEG_HEAD = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01]);
const b64 = (data: string | Uint8Array) => Buffer.from(data).toString('base64');
const round = (n: number) => String(Math.round(n * 1e6) / 1e6);
const q = QUIET_ZONE_MODULES;
const inFinder = (r: number, c: number, size: number) =>
  (r < 7 && c < 7) || (r < 7 && c >= size - 7) || (r >= size - 7 && c < 7);
/** Tracés du QR, dans l'ordre : modules, cadres (repères + alignements), points. */
const paths = (svg: string) => [...svg.matchAll(/<path ([^>]*)d="([^"]*)"\/>/g)].map((x) => ({ attrs: x[1], d: x[2] }));

describe('contraste', () => {
  it('noir sur blanc : 21:1', () => {
    expect(contrastRatio('#000000', '#FFFFFF')).toBeCloseTo(21, 5);
    expect(checkQrColors('#0F1629', '#FFFFFF').ok).toBe(true);
  });

  it('refus sous 4:1', () => {
    const r = checkQrColors('#999999', '#FFFFFF');
    expect(r.ok).toBe(false);
    expect(!r.ok && r.error).toContain('Contraste insuffisant');
  });

  it('refus d un fond plus sombre que les modules (QR inversé)', () => {
    const r = checkQrColors('#FFFFFF', '#000000');
    expect(r.ok).toBe(false);
    expect(!r.ok && r.error).toContain('plus clair');
  });

  it('couleur mal formée', () => {
    expect(checkQrColors('red', '#FFFFFF').ok).toBe(false);
  });
});

describe('matrice', () => {
  it('sans logo : la matrice de la librairie pour l URL du lien, correction M', () => {
    const m = buildQrMatrix(URL_PROD, { withLogo: false });
    const ref = create(URL_PROD, { errorCorrectionLevel: 'M' }).modules;
    expect(m.errorCorrection).toBe('M');
    expect(m.size).toBe(ref.size);
    for (let r = 0; r < m.size; r += 1) {
      for (let c = 0; c < m.size; c += 1) expect(m.dark[r][c]).toBe(Boolean(ref.get(r, c)));
    }
    expect(m.logo).toBeNull();
    expect(logoAreaRatio(m)).toBe(0);
  });

  it('avec logo : correction H, disque centré, vide, au plus 20 % des modules', () => {
    for (const url of [shortLinkUrl('go.theresto.fr', 'ab'), URL_PROD, shortLinkUrl(STAGING, 'ab'), shortLinkUrl(STAGING, 'a'.repeat(40))]) {
      const m = buildQrMatrix(url, { withLogo: true });
      const ref = create(url, { errorCorrectionLevel: 'H' }).modules;
      expect(m.errorCorrection).toBe('H');
      expect(m.logo).not.toBeNull();
      const { center, radius, side, erased } = m.logo!;
      expect(center).toBe(m.size / 2);
      // Modules effacés : exactement ceux dont le centre est dans le disque, comptés un à un.
      let inDisk = 0;
      for (let r = 0; r < m.size; r += 1) {
        for (let c = 0; c < m.size; c += 1) {
          if (Math.hypot(c + 0.5 - center, r + 0.5 - center) <= radius) {
            inDisk += 1;
            expect(m.dark[r][c]).toBe(false);
          } else {
            expect(m.dark[r][c]).toBe(Boolean(ref.get(r, c)));
          }
        }
      }
      expect(erased).toBe(inDisk);
      expect(logoAreaRatio(m)).toBe(erased / (m.size * m.size));
      expect(logoAreaRatio(m)).toBeLessThanOrEqual(MAX_LOGO_AREA);
      expect(logoAreaRatio(m)).toBeGreaterThan(0.05);
      // Le disque ne touche ni les carrés de 8×8 des coins (repère + séparateur)…
      for (const [x, y] of [[8, 8], [m.size - 8, 8], [8, m.size - 8]]) {
        expect(Math.hypot(x - center, y - center)).toBeGreaterThan(radius);
      }
      // … ni la ligne ni la colonne de timing (module 6, de 6 à 7).
      expect(center - 7).toBeGreaterThan(radius);
      // Logo inscrit dans un carré nettement plus petit que le disque : marge plus grande
      // qu'avant (carré de round(22 % du côté), marge de max(0,5 ; 8 %) de ce carré).
      let oldSpan = Math.round(m.size * 0.22);
      if (oldSpan % 2 === 0) oldSpan -= 1;
      const oldMargin = Math.max(0.5, oldSpan * 0.08);
      expect(radius - (side * Math.SQRT2) / 2).toBeGreaterThan(oldMargin * 2); // aux coins du logo
      expect(radius - side / 2).toBeGreaterThan(oldMargin * 4); // au milieu de ses côtés
      // Motifs de repérage intacts dans la matrice.
      expect(m.dark[0][0]).toBe(true);
    }
  });

  it('motifs d alignement : positions de la norme, conformes à la matrice', () => {
    expect(alignmentCenters(21)).toEqual([]);
    expect(alignmentCenters(33)).toEqual([[26, 26]]);
    expect(alignmentCenters(45)).toEqual([[6, 22], [22, 6], [22, 22], [22, 38], [38, 22], [38, 38]]);
    for (const slug of ['ab', 'a'.repeat(40)]) {
      const m = buildQrMatrix(shortLinkUrl(STAGING, slug), { withLogo: false });
      expect(alignmentCenters(m.size).length).toBeGreaterThan(0);
      for (const [r, c] of alignmentCenters(m.size)) {
        for (let dr = -2; dr <= 2; dr += 1) {
          for (let dc = -2; dc <= 2; dc += 1) {
            expect(m.dark[r + dr][c + dc]).toBe(Math.max(Math.abs(dr), Math.abs(dc)) !== 1);
          }
        }
      }
    }
  });
});

describe('SVG', () => {
  it('zone de silence de 4 modules, couleurs, repères dessinés à part', () => {
    const m = buildQrMatrix(URL_PROD, { withLogo: false });
    const svg = qrSvg(m, { darkColor: '#0F1629', lightColor: '#FFFFFF' });
    const total = m.size + QUIET_ZONE_MODULES * 2;
    expect(svg).toContain(`viewBox="0 0 ${total} ${total}"`);
    expect(svg).toContain('fill="#0F1629"');
    expect(svg).toContain(`<rect width="${total}" height="${total}" fill="#FFFFFF"/>`);
    const [modules, frames, dots] = paths(svg);
    // Repère haut gauche : cadre 7×7 et creux 5×5 (evenodd), point 3×3, après la zone de silence.
    expect(frames.attrs).toContain('fill-rule="evenodd"');
    expect(frames.d.startsWith(`M${q} ${q}H${q + 7}V${q + 7}H${q}V${q}Z`)).toBe(true);
    expect(frames.d).toContain(`M${q + 1} ${q + 1}H${q + 6}V${q + 6}H${q + 1}V${q + 1}Z`);
    expect(dots.d.startsWith(`M${q + 2} ${q + 2}H${q + 5}V${q + 5}H${q + 2}V${q + 2}Z`)).toBe(true);
    // Modules ordinaires : jamais dans un motif de repérage.
    const starts = [...modules.d.matchAll(/M(\d+) (\d+)/g)];
    expect(starts.length).toBeGreaterThan(50);
    for (const [, x, y] of starts) expect(inFinder(Number(y) - q, Number(x) - q, m.size)).toBe(false);
    // Carré : bords nets.
    expect(modules.attrs).toContain('shape-rendering="crispEdges"');
  });

  it('formes courbes : sans crispEdges ; une forme par module foncé', () => {
    const m = buildQrMatrix(URL_PROD, { withLogo: false });
    const modulePaths = new Set<string>();
    for (const modules of QR_MODULE_SHAPES) {
      for (const eye of QR_EYE_SHAPES) {
        const svg = qrSvg(m, { darkColor: '#000000', lightColor: '#FFFFFF', modules, eyeFrame: eye, eyeDot: eye });
        const [mod, frames, dots] = paths(svg);
        expect(mod.attrs.includes('crispEdges')).toBe(modules === 'square');
        expect(frames.attrs.includes('crispEdges')).toBe(eye === 'square');
        expect(dots.attrs.includes('crispEdges')).toBe(eye === 'square');
        expect(frames.attrs).toContain('fill-rule="evenodd"');
        expect(frames.d.includes('A')).toBe(eye !== 'square');
        modulePaths.add(mod.d);
      }
    }
    expect(modulePaths.size).toBe(QR_MODULE_SHAPES.length);
    // Points : un disque par module foncé hors repères et alignements.
    const aligned = alignmentCenters(m.size);
    let expected = 0;
    for (let r = 0; r < m.size; r += 1) {
      for (let c = 0; c < m.size; c += 1) {
        const inAlign = aligned.some(([ar, ac]) => Math.abs(ar - r) <= 2 && Math.abs(ac - c) <= 2);
        if (m.dark[r][c] && !inFinder(r, c, m.size) && !inAlign) expected += 1;
      }
    }
    const dotsSvg = qrSvg(m, { darkColor: '#000000', lightColor: '#FFFFFF', modules: 'dots' });
    expect((paths(dotsSvg)[0].d.match(/z/g) ?? []).length).toBe(expected);
  });

  it('feuille : coins droits tournés vers le centre du code', () => {
    const m = buildQrMatrix(URL_PROD, { withLogo: false });
    const frames = paths(qrSvg(m, { darkColor: '#000000', lightColor: '#FFFFFF', eyeFrame: 'leaf', eyeDot: 'leaf' }))[1].d;
    // Haut gauche : coin haut gauche droit (départ au coin), coin haut droit arrondi (rayon 3).
    expect(frames.startsWith(`M${q} ${q}H${q + 4}A3 3 0 0 1 ${q + 7} ${q + 3}V${q + 7}`)).toBe(true);
    // Haut droit : coin haut gauche arrondi (départ décalé de 3), coin haut droit droit.
    const x = m.size - 7 + q;
    expect(frames).toContain(`M${x + 3} ${q}H${x + 7}V${q + 4}`);
  });

  it('logo SVG inclus dans le fichier (aucune ressource externe), sur un disque du fond', () => {
    const m = buildQrMatrix(URL_PROD, { withLogo: true });
    const svg = qrSvg(m, { darkColor: '#1F3A5F', lightColor: '#FFF8F0', logo: { kind: 'svg', markup: LOGO } });
    expect(svg).toContain('fill="#FF6B35"');
    expect(svg).not.toMatch(/href=|<image/);
    // Un seul <svg> (la racine) : pas de <svg x y> imbriqué, que MuPDF et des logiciels
    // d'imprimeur posent en haut à gauche, sur un motif de repérage.
    expect((svg.match(/<svg/g) ?? []).length).toBe(1);
    const { center, radius, side } = m.logo!;
    const at = center + q - side / 2;
    // Logo de viewBox 0 0 100 100 : translation au coin du carré du logo, échelle côté / 100.
    expect(svg).toContain(`<g transform="translate(${round(at)} ${round(at)}) scale(${round(side / 100)})">`);
    // Disque de la couleur du fond (jamais #FFFFFF en dur), sous le logo.
    const disk = `<circle cx="${round(center + q)}" cy="${round(center + q)}" r="${round(radius)}" fill="#FFF8F0"/>`;
    expect(svg).toContain(disk);
    expect(svg.slice(0, svg.indexOf('<g transform='))).not.toContain('#FFFFFF');
    expect(svg.indexOf(disk)).toBeLessThan(svg.indexOf('<g transform='));
    // Logo découpé au disque : clipPath du même cercle, enveloppant le logo.
    const clip = /<clipPath id="(qr-logo-clip-\d+)"><circle cx="([\d.]+)" cy="([\d.]+)" r="([\d.]+)"\/><\/clipPath>/.exec(svg);
    expect(clip).not.toBeNull();
    expect(clip!.slice(2)).toEqual([round(center + q), round(center + q), round(radius)]);
    expect(svg).toContain(`<g clip-path="url(#${clip![1]})"><g transform=`);
  });

  it('découpe au disque : ids uniques d un QR à l autre, logo PNG compris', () => {
    const m = buildQrMatrix(URL_PROD, { withLogo: true });
    const ids = [
      qrSvg(m, { darkColor: '#000000', lightColor: '#FFFFFF', logo: { kind: 'svg', markup: LOGO } }),
      qrSvg(m, { darkColor: '#000000', lightColor: '#FFFFFF', logo: { kind: 'raster', mime: 'image/png', base64: PNG_1PX_B64 } }),
    ].map((svg) => {
      const id = /<g clip-path="url\(#(qr-logo-clip-\d+)\)">/.exec(svg)?.[1];
      expect(svg).toContain(`<clipPath id="${id}">`);
      return id;
    });
    expect(ids[0]).not.toBe(ids[1]);
    // Ids du logo préfixés : deux QR dans une même page ne se volent pas leurs dégradés.
    const grad = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1 1"><linearGradient id="g"/><rect fill="url(#g)"/></svg>`;
    const a = placeLogoSvg(grad, 0, 0, 1);
    const b = placeLogoSvg(grad, 0, 0, 1);
    expect(a).toMatch(/id="lg-\d+-g".*fill="url\(#lg-\d+-g\)"/);
    expect(a).not.toBe(b);
  });

  it('logo PNG embarqué : <image> data: centré, proportions gardées, seul href', () => {
    const m = buildQrMatrix(URL_PROD, { withLogo: true });
    const svg = qrSvg(m, { darkColor: '#000000', lightColor: '#FFFFFF', logo: { kind: 'raster', mime: 'image/png', base64: PNG_1PX_B64 } });
    const { center, side } = m.logo!;
    const at = round(center + q - side / 2);
    expect(svg).toContain(`<image x="${at}" y="${at}" width="${round(side)}" height="${round(side)}" `
      + `preserveAspectRatio="xMidYMid meet" href="data:image/png;base64,${PNG_1PX_B64}"/>`);
    expect((svg.match(/href=/g) ?? []).length).toBe(1);
    expect(() => qrSvg(m, { darkColor: '#000000', lightColor: '#FFFFFF' })).toThrow('Logo manquant');
    // SVG déguisé en PNG : refusé à l'écriture du QR.
    expect(() => qrSvg(m, {
      darkColor: '#000000', lightColor: '#FFFFFF', logo: { kind: 'raster', mime: 'image/png', base64: b64('<svg onload="x()"/>') },
    })).toThrow();
  });

  it('logo non carré ou décalé : centré dans sa zone, viewBox compensé', () => {
    const g = placeLogoSvg(`<svg ${SVG_NS} viewBox="10 20 200 100"><rect width="1" height="1"/></svg>`, 5, 5, 10);
    // échelle 10/200 = 0.05 ; hauteur 5 centrée (+2.5) ; origine du viewBox ramenée à 0.
    expect(g).toBe('<g transform="translate(4.5 6.5) scale(0.05)"><rect width="1" height="1"/></g>');
    expect(() => placeLogoSvg(`<svg ${SVG_NS} width="10" height="10"></svg>`, 0, 0, 1)).toThrow();
    expect(() => placeLogoSvg(`<svg ${SVG_NS} viewBox="0 0 1 1"><svg/></svg>`, 0, 0, 1)).toThrow();
  });

  it('couleurs refusées : pas de SVG', () => {
    const m = buildQrMatrix(URL_PROD, { withLogo: false });
    expect(() => qrSvg(m, { darkColor: '#FFFFFF', lightColor: '#EEEEEE' })).toThrow();
    expect(() => qrSvg(m, { darkColor: '#999999', lightColor: '#FFFFFF', modules: 'dots' })).toThrow('Contraste');
  });

  it('logo SVG qui chargerait ou exécuterait quelque chose : refusé', () => {
    const refused = [
      `<svg ${SVG_NS} viewBox="0 0 1 1"><script>alert(1)</script></svg>`,
      `<svg ${SVG_NS} viewBox="0 0 1 1"><image href="https://x/y.png"/></svg>`,
      `<svg ${SVG_NS} viewBox="0 0 1 1"><image xmlns:xlink="http://www.w3.org/1999/xlink" xlink:href="http://x/y.png"/></svg>`,
      `<svg ${SVG_NS} viewBox="0 0 1 1"><a href = "javascript:alert(1)"><rect/></a></svg>`,
      `<svg ${SVG_NS} viewBox="0 0 1 1"><rect fill="javascript:x"/></svg>`,
      `<svg ${SVG_NS} viewBox="0 0 1 1" onload="x()"></svg>`,
      `<svg ${SVG_NS} viewBox="0 0 1 1"><rect onclick = "x()"/></svg>`,
      `<svg ${SVG_NS} viewBox="0 0 1 1"><foreignObject/></svg>`,
      `<svg ${SVG_NS} viewBox="0 0 1 1"><use href="#a"/></svg>`,
      `<svg ${SVG_NS} viewBox="0 0 1 1"><set attributeName="fill" to="red"/></svg>`,
      `<svg ${SVG_NS} viewBox="0 0 1 1"><style>@import "https://x/y.css";</style></svg>`,
      `<svg ${SVG_NS} viewBox="0 0 1 1"><rect style="fill:url(https://x/y)"/></svg>`,
      `<!DOCTYPE svg [<!ENTITY a "b">]><svg ${SVG_NS} viewBox="0 0 1 1"></svg>`,
      '<svg viewBox="0 0 1 1"><rect/></svg>',
    ];
    for (const svg of refused) expect(() => sanitizeLogoSvg(svg)).toThrow(/refusé/);
    // Références internes et styles permis (logos exportés par les logiciels de dessin).
    const ok = `﻿<?xml version="1.0"?><!-- logo --><svg ${SVG_NS} viewBox="0 0 2 2"><defs>`
      + '<linearGradient id="g"/></defs>'
      + '<style>.a{fill:url(#g)}</style><rect class="a" fill="url( #g)" width="2" height="2"/></svg>';
    expect(sanitizeLogoSvg(ok).viewBox).toEqual([0, 0, 2, 2]);
    expect(placeLogoSvg(LOGO, 1, 2, 3)).toMatch(/^<g transform="translate\(1 2\) scale\(0\.03\)">/);
  });
});

describe('logo PNG / JPEG embarqué', () => {
  it('accepté : PNG et JPEG en base64 strict avec les bons octets', () => {
    expect(rasterLogoError('image/png', PNG_1PX_B64)).toBeNull();
    expect(rasterLogoError('image/jpeg', b64(JPEG_HEAD))).toBeNull();
    expect(rasterMimeOf(PNG_1PX)).toBe('image/png');
    expect(rasterMimeOf(JPEG_HEAD)).toBe('image/jpeg');
    expect(rasterMimeOf(new Uint8Array([0x47, 0x49, 0x46, 0x38]))).toBeNull();
  });

  it('refusé : autre format, base64 relâché, SVG déguisé, octets d un autre format, trop lourd', () => {
    expect(rasterLogoError('image/gif', b64(new Uint8Array([0x47, 0x49, 0x46, 0x38, 0x39, 0x61])))).toMatch(/PNG ou JPEG/);
    expect(rasterLogoError('image/svg+xml', b64('<svg/>'))).toMatch(/PNG ou JPEG/);
    expect(rasterLogoError('image/png', `${PNG_1PX_B64.slice(0, 8)} ${PNG_1PX_B64.slice(8)}`)).toMatch(/illisible/);
    expect(rasterLogoError('image/png', `${PNG_1PX_B64}\n`)).toMatch(/illisible/);
    expect(rasterLogoError('image/png', PNG_1PX_B64.slice(0, -1))).toMatch(/illisible/);
    expect(rasterLogoError('image/png', `-${PNG_1PX_B64.slice(1)}`)).toMatch(/illisible/);
    expect(rasterLogoError('image/png', '')).toMatch(/illisible/);
    expect(rasterLogoError('image/png', b64('<svg xmlns="http://www.w3.org/2000/svg"/>'))).toMatch(/ne correspond pas/);
    expect(rasterLogoError('image/png', b64(JPEG_HEAD))).toMatch(/ne correspond pas/);
    expect(rasterLogoError('image/jpeg', PNG_1PX_B64)).toMatch(/ne correspond pas/);
    const big = new Uint8Array(MAX_LOGO_BYTES + 1);
    big.set(PNG_1PX.subarray(0, 8));
    expect(rasterLogoError('image/png', bytesToBase64(big))).toMatch(/512 Kio/);
    const max = new Uint8Array(MAX_LOGO_BYTES);
    max.set(PNG_1PX.subarray(0, 8));
    expect(rasterLogoError('image/png', bytesToBase64(max))).toBeNull();
    expect(() => placeLogoRaster('image/png', 'javascript:alert(1)', 0, 0, 1)).toThrow();
    expect(() => placeLogoRaster('image/png', `${PNG_1PX_B64}" onload="x()`, 0, 0, 1)).toThrow();
  });

  it('base64 : identique à Buffer, gros fichiers compris', () => {
    const bytes = Uint8Array.from({ length: 100_000 }, (_, i) => (i * 7919) % 256);
    expect(bytesToBase64(bytes)).toBe(Buffer.from(bytes).toString('base64'));
  });
});

describe('PDF A5', () => {
  it('page A5 avec titre et URL courte', async () => {
    const bytes = await buildQrPdf({ pngBytes: PNG_1PX, title: "Téléchargez l'app 🍽️", url: URL_PROD });
    expect(Buffer.from(bytes.slice(0, 5)).toString()).toBe('%PDF-');
    const doc = await PDFDocument.load(bytes);
    expect(doc.getPageCount()).toBe(1);
    const { width, height } = doc.getPage(0).getSize();
    expect([width, height]).toEqual(A5_SIZE);
    expect(doc.getTitle()).toBe("Téléchargez l'app 🍽️");
  });

  it('caractères hors de la police standard remplacés', () => {
    const font = { encodeText: (t: string) => { if (t.codePointAt(0)! > 0xff) throw new Error('x'); return null as never; } };
    expect(encodableText(font, 'Café 🍽')).toBe('Café ?');
  });
});
