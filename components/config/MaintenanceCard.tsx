'use client';

import { useEffect, useState } from 'react';
import { AlertTriangle, CalendarClock, Power, Wrench, X } from 'lucide-react';
import { TotpCodeField } from '@/components/shared/TotpCodeField';
import { useMaintenancePeriods, usePlatformStatus, useUpdatePlatformStatus } from '@/lib/hooks/usePlatformStatus';
import { ActionError } from '@/lib/api/actionResult';
import {
  ALL_LEVEL_CONFIRMATION,
  announcementText,
  disableInput,
  draftFromStatus,
  formatDuration,
  formatParis,
  isConflict,
  LEVEL_INFO,
  MAX_MAINTENANCE_MESSAGE_LENGTH,
  maintenancePhase,
  parseMaintenanceDraft,
  pendingSegmentEntry,
  PHASE_LABELS,
  type MaintenanceDraft,
  type MaintenancePhase,
} from '@/lib/utils/platformStatus';
import type { MaintenanceLevel, PlatformStatus, PlatformStatusInput } from '@/lib/types/platformStatus';

const inputClass =
  'w-full text-sm border border-gray-200 rounded-xl px-3 py-2 focus:outline-none focus:border-[#FF6B35] focus:ring-2 focus:ring-[#FF6B35]/20';

const PHASE_STYLES: Record<MaintenancePhase, string> = {
  disabled: 'bg-gray-50 text-gray-600 border-gray-200',
  scheduled: 'bg-blue-50 text-blue-700 border-blue-100',
  announced: 'bg-amber-50 text-amber-700 border-amber-100',
  active: 'bg-red-50 text-red-700 border-red-100',
  ended: 'bg-gray-50 text-gray-600 border-gray-200',
};

/**
 * Heure courante : rafraîchie toutes les 30 s, à chaque nouvel état (un enregistrement
 * « Maintenant » s'affiche « En cours » tout de suite) et juste après le prochain début ou la
 * prochaine fin programmés.
 */
function useNow(status: PlatformStatus | undefined): Date {
  const [now, setNow] = useState(() => new Date());
  const [seen, setSeen] = useState(status);
  if (seen !== status) {
    setSeen(status);
    setNow(new Date());
  }
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 30 * 1000);
    return () => clearInterval(timer);
  }, []);
  const next = nextBoundary(status, now);
  useEffect(() => {
    if (next === null) return;
    const timer = setTimeout(() => setNow(new Date()), Math.max(0, next - Date.now()) + 50);
    return () => clearTimeout(timer);
  }, [next]);
  return now;
}

/** Prochain début ou fin programmé après [now] (dans les 30 s : sinon la minuterie suffit). */
function nextBoundary(status: PlatformStatus | undefined, now: Date): number | null {
  if (!status?.enabled) return null;
  const times = [status.startsAt, status.endsAt]
    .map((iso) => (iso ? Date.parse(iso) : NaN))
    .filter((t) => !Number.isNaN(t) && t > now.getTime() && t - now.getTime() <= 30 * 1000);
  return times.length ? Math.min(...times) : null;
}

type ModalMode = 'edit' | 'disable';

/**
 * Programmation (saisie puis code 2FA) ou désactivation (code 2FA seul). Le niveau « tout »
 * demande une case de confirmation explicite.
 */
function MaintenanceModal({ status, mode, onClose }: { status: PlatformStatus; mode: ModalMode; onClose: () => void }) {
  const { mutateAsync } = useUpdatePlatformStatus();
  // État lu à l'ouverture de la boîte : sa version part en expectedUpdatedAt, même si l'état
  // est relu entre-temps (relecture chaque minute, ou après un échec). Une modification faite
  // ailleurs pendant la saisie donne donc un conflit (409), jamais un écrasement.
  const [base, setBase] = useState<PlatformStatus>(status);
  const [step, setStep] = useState<'form' | 'confirm'>(mode === 'edit' ? 'form' : 'confirm');
  const [draft, setDraft] = useState<MaintenanceDraft>(() => draftFromStatus(status, new Date()));
  const [preview, setPreview] = useState<PlatformStatusInput | null>(null);
  const [allConfirmed, setAllConfirmed] = useState(false);
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);
  // Après un conflit seulement : la boîte repart des valeurs relues dès qu'elles arrivent.
  const [staleUpdatedAt, setStaleUpdatedAt] = useState<string | null>(null);
  if (staleUpdatedAt !== null && staleUpdatedAt !== status.updatedAt) {
    setStaleUpdatedAt(null);
    setBase(status);
    setDraft(draftFromStatus(status, new Date()));
  }

  const phase = maintenancePhase(base, new Date());
  const set = <K extends keyof MaintenanceDraft>(key: K, value: MaintenanceDraft[K]) =>
    setDraft((d) => ({ ...d, [key]: value }));

  const goToConfirm = () => {
    const parsed = parseMaintenanceDraft(draft, base, new Date());
    if (!parsed.ok) {
      setError(parsed.error);
      return;
    }
    setError('');
    setPreview(parsed.value);
    setAllConfirmed(false);
    setStep('confirm');
  };

  const buildInput = (): PlatformStatusInput => {
    if (mode === 'disable') return disableInput(base);
    // Revalidé à l'envoi : « Maintenant » prend l'heure de l'envoi, une fin a pu passer.
    const parsed = parseMaintenanceDraft(draft, base, new Date());
    if (!parsed.ok) throw new ActionError(parsed.error, 'invalid-argument');
    return parsed.value;
  };

  const needsAllConfirmation = mode === 'edit' && draft.level === 'all';
  const canSubmit = code.length === 6 && !pending && (!needsAllConfirmation || allConfirmed);

  const confirm = async () => {
    if (!canSubmit) return;
    setError('');
    setPending(true);
    try {
      await mutateAsync({ totpCode: code, input: buildInput });
      onClose();
    } catch (e) {
      setCode('');
      const errorCode = e instanceof ActionError ? e.code : undefined;
      setError(e instanceof Error ? e.message : 'La modification a échoué.');
      // Conflit : retour à la saisie (ou fermeture pour la désactivation), valeurs relues.
      // Saisie refusée : retour à la saisie. Code TOTP refusé, journal en échec : on reste
      // sur l'étape du code.
      if (isConflict(errorCode)) {
        // Valeurs relues adoptées dès qu'elles diffèrent de la version envoyée (tout de
        // suite si l'état a déjà été relu pendant la saisie).
        setStaleUpdatedAt(base.updatedAt);
        if (mode === 'edit') {
          setPreview(null);
          setStep('form');
        }
      } else if (errorCode === 'invalid-argument' && mode === 'edit') {
        setStep('form');
      }
    } finally {
      setPending(false);
    }
  };

  const title = mode === 'disable'
    ? (phase === 'active' ? 'Terminer la maintenance maintenant' : 'Annuler la maintenance programmée')
    : 'Mode maintenance';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={pending ? undefined : onClose} />
      <div role="dialog" aria-modal="true" aria-label={title} className="relative bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div>
            <h3 className="text-sm font-semibold text-gray-900">{title}</h3>
            {mode === 'edit' && <p className="text-xs text-gray-400 mt-0.5">Étape {step === 'form' ? '1' : '2'} sur 2</p>}
          </div>
          <button onClick={onClose} disabled={pending} aria-label="Fermer" className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-gray-100 text-gray-500 disabled:opacity-50">
            <X size={15} />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {step === 'form' ? (
            <MaintenanceForm draft={draft} set={set} />
          ) : mode === 'disable' ? (
            <>
              <p className="text-sm text-gray-700">
                {phase === 'active'
                  ? 'Les apps rouvrent dès l’enregistrement (au plus tard à leur prochaine relecture, 5 minutes).'
                  : 'La maintenance programmée est retirée : le bandeau d’annonce disparaît des apps.'}
              </p>
              <TotpCodeField value={code} onChange={setCode} onSubmit={confirm} busy={pending} hint="Requis pour toute modification : code de moins de 5 minutes, même si vous êtes déjà connecté." />
            </>
          ) : (
            preview && (
              <>
                <MaintenanceSummary input={preview} startsNow={draft.startMode === 'now'} />
                {needsAllConfirmation && (
                  <label className="flex gap-2.5 p-3 rounded-xl bg-red-50 border border-red-100 text-xs text-red-700 cursor-pointer">
                    <input type="checkbox" checked={allConfirmed} onChange={(e) => setAllConfirmed(e.target.checked)} className="mt-0.5 accent-red-600" />
                    <span>{ALL_LEVEL_CONFIRMATION}</span>
                  </label>
                )}
                <TotpCodeField value={code} onChange={setCode} onSubmit={confirm} busy={pending} autoFocus={!needsAllConfirmation} hint="Requis pour toute modification : code de moins de 5 minutes, même si vous êtes déjà connecté." />
              </>
            )
          )}

          {error && <p role="alert" className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{error}</p>}

          <div className="flex gap-2 pt-1">
            <button
              onClick={step === 'confirm' && mode === 'edit' ? () => { setError(''); setCode(''); setStep('form'); } : onClose}
              disabled={pending}
              className="flex-1 px-4 py-2 text-sm font-medium text-gray-700 bg-gray-50 hover:bg-gray-100 border border-gray-200 rounded-xl disabled:opacity-50"
            >
              {step === 'confirm' && mode === 'edit' ? 'Retour' : 'Annuler'}
            </button>
            {step === 'form' ? (
              <button onClick={goToConfirm} className="flex-1 px-4 py-2 text-sm font-medium text-white bg-gray-800 hover:bg-gray-900 rounded-xl">Continuer</button>
            ) : (
              <button onClick={confirm} disabled={!canSubmit} className="flex-1 px-4 py-2 text-sm font-medium text-white bg-[#FF6B35] hover:bg-[#e85d2a] rounded-xl disabled:opacity-40">
                {pending ? 'Enregistrement…' : mode === 'disable' ? (phase === 'active' ? 'Terminer maintenant' : 'Annuler la maintenance') : 'Enregistrer'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function MaintenanceForm({
  draft,
  set,
}: {
  draft: MaintenanceDraft;
  set: <K extends keyof MaintenanceDraft>(key: K, value: MaintenanceDraft[K]) => void;
}) {
  return (
    <>
      <fieldset>
        <legend className="block text-xs font-medium text-gray-600 mb-1.5">Niveau</legend>
        <div className="space-y-2">
          {(Object.keys(LEVEL_INFO) as MaintenanceLevel[]).map((level) => (
            <label key={level} className={`flex gap-2.5 p-3 rounded-xl border cursor-pointer ${draft.level === level ? 'border-[#FF6B35] bg-orange-50/50' : 'border-gray-200'}`}>
              <input type="radio" name="maintenance-level" value={level} checked={draft.level === level} onChange={() => set('level', level)} className="mt-0.5 accent-[#FF6B35]" />
              <span>
                <span className="block text-sm font-medium text-gray-900">{LEVEL_INFO[level].label}</span>
                <span className="block text-xs text-gray-500 mt-0.5">{LEVEL_INFO[level].description}</span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset>
        <legend className="block text-xs font-medium text-gray-600 mb-1.5">Début (heure de Paris)</legend>
        <div className="flex gap-4 text-sm text-gray-700 mb-2">
          <label className="flex items-center gap-1.5 cursor-pointer">
            <input type="radio" name="maintenance-start" checked={draft.startMode === 'now'} onChange={() => set('startMode', 'now')} className="accent-[#FF6B35]" />
            Maintenant
          </label>
          <label className="flex items-center gap-1.5 cursor-pointer">
            <input type="radio" name="maintenance-start" checked={draft.startMode === 'scheduled'} onChange={() => set('startMode', 'scheduled')} className="accent-[#FF6B35]" />
            Programmé
          </label>
        </div>
        {draft.startMode === 'scheduled' && (
          <input type="datetime-local" aria-label="Date et heure de début" className={inputClass} value={draft.startsAt} onChange={(e) => set('startsAt', e.target.value)} />
        )}
        <p className="text-xs text-gray-400 mt-1.5">
          Début automatique. Les apps annoncent la maintenance 48 h avant (CGV 9.2) ; une intervention urgente peut commencer sans préavis.
        </p>
      </fieldset>

      <fieldset>
        <legend className="block text-xs font-medium text-gray-600 mb-1.5">Fin (heure de Paris)</legend>
        <div className="flex gap-4 text-sm text-gray-700 mb-2">
          <label className="flex items-center gap-1.5 cursor-pointer">
            <input type="radio" name="maintenance-end" checked={draft.endMode === 'none'} onChange={() => set('endMode', 'none')} className="accent-[#FF6B35]" />
            Aucune
          </label>
          <label className="flex items-center gap-1.5 cursor-pointer">
            <input type="radio" name="maintenance-end" checked={draft.endMode === 'scheduled'} onChange={() => set('endMode', 'scheduled')} className="accent-[#FF6B35]" />
            Retour prévu
          </label>
        </div>
        {draft.endMode === 'scheduled' && (
          <input type="datetime-local" aria-label="Date et heure de fin" className={inputClass} value={draft.endsAt} onChange={(e) => set('endsAt', e.target.value)} />
        )}
        <p className="text-xs text-gray-400 mt-1.5">
          {draft.endMode === 'none'
            ? 'Sans fin, la maintenance dure jusqu’à ce que vous la terminiez ici.'
            : 'Fin automatique : les apps rouvrent seules à l’heure prévue. Vous pouvez toujours terminer plus tôt ou prolonger.'}
        </p>
      </fieldset>

      <div>
        <label htmlFor="maintenance-message" className="block text-xs font-medium text-gray-600 mb-1.5">
          Message affiché (facultatif, {MAX_MAINTENANCE_MESSAGE_LENGTH} caractères au plus)
        </label>
        <textarea
          id="maintenance-message"
          rows={3}
          maxLength={MAX_MAINTENANCE_MESSAGE_LENGTH}
          className={inputClass}
          value={draft.message}
          onChange={(e) => set('message', e.target.value)}
          placeholder="Ex. : Migration de la base de données."
        />
        <p className="text-xs text-gray-400 mt-1">Visible par tous : aucune donnée personnelle.</p>
      </div>
    </>
  );
}

function MaintenanceSummary({ input, startsNow }: { input: PlatformStatusInput; startsNow: boolean }) {
  const now = new Date();
  return (
    <>
      <ul className="space-y-1.5 py-3 px-4 rounded-xl bg-gray-50 border border-gray-100 text-sm">
        <li className="flex justify-between gap-3"><span className="text-gray-500">Niveau</span><span className="font-semibold text-gray-900">{LEVEL_INFO[input.level].label}</span></li>
        <li className="flex justify-between gap-3"><span className="text-gray-500">Début</span><span className="font-semibold text-gray-900">{startsNow ? 'à l’enregistrement' : formatParis(input.startsAt as string)}</span></li>
        <li className="flex justify-between gap-3"><span className="text-gray-500">Fin</span><span className="font-semibold text-gray-900">{input.endsAt ? formatParis(input.endsAt) : 'aucune (jusqu’à la désactivation)'}</span></li>
        <li className="flex justify-between gap-3"><span className="text-gray-500">Message</span><span className="text-gray-900">{input.message ? 'oui' : 'texte par défaut'}</span></li>
      </ul>
      <p role="status" className="flex gap-2.5 p-3 rounded-xl bg-amber-50 border border-amber-100 text-xs text-amber-800">
        <CalendarClock size={15} className="shrink-0 mt-0.5" />
        {announcementText(startsNow ? now.toISOString() : (input.startsAt as string), now)}
      </p>
    </>
  );
}

function MaintenanceHistory({ now }: { now: Date }) {
  const { data, isPending, error } = useMaintenancePeriods();
  // Période de la ligne (en cours, ou terminée par sa fin programmée) : pas encore inscrite,
  // elle l'est à la modification suivante. Déduite de l'état et marquée comme telle.
  const pending = pendingSegmentEntry(data?.pending, now);
  return (
    <div className="px-5 py-4 border-t border-gray-50">
      <h4 className="text-xs font-semibold text-gray-700 mb-2">Historique des maintenances</h4>
      {error ? (
        <p className="text-xs text-gray-400">{error.message}</p>
      ) : isPending || !data ? (
        <div className="h-8 bg-gray-50 rounded-lg animate-pulse" />
      ) : data.periods.length === 0 && !pending ? (
        <p className="text-xs text-gray-400">Aucune maintenance passée.</p>
      ) : (
        <ul className="divide-y divide-gray-50 text-xs">
          {pending && (
            <li data-testid="maintenance-pending-period" className="flex items-center justify-between gap-3 py-1.5">
              <span className="text-gray-700">
                {formatParis(pending.startedAt)} → {pending.endedAt ? formatParis(pending.endedAt) : 'en cours'}
                <span className="block text-gray-400">
                  {pending.endedAt
                    ? 'Terminée par sa fin programmée : inscrite à la prochaine modification.'
                    : 'Période en cours, déduite de l’état actuel.'}
                </span>
              </span>
              <span className="flex items-center gap-2 text-gray-500 flex-shrink-0">
                <span>{formatDuration(Date.parse(pending.endedAt ?? now.toISOString()) - Date.parse(pending.startedAt))}</span>
                <span className="px-1.5 py-0.5 rounded border border-gray-200">{LEVEL_INFO[pending.level]?.label ?? pending.level}</span>
              </span>
            </li>
          )}
          {data.periods.map((p) => (
            <li key={p.id} className="flex items-center justify-between gap-3 py-1.5">
              <span className="text-gray-700">{formatParis(p.startedAt)} → {formatParis(p.endedAt)}</span>
              <span className="flex items-center gap-2 text-gray-500 flex-shrink-0">
                <span>{formatDuration(Date.parse(p.endedAt) - Date.parse(p.startedAt))}</span>
                <span className="px-1.5 py-0.5 rounded border border-gray-200">{LEVEL_INFO[p.level]?.label ?? p.level}</span>
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** Réglage « Mode maintenance » : état, programmation, désactivation, historique. */
export function MaintenanceCard() {
  const { data: status, isPending, error } = usePlatformStatus();
  const now = useNow(status);
  const [modal, setModal] = useState<ModalMode | null>(null);
  const phase = status ? maintenancePhase(status, now) : null;
  const current = phase === 'scheduled' || phase === 'announced' || phase === 'active';

  return (
    <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
      <div className="px-5 py-4 border-b border-gray-50">
        <h3 className="text-sm font-semibold text-gray-900">Mode maintenance</h3>
        <p className="text-xs text-gray-400 mt-0.5">
          Interruption programmée ou urgente de TheResto : écran de maintenance dans les apps et écritures refusées par le serveur.
          Les admins restent exemptés. Toute modification exige une vérification en deux étapes.
        </p>
      </div>

      {error ? (
        <div className="m-5 p-3 bg-red-50 border border-red-100 text-red-600 rounded-lg text-sm flex items-center gap-2">
          <AlertTriangle size={15} className="shrink-0" />
          {error.message}
        </div>
      ) : isPending || !status || !phase ? (
        <div className="p-5 animate-pulse"><div className="h-14 bg-gray-100 rounded-xl" /></div>
      ) : (
        <div className="px-5 py-4 space-y-3">
          <div className="flex items-start gap-4">
            <div className={`w-8 h-8 rounded-lg border flex items-center justify-center flex-shrink-0 ${phase === 'active' ? 'bg-red-50 border-red-100' : 'bg-gray-50 border-gray-100'}`}>
              <Wrench size={15} className={phase === 'active' ? 'text-red-500' : 'text-gray-500'} />
            </div>
            <div className="flex-1 min-w-0 space-y-2">
              <span data-testid="maintenance-phase" className={`inline-block text-xs font-semibold px-2 py-0.5 rounded-md border ${PHASE_STYLES[phase]}`}>
                {PHASE_LABELS[phase]}
              </span>
              {current || phase === 'ended' ? (
                <dl className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                  <div><dt className="text-xs text-gray-400">Niveau</dt><dd className="font-semibold text-gray-900">{LEVEL_INFO[status.level].label}</dd></div>
                  <div><dt className="text-xs text-gray-400">Début</dt><dd className="text-gray-700">{status.startsAt ? formatParis(status.startsAt) : '—'}</dd></div>
                  <div><dt className="text-xs text-gray-400">Fin</dt><dd className="text-gray-700">{status.endsAt ? formatParis(status.endsAt) : 'à la désactivation'}</dd></div>
                  <div><dt className="text-xs text-gray-400">Message</dt><dd className="text-gray-700 truncate" title={status.message ?? undefined}>{status.message ?? 'texte par défaut'}</dd></div>
                </dl>
              ) : (
                <p className="text-sm text-gray-500">Aucune maintenance programmée.</p>
              )}
              {(phase === 'scheduled' || phase === 'announced') && status.startsAt && (
                <p className="text-xs text-gray-500">{announcementText(status.startsAt, now)}</p>
              )}
              {phase === 'active' && (
                <p className="text-xs text-red-600">{LEVEL_INFO[status.level].description}</p>
              )}
              <p className="text-xs text-gray-400">Modifié le {formatParis(status.updatedAt)}</p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2 justify-end">
            {current && (
              <button
                onClick={() => setModal('disable')}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-red-600 border border-red-200 rounded-lg hover:bg-red-50"
              >
                <Power size={12} />
                {phase === 'active' ? 'Terminer maintenant' : 'Annuler la maintenance'}
              </button>
            )}
            <button
              onClick={() => setModal('edit')}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-600 border border-gray-200 rounded-lg hover:text-[#FF6B35] hover:border-[#FF6B35]/30 hover:bg-orange-50"
            >
              <Wrench size={12} />
              {current ? 'Modifier' : 'Programmer une maintenance'}
            </button>
          </div>
        </div>
      )}

      <MaintenanceHistory now={now} />

      {status && modal && <MaintenanceModal key={modal} status={status} mode={modal} onClose={() => setModal(null)} />}
    </div>
  );
}
