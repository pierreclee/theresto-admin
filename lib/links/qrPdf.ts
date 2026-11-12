// PDF A5 d'un QR de lien court (P10) : titre, QR, URL courte en clair. pdf-lib (MIT), en
// local dans le navigateur, polices standard (aucun téléchargement). Importé à la demande.
import { PDFDocument, StandardFonts, rgb, type PDFFont } from 'pdf-lib';

// ─── PDF A5 ─────────────────────────────────────────────────────────────────

/** A5 portrait en points (148 × 210 mm). */
export const A5_SIZE: [number, number] = [419.53, 595.28];

/** Texte limité aux caractères de la police standard (WinAnsi) : les autres deviennent « ? ». */
export function encodableText(font: Pick<PDFFont, 'encodeText'>, text: string): string {
  return [...text].map((ch) => {
    try {
      font.encodeText(ch);
      return ch;
    } catch {
      return '?';
    }
  }).join('');
}

function fittedSize(font: PDFFont, text: string, maxWidth: number, preferred: number, min: number): number {
  let size = preferred;
  while (size > min && font.widthOfTextAtSize(text, size) > maxWidth) size -= 1;
  return size;
}

/** PDF A5 : titre, QR (PNG haute définition), URL courte en clair. */
export async function buildQrPdf(input: { pngBytes: Uint8Array; title: string; url: string }): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  pdf.setTitle(input.title);
  pdf.setProducer('TheResto Admin');
  pdf.setCreator('TheResto Admin');
  const page = pdf.addPage(A5_SIZE);
  const [width, height] = A5_SIZE;
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const margin = 36;
  const maxWidth = width - margin * 2;

  const title = encodableText(bold, input.title.trim() || input.url);
  const titleSize = fittedSize(bold, title, maxWidth, 24, 10);
  page.drawText(title, {
    x: (width - Math.min(bold.widthOfTextAtSize(title, titleSize), maxWidth)) / 2,
    y: height - margin - titleSize,
    size: titleSize,
    font: bold,
    color: rgb(0.06, 0.09, 0.16),
    maxWidth,
  });

  const image = await pdf.embedPng(input.pngBytes);
  const qrSide = maxWidth;
  const qrY = (height - qrSide) / 2 - 10;
  page.drawImage(image, { x: margin, y: qrY, width: qrSide, height: qrSide });

  const url = encodableText(regular, input.url.replace(/^https:\/\//, ''));
  const urlSize = fittedSize(regular, url, maxWidth, 18, 8);
  page.drawText(url, {
    x: (width - regular.widthOfTextAtSize(url, urlSize)) / 2,
    y: qrY - 30,
    size: urlSize,
    font: regular,
    color: rgb(0.06, 0.09, 0.16),
  });

  return pdf.save();
}
