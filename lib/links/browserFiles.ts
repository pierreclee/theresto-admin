'use client';

// Fichiers produits dans le navigateur (QR, CSV) : aucun service tiers. Les téléchargements
// passent par une URL blob: locale (la CSP n'a rien à autoriser de plus : img-src data: blob:).

import {
  bytesToBase64,
  MAX_LOGO_BYTES,
  rasterLogoError,
  rasterMimeOf,
  sanitizeLogoSvg,
  type LogoSource,
} from './qrCode';

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

export type LogoFileResult =
  | { ok: true; source: LogoSource; extension: 'svg' | 'png' | 'jpg' }
  | { ok: false; error: string };

/**
 * Logo importé pour le QR (SVG, PNG ou JPEG, 512 Kio au plus). Lu par arrayBuffer(), jamais
 * par fetch(blob:) (la CSP connect-src ne l'autorise pas). L'extension et les octets doivent
 * concorder ; un SVG passe par le même filtre que le logo intégré.
 */
export async function readLogoFile(file: Blob, name: string): Promise<LogoFileResult> {
  const ext = /\.([a-z0-9]+)$/i.exec(name.trim())?.[1]?.toLowerCase();
  const extension = ext === 'jpeg' ? 'jpg' : ext;
  if (extension !== 'svg' && extension !== 'png' && extension !== 'jpg') {
    return { ok: false, error: 'Format refusé : SVG, PNG ou JPEG attendu.' };
  }
  if (file.size === 0) return { ok: false, error: 'Fichier vide.' };
  if (file.size > MAX_LOGO_BYTES) return { ok: false, error: 'Logo trop lourd : 512 Kio au plus.' };
  let bytes: Uint8Array;
  try {
    bytes = new Uint8Array(await file.arrayBuffer());
  } catch {
    return { ok: false, error: 'Lecture du fichier impossible.' };
  }
  const detected = rasterMimeOf(bytes);
  if (extension === 'svg') {
    if (detected) return { ok: false, error: 'Le contenu du fichier ne correspond pas à son extension.' };
    let markup: string;
    try {
      markup = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
    } catch {
      return { ok: false, error: 'Logo SVG refusé : texte illisible (UTF-8 attendu).' };
    }
    try {
      sanitizeLogoSvg(markup);
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : 'Logo SVG refusé.' };
    }
    return { ok: true, source: { kind: 'svg', markup }, extension };
  }
  const mime = extension === 'png' ? 'image/png' : 'image/jpeg';
  if (detected !== mime) return { ok: false, error: 'Le contenu du fichier ne correspond pas à son extension.' };
  const base64 = bytesToBase64(bytes);
  const error = rasterLogoError(mime, base64);
  if (error) return { ok: false, error };
  return { ok: true, source: { kind: 'raster', mime, base64 }, extension };
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
