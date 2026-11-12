/**
 * @jest-environment node
 *
 * Générateur de QR (P10) : matrice de la librairie qrcode, logo (correction H, au plus 20 %
 * de la surface, centré), zone de silence, contrôle de contraste, SVG autonome, PDF A5.
 */
import fs from 'fs';
import path from 'path';
import { create } from 'qrcode';
import { PDFDocument } from 'pdf-lib';
import {
  buildQrMatrix,
  checkQrColors,
  contrastRatio,
  logoAreaRatio,
  MAX_LOGO_AREA,
  placeLogoSvg,
  qrSvg,
  QUIET_ZONE_MODULES,
} from '@/lib/links/qrCode';
import { A5_SIZE, buildQrPdf, encodableText } from '@/lib/links/qrPdf';
import { shortLinkUrl } from '@/lib/links/shortLinkRules';

const LOGO = fs.readFileSync(path.resolve(__dirname, '../../public/qr-logo.svg'), 'utf8');
const URL_PROD = shortLinkUrl('go.theresto.fr', 'telecharger');
// PNG 1×1 blanc.
const PNG_1PX = Uint8Array.from(Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/x8AAwMCAO+ip1sAAAAASUVORK5CYII=', 'base64'));

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

  it('avec logo : correction H, zone centrée, vide, au plus 20 % de la surface', () => {
    for (const slug of ['ab', 'telecharger', 'a'.repeat(40)]) {
      const m = buildQrMatrix(shortLinkUrl('theresto-go-staging.pierrecleepro.workers.dev', slug), { withLogo: true });
      expect(m.errorCorrection).toBe('H');
      expect(m.logo).not.toBeNull();
      const { start, span } = m.logo!;
      expect(start * 2 + span).toBe(m.size);
      expect(logoAreaRatio(m)).toBeLessThanOrEqual(MAX_LOGO_AREA);
      expect(logoAreaRatio(m)).toBeGreaterThan(0.02);
      for (let r = start; r < start + span; r += 1) {
        for (let c = start; c < start + span; c += 1) expect(m.dark[r][c]).toBe(false);
      }
      // Motifs de repérage intacts (coin haut gauche).
      expect(m.dark[0][0]).toBe(true);
      expect(start).toBeGreaterThan(7);
    }
  });
});

describe('SVG', () => {
  it('zone de silence de 4 modules et couleurs', () => {
    const m = buildQrMatrix(URL_PROD, { withLogo: false });
    const svg = qrSvg(m, { darkColor: '#0F1629', lightColor: '#FFFFFF' });
    const total = m.size + QUIET_ZONE_MODULES * 2;
    expect(svg).toContain(`viewBox="0 0 ${total} ${total}"`);
    expect(svg).toContain('fill="#0F1629"');
    // Premier module foncé (0,0) décalé de la zone de silence.
    expect(svg).toContain(`d="M${QUIET_ZONE_MODULES} ${QUIET_ZONE_MODULES}h`);
  });

  it('logo inclus dans le fichier (aucune ressource externe)', () => {
    const m = buildQrMatrix(URL_PROD, { withLogo: true });
    const svg = qrSvg(m, { darkColor: '#000000', lightColor: '#FFFFFF', logoSvg: LOGO });
    expect(svg).toContain('fill="#FF6B35"');
    expect(svg).not.toMatch(/href=|<image/);
    // Un seul <svg> (la racine) : pas de <svg x y> imbriqué, que MuPDF et des logiciels
    // d'imprimeur posent en haut à gauche, sur un motif de repérage.
    expect((svg.match(/<svg/g) ?? []).length).toBe(1);
    const { start, span } = m.logo!;
    const q = QUIET_ZONE_MODULES;
    const margin = Math.max(0.5, span * 0.08);
    const side = span - margin * 2;
    const at = start + q + margin;
    const round = (n: number) => String(Math.round(n * 1e6) / 1e6);
    // Logo de viewBox 0 0 100 100 : translation au coin de la zone, échelle côté / 100.
    expect(svg).toContain(`<g transform="translate(${round(at)} ${round(at)}) scale(${round(side / 100)})">`);
    // Fond blanc de la zone du logo inchangé, sous le logo.
    const bg = `<rect x="${start + q}" y="${start + q}" width="${span}" height="${span}" fill="#FFFFFF"/>`;
    expect(svg).toContain(bg);
    expect(svg.indexOf(bg)).toBeLessThan(svg.indexOf('<g transform='));
  });

  it('logo non carré ou décalé : centré dans sa zone, viewBox compensé', () => {
    const g = placeLogoSvg('<svg viewBox="10 20 200 100"><rect width="1" height="1"/></svg>', 5, 5, 10);
    // échelle 10/200 = 0.05 ; hauteur 5 centrée (+2.5) ; origine du viewBox ramenée à 0.
    expect(g).toBe('<g transform="translate(4.5 6.5) scale(0.05)"><rect width="1" height="1"/></g>');
    expect(() => placeLogoSvg('<svg width="10" height="10"></svg>', 0, 0, 1)).toThrow();
    expect(() => placeLogoSvg('<svg viewBox="0 0 1 1"><svg/></svg>', 0, 0, 1)).toThrow();
  });

  it('couleurs refusées : pas de SVG', () => {
    const m = buildQrMatrix(URL_PROD, { withLogo: false });
    expect(() => qrSvg(m, { darkColor: '#FFFFFF', lightColor: '#EEEEEE' })).toThrow();
  });

  it('logo qui chargerait ou exécuterait quelque chose : refusé', () => {
    expect(() => placeLogoSvg('<svg><script>alert(1)</script></svg>', 0, 0, 1)).toThrow();
    expect(() => placeLogoSvg('<svg><image href="https://x"/></svg>', 0, 0, 1)).toThrow();
    expect(() => placeLogoSvg('<svg onload="x()"></svg>', 0, 0, 1)).toThrow();
    expect(placeLogoSvg(LOGO, 1, 2, 3)).toMatch(/^<g transform="translate\(1 2\) scale\(0\.03\)">/);
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
