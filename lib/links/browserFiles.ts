'use client';

// Fichiers produits dans le navigateur (QR, CSV) : aucun service tiers. Les téléchargements
// passent par une URL blob: locale (la CSP n'a rien à autoriser de plus : img-src data: blob:).

import { MAX_LOGO_BYTES } from './qrCode';
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

/** Rend le SVG (autonome, sans ressource externe) en PNG carré de `pixels` px. */
export async function svgToPngBlob(svg: string, pixels: number): Promise<Blob> {
  const sized = svg.replace(/width="\d+" height="\d+"/, `width="${pixels}" height="${pixels}"`);
  const url = URL.createObjectURL(new Blob([sized], { type: 'image/svg+xml' }));
  try {
    const image = new Image();
    image.decoding = 'async';
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(new Error('Rendu du QR impossible'));
      image.src = url;
    });
    // Logo PNG / JPEG embarqué (data:) : décodé avant le dessin. Une image data: dans un SVG
    // chargé comme <img> ne « salit » pas le canvas (aucune ressource d'une autre origine).
    await image.decode().catch(() => undefined);
    const canvas = document.createElement('canvas');
    canvas.width = pixels;
    canvas.height = pixels;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Rendu du QR impossible');
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(image, 0, 0, pixels, pixels);
    return await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('Rendu du QR impossible'))), 'image/png'));
  } finally {
    URL.revokeObjectURL(url);
  }
}
