/**
 * @jest-environment node
 *
 * Lisibilité réelle des QR (P10) : chaque SVG produit est rendu en pixels par resvg (moteur
 * de rendu SVG, comme un navigateur ou un logiciel d'imprimeur), puis décodé par deux
 * lecteurs indépendants ; le texte lu doit être l'URL du lien.
 *   - ZXing (@zxing/library, portage JS du lecteur des applications Android) : doit lire
 *     TOUS les cas. C'est la référence « téléphone ».
 *   - jsQR : doit lire tous les cas dont le cadre et le point des repères ont la même forme.
 *     Il classe les motifs de repérage en comparant aussi leurs diagonales à 1:1:3:1:1, ce
 *     qu'un cadre carré autour d'un point rond (ou l'inverse) ne respecte pas : il retient
 *     alors parfois un faux motif pris dans les données. Ces cas sont décodés et comptés, et
 *     jsQR ne doit jamais lire une autre URL que la bonne.
 * Cas : toutes les formes de modules × cadres × points de repère avec le logo TheResto, puis
 * sans logo, avec un logo PNG importé, en couleurs, avec une URL courte et une longue (slug
 * de 40 caractères sur le domaine de staging), et en petite impression (4 px par module).
 */
import fs from 'fs';
import path from 'path';
import jsQR from 'jsqr';
import { Resvg } from '@resvg/resvg-js';
import { BinaryBitmap, HybridBinarizer, QRCodeReader, RGBLuminanceSource } from '@zxing/library';
import { buildQrMatrix, bytesToBase64, qrSvg, QUIET_ZONE_MODULES, type LogoSource } from '@/lib/links/qrCode';
import { QR_EYE_SHAPES, QR_MODULE_SHAPES, type QrEyeShape, type QrModuleShape } from '@/lib/links/qrStyle';
import { shortLinkUrl } from '@/lib/links/shortLinkRules';

const LOGO: LogoSource = {
  kind: 'svg',
  markup: fs.readFileSync(path.resolve(__dirname, '../../public/qr-logo.svg'), 'utf8'),
};
const URL_SHORT = shortLinkUrl('go.theresto.fr', 'ab');
const URL_PROD = shortLinkUrl('go.theresto.fr', 'telecharger');
const URL_LONG = shortLinkUrl('theresto-go-staging.pierrecleepro.workers.dev', `a${'-b'.repeat(19)}c`);

/** Logo PNG de test (dégradé, disque), produit par resvg. */
function testPng(): Uint8Array {
  const svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 48" width="64" height="48">'
    + '<defs><linearGradient id="g"><stop offset="0" stop-color="#1F3A5F"/><stop offset="1" stop-color="#FF6B35"/></linearGradient></defs>'
    + '<rect width="64" height="48" rx="8" fill="url(#g)"/><circle cx="32" cy="24" r="14" fill="#FFF8F0"/></svg>';
  return new Uint8Array(new Resvg(svg).render().asPng());
}
const RASTER: LogoSource = { kind: 'raster', mime: 'image/png', base64: bytesToBase64(testPng()) };

interface Case {
  url: string;
  modules: QrModuleShape;
  eyeFrame: QrEyeShape;
  eyeDot: QrEyeShape;
  logo?: LogoSource;
  dark?: string;
  light?: string;
  pxPerModule?: number;
}

const jsqrStats = { read: 0, total: 0, missed: [] as string[] };

function zxingRead(rgba: Uint8ClampedArray, width: number, height: number): string | null {
  const luminance = new Uint8ClampedArray(width * height);
  for (let i = 0; i < luminance.length; i += 1) {
    luminance[i] = (rgba[4 * i] * 299 + rgba[4 * i + 1] * 587 + rgba[4 * i + 2] * 114) / 1000;
  }
  try {
    const bitmap = new BinaryBitmap(new HybridBinarizer(new RGBLuminanceSource(luminance, width, height)));
    return new QRCodeReader().decode(bitmap).getText();
  } catch {
    return null;
  }
}

function check(c: Case): void {
  const matrix = buildQrMatrix(c.url, { withLogo: Boolean(c.logo) });
  const svg = qrSvg(matrix, {
    darkColor: c.dark ?? '#0F1629',
    lightColor: c.light ?? '#FFFFFF',
    modules: c.modules,
    eyeFrame: c.eyeFrame,
    eyeDot: c.eyeDot,
    logo: c.logo,
  });
  const width = (matrix.size + QUIET_ZONE_MODULES * 2) * (c.pxPerModule ?? 6);
  const image = new Resvg(svg, { fitTo: { mode: 'width', value: width } }).render();
  const rgba = new Uint8ClampedArray(image.pixels);

  expect(zxingRead(rgba, image.width, image.height)).toBe(c.url);

  const js = jsQR(rgba, image.width, image.height, { inversionAttempts: 'dontInvert' })?.data ?? null;
  if (js !== null) expect(js).toBe(c.url);
  jsqrStats.total += 1;
  if (js === c.url) jsqrStats.read += 1;
  else jsqrStats.missed.push(`${c.modules}/${c.eyeFrame}/${c.eyeDot} (${c.url.length} car.)`);
  if (c.eyeFrame === c.eyeDot) expect(js).toBe(c.url);
}

afterAll(() => {
  // Rapport : cas que jsQR n'a pas lus (tous lus par ZXing).
  console.log(`jsQR : ${jsqrStats.read}/${jsqrStats.total} lus ; non lus : ${jsqrStats.missed.join(', ') || 'aucun'}`);
});

const ALL: [QrModuleShape, QrEyeShape, QrEyeShape][] = [];
for (const m of QR_MODULE_SHAPES) for (const f of QR_EYE_SHAPES) for (const d of QR_EYE_SHAPES) ALL.push([m, f, d]);

describe('lisibilité : toutes les formes avec le logo TheResto', () => {
  it('80 combinaisons', () => {
    expect(ALL).toHaveLength(80);
  });

  it.each(ALL)('modules %s, cadre %s, point %s', (modules, eyeFrame, eyeDot) => {
    check({ url: URL_PROD, modules, eyeFrame, eyeDot, logo: LOGO });
  });
});

describe('lisibilité : variantes', () => {
  it.each(QR_MODULE_SHAPES)('sans logo, modules %s', (modules) => {
    check({ url: URL_PROD, modules, eyeFrame: 'rounded', eyeDot: 'circle' });
    check({ url: URL_PROD, modules, eyeFrame: 'square', eyeDot: 'square' });
  });

  it.each(QR_MODULE_SHAPES)('logo PNG importé, modules %s', (modules) => {
    check({ url: URL_PROD, modules, eyeFrame: 'leaf', eyeDot: 'leaf', logo: RASTER });
    check({ url: URL_PROD, modules, eyeFrame: 'square', eyeDot: 'circle', logo: RASTER });
  });

  it.each(QR_MODULE_SHAPES)('#1F3A5F sur #FFF8F0, modules %s', (modules) => {
    check({ url: URL_PROD, modules, eyeFrame: 'circle', eyeDot: 'circle', logo: LOGO, dark: '#1F3A5F', light: '#FFF8F0' });
  });

  it.each(QR_MODULE_SHAPES)('URL courte, modules %s', (modules) => {
    check({ url: URL_SHORT, modules, eyeFrame: 'rounded', eyeDot: 'rounded', logo: LOGO });
    check({ url: URL_SHORT, modules, eyeFrame: 'leaf', eyeDot: 'square', logo: LOGO });
  });

  it.each(QR_MODULE_SHAPES)('URL longue (slug de 40 caractères), modules %s', (modules) => {
    expect([...URL_LONG.split('/').pop()!]).toHaveLength(40);
    for (const shape of QR_EYE_SHAPES) check({ url: URL_LONG, modules, eyeFrame: shape, eyeDot: shape, logo: LOGO });
    check({ url: URL_LONG, modules, eyeFrame: 'circle', eyeDot: 'square', logo: RASTER });
  });

  it.each(QR_MODULE_SHAPES)('petite impression (4 px par module), modules %s', (modules) => {
    for (const shape of QR_EYE_SHAPES) check({ url: URL_PROD, modules, eyeFrame: shape, eyeDot: shape, logo: LOGO, pxPerModule: 4 });
  });
});
