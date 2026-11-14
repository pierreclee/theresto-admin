'use client';

// Fichiers produits dans le navigateur (QR, CSV) : aucun service tiers. Les téléchargements
// passent par une URL blob: locale (la CSP n'a rien à autoriser de plus : img-src data: blob:).

import { fitInSquare, MAX_LOGO_BYTES, type QrLogoGeometry, type RasterMime } from './qrCode';
import { checkLogoBytes, LOGO_FORMAT_ERROR, LOGO_SIZE_ERROR, logoExtensionOf, type LogoFileResult } from './qrLogoFile';

export type { LogoFileResult } from './qrLogoFile';

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Logo du QR, servi par le site (public/qr-logo.svg). */
export const QR_LOGO_PATH = '/qr-logo.svg';

export async function loadQrLogoSvg(): Promise<string> {
  const response = await fetch(QR_LOGO_PATH);
  if (!response.ok) throw new Error('Logo introuvable');
  return response.text();
}

/**
 * Logo importé pour le QR (SVG, PNG ou JPEG, 512 Kio au plus). Lu par arrayBuffer(), jamais
 * par fetch(blob:) (la CSP connect-src ne l'autorise pas). L'extension et les octets doivent
 * concorder ; un SVG passe par le même filtre que le logo intégré (checkLogoBytes, partagé
 * avec le serveur).
 */
export async function readLogoFile(file: Blob, name: string): Promise<LogoFileResult> {
  if (!logoExtensionOf(name)) return { ok: false, error: LOGO_FORMAT_ERROR };
  if (file.size === 0) return { ok: false, error: 'Fichier vide.' };
  if (file.size > MAX_LOGO_BYTES) return { ok: false, error: LOGO_SIZE_ERROR };
  let bytes: Uint8Array;
  try {
    bytes = new Uint8Array(await file.arrayBuffer());
  } catch {
    return { ok: false, error: 'Lecture du fichier impossible.' };
  }
  return checkLogoBytes(bytes, name);
}

/** Logo PNG / JPEG posé sur le canvas après le QR (au lieu d'être embarqué dans le SVG). */
export interface PngLogoOverlay {
  mime: RasterMime;
  base64: string;
  geometry: QrLogoGeometry;
}

function loadImage(src: string, decode: boolean): Promise<HTMLImageElement> {
  const image = new Image();
  image.decoding = 'async';
  const loaded = new Promise<void>((resolve, reject) => {
    image.onload = () => resolve();
    image.onerror = () => reject(new Error('Rendu du QR impossible'));
  });
  image.src = src;
  // decode() attend que l'image soit décodée (prête à dessiner) ; repli sur onload.
  return (decode && typeof image.decode === 'function' ? image.decode().catch(() => loaded) : loaded).then(() => image);
}

/**
 * Rend le SVG (autonome, sans ressource externe) en PNG carré de `pixels` px.
 *
 * Logo PNG / JPEG : Safari et Firefox peuvent dessiner un SVG chargé comme <img> avant d'avoir
 * décodé l'image data: qu'il contient (logo absent du PNG). Le SVG reçu est alors celui du QR
 * sans le logo (qrSvg, rasterLogo: 'omit') ; le logo est chargé dans une Image à part, attendu
 * par decode(), puis dessiné aux mêmes coordonnées, découpé au même disque.
 */
export async function svgToPngBlob(svg: string, pixels: number, logo?: PngLogoOverlay): Promise<Blob> {
  const sized = svg.replace(/width="\d+" height="\d+"/, `width="${pixels}" height="${pixels}"`);
  const url = URL.createObjectURL(new Blob([sized], { type: 'image/svg+xml' }));
  try {
    const [image, logoImage] = await Promise.all([
      loadImage(url, false),
      logo ? loadImage(`data:${logo.mime};base64,${logo.base64}`, true) : Promise.resolve(null),
    ]);
    const canvas = document.createElement('canvas');
    canvas.width = pixels;
    canvas.height = pixels;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Rendu du QR impossible');
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(image, 0, 0, pixels, pixels);
    if (logo && logoImage) {
      const { geometry: g } = logo;
      const k = pixels / g.total;
      const box = fitInSquare(g.x, g.y, g.side, logoImage.naturalWidth, logoImage.naturalHeight);
      ctx.save();
      ctx.beginPath();
      ctx.arc(g.cx * k, g.cy * k, g.r * k, 0, Math.PI * 2);
      ctx.clip();
      ctx.imageSmoothingEnabled = true;
      ctx.drawImage(logoImage, box.x * k, box.y * k, box.width * k, box.height * k);
      ctx.restore();
    }
    return await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('Rendu du QR impossible'))), 'image/png'));
  } finally {
    URL.revokeObjectURL(url);
  }
}
