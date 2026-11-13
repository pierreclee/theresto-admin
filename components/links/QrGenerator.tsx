'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, Download, ImageOff, RotateCcw, Save, Upload } from 'lucide-react';
import { buildQrMatrix, checkQrColors, logoAreaRatio, qrSvg, type LogoSource } from '@/lib/links/qrCode';
import { downloadBlob, loadQrLogoSvg, readLogoFile, svgToPngBlob } from '@/lib/links/browserFiles';
import { shortLinkUrl } from '@/lib/links/shortLinkRules';
import {
  DEFAULT_QR_STYLE,
  QR_EYE_SHAPES,
  QR_MODULE_SHAPES,
  type QrEyeShape,
  type QrLogoKind,
  type QrModuleShape,
  type QrStyle,
} from '@/lib/links/qrStyle';
import { useQrLogo, useSaveQrStyle, type QrStyleDraft } from '@/lib/hooks/useShortLinks';
import { ActionError } from '@/lib/api/actionResult';
import { useToast } from '@/components/shared/Toaster';
import {
  EYE_SHAPE_LABELS,
  EyeShapeIcon,
  MODULE_SHAPE_LABELS,
  ModuleShapeIcon,
  ShapePicker,
} from '@/components/links/QrShapePicker';
import type { ShortLink } from '@/lib/types/shortLinks';

const PNG_PIXELS = 2000;

/** Réglages affichés (sans le chemin du logo, porté à part). */
interface StyleDraft {
  modules: QrModuleShape;
  eyeFrame: QrEyeShape;
  eyeDot: QrEyeShape;
  fg: string;
  bg: string;
  logo: QrLogoKind;
}

function draftOf(style: QrStyle): StyleDraft {
  return { modules: style.modules, eyeFrame: style.eyeFrame, eyeDot: style.eyeDot, fg: style.fg, bg: style.bg, logo: style.logo };
}

const sameDraft = (a: StyleDraft, b: StyleDraft) =>
  a.modules === b.modules && a.eyeFrame === b.eyeFrame && a.eyeDot === b.eyeDot
  && a.fg.toUpperCase() === b.fg.toUpperCase() && a.bg.toUpperCase() === b.bg.toUpperCase() && a.logo === b.logo;

/** Clé du style enregistré : l'écran repart du style enregistré quand il change (`key` du composant). */
export function qrStyleKey(style: QrStyle | null): string {
  return style ? JSON.stringify(draftOf(style)) + (style.logo === 'custom' ? style.logoPath : '') : 'default';
}

const LOGO_LABELS: Record<QrLogoKind, string> = { none: 'Aucun', theresto: 'Logo TheResto', custom: 'Importer un fichier' };

interface ImportedLogo {
  file: File;
  source: LogoSource;
}

/**
 * QR d'un lien court, généré dans le navigateur (aucun service tiers). Il encode toujours
 * https://<domaine>/<slug> ; style réglé ici et enregistré par lien (short_links.qr_style) ;
 * exports SVG, PNG 2000 px et PDF A5 dans le style affiché.
 *
 * Logo importé : contrôlé dans le navigateur dès l'import (aperçu immédiat), mais envoyé au
 * bucket seulement à « Enregistrer le style » : un import abandonné ou remplacé ne laisse aucun
 * fichier, et le serveur recontrôle le fichier au moment où il devient le logo du lien.
 */
export function QrGenerator({ link, domain, defaultTitle }: { link: ShortLink; domain: string; defaultTitle: string }) {
  const toast = useToast();
  const saved = link.qrStyle ?? DEFAULT_QR_STYLE;
  const savedPath = saved.logo === 'custom' ? saved.logoPath : null;
  // Titre imprimé sur le PDF : saisi ici, jamais le libellé interne du lien (jamais publié).
  const [title, setTitle] = useState(defaultTitle);
  const [draft, setDraft] = useState<StyleDraft>(() => draftOf(saved));
  const [imported, setImported] = useState<ImportedLogo | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [therestoSvg, setTherestoSvg] = useState<string | null>(null);
  const [therestoFailed, setTherestoFailed] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const savedLogo = useQrLogo(savedPath);
  const save = useSaveQrStyle();

  const url = shortLinkUrl(domain, link.slug);

  useEffect(() => {
    let cancelled = false;
    loadQrLogoSvg()
      .then((svg) => { if (!cancelled) setTherestoSvg(svg); })
      .catch(() => { if (!cancelled) setTherestoFailed(true); });
    return () => { cancelled = true; };
  }, []);

  const update = (patch: Partial<StyleDraft>) => setDraft((d) => ({ ...d, ...patch }));

  const customSource: LogoSource | null = imported?.source ?? savedLogo.data ?? null;
  const customMissing = draft.logo === 'custom' && !imported && savedPath !== null && savedLogo.isError;
  const logoSource = useMemo<LogoSource | null | undefined>(() => (
    draft.logo === 'none' ? undefined
      : draft.logo === 'theresto' ? (therestoSvg ? { kind: 'svg', markup: therestoSvg } : null)
        : customSource
  ), [draft.logo, therestoSvg, customSource]);

  const colorCheck = checkQrColors(draft.fg, draft.bg);
  const matrix = useMemo(() => buildQrMatrix(url, { withLogo: draft.logo !== 'none' }), [url, draft.logo]);
  const { svg, renderError } = useMemo(() => {
    if (!colorCheck.ok || logoSource === null) return { svg: null, renderError: null };
    try {
      return {
        svg: qrSvg(matrix, {
          darkColor: draft.fg,
          lightColor: draft.bg,
          modules: draft.modules,
          eyeFrame: draft.eyeFrame,
          eyeDot: draft.eyeDot,
          logo: logoSource,
          pixels: 512,
        }),
        renderError: null,
      };
    } catch (e) {
      return { svg: null, renderError: e instanceof Error ? e.message : 'Rendu du QR impossible.' };
    }
  }, [matrix, draft.fg, draft.bg, draft.modules, draft.eyeFrame, draft.eyeDot, logoSource, colorCheck.ok]);
  const previewUrl = useMemo(() => (svg ? `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}` : null), [svg]);

  const dirty = !sameDraft(draft, draftOf(saved)) || (draft.logo === 'custom' && imported !== null);
  const customReady = draft.logo !== 'custom' || imported !== null || (savedPath !== null && !savedLogo.isError);
  const canSave = dirty && colorCheck.ok && customReady && !save.isPending;

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    const result = await readLogoFile(file, file.name);
    if (!result.ok) {
      setImportError(result.error);
      return;
    }
    setImportError(null);
    setImported({ file, source: result.source });
    update({ logo: 'custom' });
  };

  const chooseLogo = (kind: QrLogoKind) => {
    if (kind === 'custom' && !imported && !savedPath) {
      fileInput.current?.click();
      return;
    }
    update({ logo: kind });
  };

  const revert = () => {
    setDraft(draftOf(saved));
    setImported(null);
    setImportError(null);
  };

  const onSave = () => {
    const base = { v: 1 as const, modules: draft.modules, eyeFrame: draft.eyeFrame, eyeDot: draft.eyeDot, fg: draft.fg.toUpperCase(), bg: draft.bg.toUpperCase() };
    let payload: QrStyleDraft;
    if (draft.logo === 'custom' && imported) {
      payload = { style: { ...base, logo: 'custom' }, file: imported.file, source: imported.source };
    } else if (draft.logo === 'custom') {
      payload = { style: { ...base, logo: 'custom', logoPath: savedPath! } };
    } else {
      payload = { style: { ...base, logo: draft.logo } };
    }
    save.mutate({ link, draft: payload }, {
      onError: (e) => {
        if (e instanceof ActionError && e.code === 'conflict') {
          toast("Ce lien a été modifié entre-temps : il vient d'être relu. Vérifiez le style puis enregistrez de nouveau.", 'error');
        } else {
          toast(e instanceof Error ? e.message : 'Enregistrement impossible.', 'error');
        }
      },
    });
  };

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

  const base = `qr-${link.slug}`;
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

  const previewMessage = !colorCheck.ok ? 'Couleurs refusées'
    : renderError ? 'Rendu impossible'
      : draft.logo === 'theresto' && therestoFailed ? 'Logo TheResto indisponible'
        : customMissing ? 'Logo importé introuvable'
          : 'Chargement du logo…';

  return (
    <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
      <div className="px-5 py-4 border-b border-gray-50 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-gray-900">QR code</h3>
          <p className="text-xs text-gray-400 mt-0.5">
            Généré dans votre navigateur. Il encode <span className="font-mono text-gray-600">{url}</span>.
          </p>
        </div>
        {dirty && (
          <span className="px-2 py-1 text-[11px] font-medium text-amber-700 bg-amber-50 border border-amber-100 rounded-lg">
            Modifications non enregistrées
          </span>
        )}
      </div>
      <div className="p-5 flex flex-col md:flex-row gap-6">
        <div className="w-64 h-64 flex-shrink-0 rounded-xl border border-gray-100 bg-gray-50 flex items-center justify-center overflow-hidden">
          {previewUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={previewUrl} alt={`QR code de ${url}`} width={256} height={256} data-testid="qr-preview" />
          ) : (
            <span className="text-xs text-gray-400 px-4 text-center">{previewMessage}</span>
          )}
        </div>
        <div className="flex-1 min-w-0 space-y-4">
          <ShapePicker
            label="Petits carrés"
            options={QR_MODULE_SHAPES}
            labels={MODULE_SHAPE_LABELS}
            value={draft.modules}
            onChange={(modules) => update({ modules })}
            icon={(shape) => <ModuleShapeIcon shape={shape} />}
          />
          <div className="flex flex-wrap gap-x-6 gap-y-4">
            <ShapePicker
              label="Cadre des coins"
              options={QR_EYE_SHAPES}
              labels={EYE_SHAPE_LABELS}
              value={draft.eyeFrame}
              onChange={(eyeFrame) => update({ eyeFrame })}
              icon={(shape) => <EyeShapeIcon shape={shape} part="frame" />}
            />
            <ShapePicker
              label="Point des coins"
              options={QR_EYE_SHAPES}
              labels={EYE_SHAPE_LABELS}
              value={draft.eyeDot}
              onChange={(eyeDot) => update({ eyeDot })}
              icon={(shape) => <EyeShapeIcon shape={shape} part="dot" />}
            />
          </div>
          {draft.eyeFrame !== draft.eyeDot && (
            <p className="text-xs text-gray-500">
              Combinaison moins bien lue par certains lecteurs : testez le QR imprimé avec un iPhone et un Android.
            </p>
          )}
          <div className="grid grid-cols-2 gap-4">
            <label className="text-xs font-medium text-gray-600">
              Modules (foncés)
              <span className="mt-1.5 flex items-center gap-2">
                <input type="color" value={draft.fg} onChange={(e) => update({ fg: e.target.value })} className="h-9 w-12 rounded border border-gray-200" />
                <span className="font-mono text-gray-500">{draft.fg.toUpperCase()}</span>
              </span>
            </label>
            <label className="text-xs font-medium text-gray-600">
              Fond (clair)
              <span className="mt-1.5 flex items-center gap-2">
                <input type="color" value={draft.bg} onChange={(e) => update({ bg: e.target.value })} className="h-9 w-12 rounded border border-gray-200" />
                <span className="font-mono text-gray-500">{draft.bg.toUpperCase()}</span>
              </span>
            </label>
          </div>
          <fieldset>
            <legend className="text-xs font-medium text-gray-600">Logo au centre</legend>
            <div className="mt-1.5 flex flex-wrap gap-2" role="group" aria-label="Logo au centre">
              {(['none', 'theresto', 'custom'] as const).map((kind) => (
                <button
                  key={kind}
                  type="button"
                  aria-pressed={draft.logo === kind}
                  onClick={() => chooseLogo(kind)}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-lg border text-xs ${
                    draft.logo === kind
                      ? 'border-[#FF6B35] bg-orange-50 text-[#FF6B35] font-semibold'
                      : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  {kind === 'none' && <ImageOff size={13} />}
                  {kind === 'custom' && <Upload size={13} />}
                  {LOGO_LABELS[kind]}
                </button>
              ))}
            </div>
            <input
              ref={fileInput}
              type="file"
              accept=".svg,.png,.jpg,.jpeg"
              aria-label="Fichier du logo"
              className="hidden"
              onChange={(e) => {
                void onFile(e.target.files?.[0]);
                e.target.value = '';
              }}
            />
            {draft.logo === 'custom' && (
              <p className="mt-2 text-xs text-gray-500 flex flex-wrap items-center gap-2">
                {imported
                  ? <>Fichier importé : <span className="font-mono text-gray-700">{imported.file.name}</span> (envoyé à l&apos;enregistrement).</>
                  : savedLogo.isPending ? 'Chargement du logo enregistré…' : 'Logo enregistré pour ce lien.'}
                <button type="button" onClick={() => fileInput.current?.click()} className="text-[#FF6B35] hover:underline">
                  Choisir un autre fichier
                </button>
              </p>
            )}
            <p className="mt-1 text-[11px] text-gray-400">SVG, PNG ou JPEG, 512 Kio au plus.</p>
          </fieldset>
          {importError && (
            <p role="alert" className="flex gap-2 p-3 rounded-xl bg-red-50 border border-red-100 text-xs text-red-700">
              <AlertTriangle size={14} className="shrink-0 mt-0.5" />
              {importError}
            </p>
          )}
          {customMissing && (
            <div role="alert" className="flex flex-wrap items-center gap-2 p-3 rounded-xl bg-red-50 border border-red-100 text-xs text-red-700">
              <AlertTriangle size={14} className="shrink-0" />
              <span>
                Logo enregistré illisible
                {savedLogo.error instanceof ActionError ? ` : ${savedLogo.error.message}` : ''}. Importez-le de nouveau ou utilisez le logo TheResto.
              </span>
              <button type="button" onClick={() => update({ logo: 'theresto' })} className="font-semibold underline">
                Utiliser le logo TheResto
              </button>
            </div>
          )}
          {draft.logo === 'theresto' && therestoFailed && (
            <p role="alert" className="flex gap-2 p-3 rounded-xl bg-red-50 border border-red-100 text-xs text-red-700">
              <AlertTriangle size={14} className="shrink-0 mt-0.5" />
              Logo TheResto indisponible : rechargez la page ou choisissez « Aucun ».
            </p>
          )}
          <label className="block text-xs font-medium text-gray-600">
            Titre du PDF
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={80}
              className="mt-1.5 w-full text-sm border border-gray-200 rounded-xl px-3 py-2 focus:outline-none focus:border-[#FF6B35] focus:ring-2 focus:ring-[#FF6B35]/20"
            />
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
          {renderError && (
            <p role="alert" className="flex gap-2 p-3 rounded-xl bg-red-50 border border-red-100 text-xs text-red-700">
              <AlertTriangle size={14} className="shrink-0 mt-0.5" />
              {renderError}
            </p>
          )}
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={onSave}
              disabled={!canSave}
              className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-white bg-[#FF6B35] hover:bg-[#e85d2a] rounded-lg disabled:opacity-40"
            >
              <Save size={13} />
              {save.isPending ? 'Enregistrement…' : 'Enregistrer le style'}
            </button>
            <button
              type="button"
              onClick={revert}
              disabled={!dirty || save.isPending}
              className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-40"
            >
              <RotateCcw size={13} />
              Revenir au style enregistré
            </button>
          </div>
          <div className="flex flex-wrap gap-2">
            {([
              ['svg', 'SVG', exportSvg],
              ['png', `PNG ${PNG_PIXELS} px`, exportPng],
              ['pdf', 'PDF A5', exportPdf],
            ] as const).map(([kind, label, action]) => (
              <button
                key={kind}
                type="button"
                onClick={action}
                disabled={!svg || busy !== null}
                className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-white bg-gray-800 hover:bg-gray-900 rounded-lg disabled:opacity-40"
              >
                <Download size={13} />
                {busy === kind ? 'Export…' : label}
              </button>
            ))}
          </div>
          <p className="text-xs text-gray-400">
            Les exports reprennent le style affiché, enregistré ou non. Testez le QR imprimé avec un iPhone et un Android avant un tirage.
          </p>
        </div>
      </div>
    </div>
  );
}
