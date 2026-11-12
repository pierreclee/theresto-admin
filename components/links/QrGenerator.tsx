'use client';

import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Download } from 'lucide-react';
import { buildQrMatrix, checkQrColors, logoAreaRatio, qrSvg } from '@/lib/links/qrCode';
import { downloadBlob, loadQrLogoSvg, svgToPngBlob } from '@/lib/links/browserFiles';
import { shortLinkUrl } from '@/lib/links/shortLinkRules';
import { useToast } from '@/components/shared/Toaster';

const PNG_PIXELS = 2000;

/**
 * QR d'un lien court, généré dans le navigateur (aucun service tiers). Il encode toujours
 * https://<domaine>/<slug> ; exports SVG, PNG 2000 px et PDF A5.
 */
export function QrGenerator({ domain, slug, defaultTitle }: { domain: string; slug: string; defaultTitle: string }) {
  const toast = useToast();
  // Titre imprimé sur le PDF : saisi ici, jamais le libellé interne du lien (jamais publié).
  const [title, setTitle] = useState(defaultTitle);
  const [darkColor, setDarkColor] = useState('#0F1629');
  const [lightColor, setLightColor] = useState('#FFFFFF');
  const [withLogo, setWithLogo] = useState(true);
  const [logoSvg, setLogoSvg] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const url = shortLinkUrl(domain, slug);

  useEffect(() => {
    let cancelled = false;
    loadQrLogoSvg()
      .then((svg) => { if (!cancelled) setLogoSvg(svg); })
      .catch(() => { if (!cancelled) setWithLogo(false); });
    return () => { cancelled = true; };
  }, []);

  const colorCheck = checkQrColors(darkColor, lightColor);
  const logoReady = !withLogo || logoSvg !== null;
  const matrix = useMemo(() => buildQrMatrix(url, { withLogo }), [url, withLogo]);
  const svg = useMemo(() => {
    if (!colorCheck.ok || !logoReady) return null;
    return qrSvg(matrix, { darkColor, lightColor, logoSvg: logoSvg ?? undefined, pixels: 512 });
  }, [matrix, darkColor, lightColor, logoSvg, colorCheck.ok, logoReady]);
  const previewUrl = useMemo(() => (svg ? `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}` : null), [svg]);

  const run = async (kind: string, task: () => Promise<void>) => {
    setBusy(kind);
    try {
      await task();
    } catch (e) {
      console.error('[qr] export impossible', e);
      toast("L'export du QR a échoué.", 'error');
    } finally {
      setBusy(null);
    }
  };

  const base = `qr-${slug}`;
  const exportSvg = () => run('svg', async () => {
    downloadBlob(new Blob([svg!], { type: 'image/svg+xml' }), `${base}.svg`);
  });
  const exportPng = () => run('png', async () => {
    downloadBlob(await svgToPngBlob(svg!, PNG_PIXELS), `${base}-${PNG_PIXELS}px.png`);
  });
  const exportPdf = () => run('pdf', async () => {
    const png = await svgToPngBlob(svg!, PNG_PIXELS);
    const { buildQrPdf } = await import('@/lib/links/qrPdf');
    const bytes = await buildQrPdf({ pngBytes: new Uint8Array(await png.arrayBuffer()), title, url });
    downloadBlob(new Blob([bytes as BlobPart], { type: 'application/pdf' }), `${base}-A5.pdf`);
  });

  return (
    <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
      <div className="px-5 py-4 border-b border-gray-50">
        <h3 className="text-sm font-semibold text-gray-900">QR code</h3>
        <p className="text-xs text-gray-400 mt-0.5">
          Généré dans votre navigateur. Il encode <span className="font-mono text-gray-600">{url}</span>.
        </p>
      </div>
      <div className="p-5 flex flex-col md:flex-row gap-6">
        <div className="w-64 h-64 flex-shrink-0 rounded-xl border border-gray-100 bg-gray-50 flex items-center justify-center overflow-hidden">
          {previewUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={previewUrl} alt={`QR code de ${url}`} width={256} height={256} />
          ) : (
            <span className="text-xs text-gray-400 px-4 text-center">{colorCheck.ok ? 'Chargement du logo…' : 'Couleurs refusées'}</span>
          )}
        </div>
        <div className="flex-1 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <label className="text-xs font-medium text-gray-600">
              Modules (foncés)
              <span className="mt-1.5 flex items-center gap-2">
                <input type="color" value={darkColor} onChange={(e) => setDarkColor(e.target.value)} className="h-9 w-12 rounded border border-gray-200" />
                <span className="font-mono text-gray-500">{darkColor.toUpperCase()}</span>
              </span>
            </label>
            <label className="text-xs font-medium text-gray-600">
              Fond (clair)
              <span className="mt-1.5 flex items-center gap-2">
                <input type="color" value={lightColor} onChange={(e) => setLightColor(e.target.value)} className="h-9 w-12 rounded border border-gray-200" />
                <span className="font-mono text-gray-500">{lightColor.toUpperCase()}</span>
              </span>
            </label>
          </div>
          <label className="block text-xs font-medium text-gray-600">
            Titre du PDF
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={80}
              className="mt-1.5 w-full text-sm border border-gray-200 rounded-xl px-3 py-2 focus:outline-none focus:border-[#FF6B35] focus:ring-2 focus:ring-[#FF6B35]/20"
            />
          </label>
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input type="checkbox" checked={withLogo} onChange={(e) => setWithLogo(e.target.checked)} disabled={logoSvg === null && !withLogo} />
            Logo TheResto au centre
          </label>
          <p className="text-xs text-gray-400">
            Correction d&apos;erreur {matrix.errorCorrection}
            {matrix.logo ? ` (logo : ${(logoAreaRatio(matrix) * 100).toFixed(0)} % de la surface)` : ''}, zone de silence de 4 modules,
            contraste {colorCheck.ratio ? `${colorCheck.ratio.toFixed(1)}:1` : 'inconnu'}.
          </p>
          {!colorCheck.ok && (
            <p role="alert" className="flex gap-2 p-3 rounded-xl bg-red-50 border border-red-100 text-xs text-red-700">
              <AlertTriangle size={14} className="shrink-0 mt-0.5" />
              {colorCheck.error}
            </p>
          )}
          <div className="flex flex-wrap gap-2">
            {([
              ['svg', 'SVG', exportSvg],
              ['png', `PNG ${PNG_PIXELS} px`, exportPng],
              ['pdf', 'PDF A5', exportPdf],
            ] as const).map(([kind, label, action]) => (
              <button
                key={kind}
                onClick={action}
                disabled={!svg || busy !== null}
                className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-white bg-gray-800 hover:bg-gray-900 rounded-lg disabled:opacity-40"
              >
                <Download size={13} />
                {busy === kind ? 'Export…' : label}
              </button>
            ))}
          </div>
          <p className="text-xs text-gray-400">Testez le QR imprimé avec un iPhone et un Android avant un tirage.</p>
        </div>
      </div>
    </div>
  );
}
