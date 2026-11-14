// Contrôle d'un logo importé pour le QR (SVG, PNG ou JPEG, 512 Kio au plus), fonction pure
// partagée par le navigateur (readLogoFile, lib/links/browserFiles.ts) et le serveur
// (uploadQrLogoAction, readQrLogoAction de lib/actions/shortLinks.ts) : mêmes règles des deux
// côtés. L'extension et les octets doivent concorder ; un SVG passe par le filtre du moteur
// (sanitizeLogoSvg : liste blanche après analyse XML, lib/links/svgSanitize.ts).

import {
  bytesToBase64,
  MAX_LOGO_BYTES,
  rasterLogoError,
  rasterMimeOf,
  sanitizeLogoSvg,
  type LogoSource,
} from './qrCode';

export type LogoExtension = 'svg' | 'png' | 'jpg';

export type LogoFileResult =
  | { ok: true; source: LogoSource; extension: LogoExtension }
  | { ok: false; error: string };

export const LOGO_CONTENT_TYPES: Record<LogoExtension, string> = {
  svg: 'image/svg+xml',
  png: 'image/png',
  jpg: 'image/jpeg',
};

/** Extension d'un nom de fichier (.jpeg lu comme jpg), ou null si elle n'est pas acceptée. */
export function logoExtensionOf(name: string): LogoExtension | null {
  const ext = /\.([a-z0-9]+)$/i.exec(name.trim())?.[1]?.toLowerCase();
  const extension = ext === 'jpeg' ? 'jpg' : ext;
  return extension === 'svg' || extension === 'png' || extension === 'jpg' ? extension : null;
}

export const LOGO_FORMAT_ERROR = 'Format refusé : SVG, PNG ou JPEG attendu.';
export const LOGO_SIZE_ERROR = 'Logo trop lourd : 512 Kio au plus.';
export const LOGO_MISMATCH_ERROR = 'Le contenu du fichier ne correspond pas à son extension.';

/** Contrôle les octets d'un logo nommé `name` ; renvoie la source à dessiner ou un refus en français. */
export function checkLogoBytes(bytes: Uint8Array, name: string): LogoFileResult {
  const extension = logoExtensionOf(name);
  if (!extension) return { ok: false, error: LOGO_FORMAT_ERROR };
  if (bytes.length === 0) return { ok: false, error: 'Fichier vide.' };
  if (bytes.length > MAX_LOGO_BYTES) return { ok: false, error: LOGO_SIZE_ERROR };
  const detected = rasterMimeOf(bytes);
  if (extension === 'svg') {
    if (detected) return { ok: false, error: LOGO_MISMATCH_ERROR };
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
  if (detected !== mime) return { ok: false, error: LOGO_MISMATCH_ERROR };
  const base64 = bytesToBase64(bytes);
  const error = rasterLogoError(mime, base64);
  if (error) return { ok: false, error };
  return { ok: true, source: { kind: 'raster', mime, base64 }, extension };
}
