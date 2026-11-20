'use client';

import { useState } from 'react';
import NextLink from 'next/link';
import { AlertTriangle, Timer } from 'lucide-react';
import { OntimeActionModal } from '@/components/ontime/OntimeActionModal';
import { OntimeReportDialog, OntimeStatusPill } from '@/components/ontime/OntimeReportDialog';
import { OntimeWriteError, useLiftOntimeSanction, useOntimeOverview, useWithdrawOntime } from '@/lib/hooks/useOntime';
import { actionErrorMessage } from '@/lib/api/actionResult';
import { formatInstant, formatRate } from '@/lib/utils/restaurantAlerts';
import { delayCategoryLabel, isSanctionActive, sanctionKindLabel } from '@/lib/utils/ontime';
import type { OntimeReport, OntimeSanction, OntimeState } from '@/lib/types/ontime';

const REPORTS_SHOWN = 10;

function stateLabel(state: OntimeState): { text: string; tone: string } {
  if (state.withdrawn_at) return { text: `Retirée par TheResto depuis le ${formatInstant(state.withdrawn_at, false)}`, tone: 'text-red-700' };
  if (state.suspended_until) return { text: `Suspendue jusqu'au ${formatInstant(state.suspended_until)}`, tone: 'text-amber-800' };
  if (!state.configured) return { text: 'Non proposée par le restaurant', tone: 'text-gray-500' };
  return { text: state.available ? 'Disponible' : 'Indisponible', tone: state.available ? 'text-green-700' : 'text-gray-500' };
}

function sanctionLine(s: OntimeSanction): string {
  const parts = [sanctionKindLabel(s.kind), `le ${formatInstant(s.starts_at, false)}`];
  if (s.kind === 'suspension' && s.ends_at) parts.push(`jusqu'au ${formatInstant(s.ends_at)}`);
  if (s.failures_count !== null && s.served_count !== null) parts.push(`${s.failures_count} manquement(s) sur ${s.served_count} servie(s)`);
  if (s.recidive) parts.push('récidive');
  if (s.kind === 'warning') parts.push(s.acknowledged_at ? 'engagement confirmé' : 'engagement non confirmé');
  if (s.lifted_at) parts.push(`levée le ${formatInstant(s.lifted_at, false)}`);
  return parts.join(' · ');
}

type Pending = { kind: 'withdraw' } | { kind: 'lift'; sanction: OntimeSanction };

/** Section OnTime de la fiche d'un restaurant : état, compteur, sanctions, signalements, actions. */
export function OntimeSection({ restaurantId }: { restaurantId: string }) {
  const { data, isPending, error } = useOntimeOverview(restaurantId);
  const withdraw = useWithdrawOntime();
  const lift = useLiftOntimeSanction();
  const [pending, setPending] = useState<Pending | null>(null);
  const [selected, setSelected] = useState<OntimeReport | null>(null);

  const activeWithdrawal = data?.sanctions.find((s) => s.kind === 'withdrawal' && isSanctionActive(s));
  const state = data ? stateLabel(data.state) : null;

  return (
    <section aria-labelledby="ontime-title" className="bg-white rounded-xl border border-gray-100 overflow-hidden">
      <div className="px-5 py-3.5 border-b border-gray-50 bg-gray-50/50 flex items-center justify-between gap-3">
        <h3 id="ontime-title" className="text-xs font-semibold text-gray-500 uppercase tracking-wide flex items-center gap-1.5">
          <Timer size={13} />
          OnTime (précommande à heure précise)
        </h3>
        {data && !activeWithdrawal && (
          <button
            onClick={() => setPending({ kind: 'withdraw' })}
            className="px-3 py-1.5 text-xs font-medium text-red-700 border border-red-200 bg-white rounded-lg hover:bg-red-50"
          >
            Retirer l&apos;OnTime
          </button>
        )}
      </div>

      {error ? (
        <div className="m-5 p-3 bg-red-50 border border-red-100 text-red-600 rounded-lg text-sm flex items-center gap-2">
          <AlertTriangle size={15} className="shrink-0" />
          {actionErrorMessage(error, 'Impossible de charger le suivi OnTime.')}
        </div>
      ) : isPending || !data || !state ? (
        <div className="p-5 space-y-2 animate-pulse">
          {[1, 2].map((i) => <div key={i} className="h-10 bg-gray-100 rounded-lg" />)}
        </div>
      ) : (
        <div className="p-5 space-y-5">
          <dl className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="bg-gray-50 rounded-xl p-3 border border-gray-100">
              <dt className="text-xs text-gray-500">État</dt>
              <dd className={`text-sm font-semibold mt-0.5 ${state.tone}`} data-testid="ontime-state">{state.text}</dd>
            </div>
            <div className="bg-gray-50 rounded-xl p-3 border border-gray-100">
              <dt className="text-xs text-gray-500">Manquements sur 30 jours</dt>
              <dd className="text-sm font-semibold text-gray-900 mt-0.5">
                {data.window.failures} sur {data.window.served} servie(s) ({formatRate(data.window.rate)})
              </dd>
              {data.window.counter_reset_at && (
                <dd className="text-xs text-gray-400 mt-0.5">Compté depuis le {formatInstant(data.window.from)}</dd>
              )}
            </div>
            <div className="bg-gray-50 rounded-xl p-3 border border-gray-100">
              <dt className="text-xs text-gray-500">Sanctions automatiques</dt>
              <dd className={`text-sm font-semibold mt-0.5 ${data.state.sanctions_enabled ? 'text-green-700' : 'text-gray-500'}`}>
                {data.state.sanctions_enabled ? 'Allumées' : 'Éteintes (CGV 1.2 pas encore en vigueur)'}
              </dd>
            </div>
          </dl>

          <div>
            <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Sanctions</h4>
            {data.sanctions.length === 0 ? (
              <p className="text-sm text-gray-500">Aucune sanction.</p>
            ) : (
              <ul className="divide-y divide-gray-50 border border-gray-100 rounded-xl">
                {data.sanctions.map((s) => {
                  const active = isSanctionActive(s);
                  const liftable = active && (s.kind === 'suspension' || s.kind === 'withdrawal');
                  return (
                    <li key={s.id} className="px-3 py-2.5 flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className={`text-sm ${active ? 'font-semibold text-gray-900' : 'text-gray-600'}`}>{sanctionLine(s)}</p>
                        {s.reason && <p className="text-xs text-gray-500 mt-0.5 whitespace-pre-wrap">Motif du retrait : {s.reason}</p>}
                        {s.lift_reason && <p className="text-xs text-gray-500 mt-0.5 whitespace-pre-wrap">Motif de la levée : {s.lift_reason}</p>}
                      </div>
                      {liftable && (
                        <button
                          onClick={() => setPending({ kind: 'lift', sanction: s })}
                          className="px-3 py-1.5 text-xs font-medium text-gray-700 border border-gray-200 rounded-lg hover:bg-gray-50 flex-shrink-0"
                        >
                          {s.kind === 'withdrawal' ? 'Rétablir' : 'Lever la suspension'}
                        </button>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          <div>
            <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
              Signalements ({data.reports.length})
            </h4>
            {data.reports.length === 0 ? (
              <p className="text-sm text-gray-500">Aucun signalement.</p>
            ) : (
              <ul className="divide-y divide-gray-50 border border-gray-100 rounded-xl">
                {data.reports.slice(0, REPORTS_SHOWN).map((r) => (
                  <li key={r.id}>
                    <button
                      onClick={() => setSelected(r)}
                      className="w-full text-left px-3 py-2.5 flex flex-wrap items-center justify-between gap-2 hover:bg-gray-50"
                    >
                      <span className="text-sm text-gray-800">
                        {formatInstant(r.slot_at)} · {delayCategoryLabel(r.delay_category)}
                      </span>
                      <OntimeStatusPill status={r.status} />
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {data.reports.length > 0 && (
              <p className="text-xs text-gray-400 mt-2">
                {data.reports.length > REPORTS_SHOWN && `${REPORTS_SHOWN} signalements affichés sur ${data.reports.length} (les plus récents). `}
                <NextLink href={`/ontime?restaurant=${restaurantId}`} className="text-[#FF6B35] hover:underline">
                  Tous ses signalements dans la page OnTime
                </NextLink>
              </p>
            )}
          </div>
        </div>
      )}

      {selected && (
        <OntimeReportDialog
          report={selected}
          showRestaurantLink={false}
          onClose={() => setSelected(null)}
        />
      )}

      {pending?.kind === 'withdraw' && (
        <OntimeActionModal
          title="Retirer l’OnTime"
          subtitle="Décision de TheResto, sans fin : jusqu’à un rétablissement"
          reasonLabel="Motif du retrait (montré au restaurant)"
          reasonPlaceholder="Ex. Récidive : troisième suspension en six mois malgré les mesures annoncées."
          warning="Le restaurant ne pourra plus proposer la précommande OnTime ; les OnTime déjà prises restent dues. Permis même interrupteur des sanctions éteint : décision humaine motivée et journalisée."
          confirmation="Je confirme le retrait de l’OnTime pour ce restaurant."
          confirmLabel="Retirer"
          danger
          onConfirm={async (reason, totpCode) => {
            await withdraw.mutateAsync({ restaurantId, reason, totpCode });
          }}
          onClose={() => setPending(null)}
        />
      )}

      {pending?.kind === 'lift' && (
        <OntimeActionModal
          title={pending.sanction.kind === 'withdrawal' ? 'Rétablir l’OnTime' : 'Lever la suspension'}
          reasonLabel="Motif (montré au restaurant)"
          reasonPlaceholder="Ex. Mesures correctives justifiées : renfort en cuisine le soir."
          confirmLabel={pending.sanction.kind === 'withdrawal' ? 'Rétablir' : 'Lever'}
          onConfirm={async (reason, totpCode) => {
            await lift.mutateAsync({
              sanctionId: pending.sanction.id,
              reason,
              expectedUpdatedAt: pending.sanction.updated_at,
              totpCode,
            }).catch((error: unknown) => {
              // Sanction à jour (conflit, déjà levée) : un nouvel essai part avec sa version.
              if (error instanceof OntimeWriteError && error.sanction) setPending({ kind: 'lift', sanction: error.sanction });
              throw error;
            });
          }}
          onClose={() => setPending(null)}
        />
      )}
    </section>
  );
}
