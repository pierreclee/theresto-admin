'use client';

// Fichiers produits dans le navigateur (QR, CSV) : aucun service tiers. Les téléchargements
// passent par une URL blob: locale (la CSP n'a rien à autoriser de plus : img-src data: blob:).

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
