/**
 * @jest-environment node
 *
 * Logo importé pour le QR (readLogoFile) : SVG, PNG ou JPEG de 512 Kio au plus, extension et
 * octets concordants, SVG filtré comme le logo intégré, lecture sans fetch(blob:).
 */
import fs from 'fs';
import path from 'path';
import { readLogoFile } from '@/lib/links/browserFiles';
import { MAX_LOGO_BYTES } from '@/lib/links/qrCode';

const LOGO = fs.readFileSync(path.resolve(__dirname, '../../public/qr-logo.svg'), 'utf8');
const PNG_B64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/x8AAwMCAO+ip1sAAAAASUVORK5CYII=';
const PNG = Uint8Array.from(Buffer.from(PNG_B64, 'base64'));
const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 0xff, 0xd9]);
const blob = (data: BlobPart) => new Blob([data]);

describe('readLogoFile', () => {
  it('PNG et JPEG : source embarquée en base64', async () => {
    expect(await readLogoFile(blob(PNG), 'logo.png')).toEqual({
      ok: true, extension: 'png', source: { kind: 'raster', mime: 'image/png', base64: PNG_B64 },
    });
    for (const name of ['photo.JPG', 'photo.jpeg']) {
      const r = await readLogoFile(blob(JPEG), name);
      expect(r).toEqual({
        ok: true, extension: 'jpg', source: { kind: 'raster', mime: 'image/jpeg', base64: Buffer.from(JPEG).toString('base64') },
      });
    }
  });

  it('SVG : filtré, gardé tel quel', async () => {
    const r = await readLogoFile(new File([LOGO], 'logo.svg', { type: 'image/svg+xml' }), 'logo.svg');
    expect(r).toEqual({ ok: true, extension: 'svg', source: { kind: 'svg', markup: LOGO } });
  });

  it('SVG déguisé en PNG, PNG nommé JPEG ou SVG : refusés', async () => {
    const svgAsPng = await readLogoFile(blob(LOGO), 'logo.png');
    expect(svgAsPng).toEqual({ ok: false, error: 'Le contenu du fichier ne correspond pas à son extension.' });
    expect((await readLogoFile(blob(PNG), 'logo.jpg')).ok).toBe(false);
    expect((await readLogoFile(blob(JPEG), 'logo.png')).ok).toBe(false);
    expect((await readLogoFile(blob(PNG), 'logo.svg')).ok).toBe(false);
  });

  it('format, taille, contenu : refus en français', async () => {
    expect(await readLogoFile(blob(PNG), 'logo.gif')).toEqual({ ok: false, error: 'Format refusé : SVG, PNG ou JPEG attendu.' });
    expect((await readLogoFile(blob(PNG), 'logo')).ok).toBe(false);
    expect(await readLogoFile(blob(''), 'logo.png')).toEqual({ ok: false, error: 'Fichier vide.' });
    const big = new Uint8Array(MAX_LOGO_BYTES + 1);
    big.set(PNG.subarray(0, 8));
    expect(await readLogoFile(blob(big), 'logo.png')).toEqual({ ok: false, error: 'Logo trop lourd : 512 Kio au plus.' });
    const max = new Uint8Array(MAX_LOGO_BYTES);
    max.set(PNG.subarray(0, 8));
    expect((await readLogoFile(blob(max), 'logo.png')).ok).toBe(true);
    const script = await readLogoFile(blob('<svg viewBox="0 0 1 1"><script>alert(1)</script></svg>'), 'logo.svg');
    expect(script.ok).toBe(false);
    expect(!script.ok && script.error).toMatch(/^Logo SVG refusé/);
    const external = await readLogoFile(blob('<svg viewBox="0 0 1 1"><image href="https://x/y.png"/></svg>'), 'logo.svg');
    expect(external.ok).toBe(false);
    const noViewBox = await readLogoFile(blob('<svg width="1" height="1"></svg>'), 'logo.svg');
    expect(!noViewBox.ok && noViewBox.error).toMatch(/viewBox/);
    const latin1 = await readLogoFile(blob(new Uint8Array([0x3c, 0x73, 0x76, 0x67, 0xe9, 0x3e])), 'logo.svg');
    expect(!latin1.ok && latin1.error).toMatch(/UTF-8/);
  });

  it('jamais par fetch (CSP connect-src)', async () => {
    const spy = jest.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('fetch interdit'));
    expect((await readLogoFile(blob(PNG), 'logo.png')).ok).toBe(true);
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });
});
