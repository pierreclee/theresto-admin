'use client';

import { useState } from 'react';
import NextLink from 'next/link';
import { X } from 'lucide-react';
import { OntimeActionModal } from '@/components/ontime/OntimeActionModal';
import { OntimeWriteError, useDecideOntimeReport, useLiftOntimeSanction, useVoidOntimeReport } from '@/lib/hooks/useOntime';
import { formatInstant } from '@/lib/utils/restaurantAlerts';
import {
  bookingFactsSummary,
  contestSourceLabel,
  delayCategoryLabel,
  formatRemaining,
  isSanctionActive,
  ontimeStatusClasses,
  ontimeStatusLabel,
  sanctionKindLabel,
} from '@/lib/utils/ontime';
import type { OntimeReport, OntimeSanction } from '@/lib/types/ontime';

export function OntimeStatusPill({ status }: { status: string }) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${ontimeStatusClasses(status)}`}>
      {ontimeStatusLabel(status)}
    </span>
  );
}

function Fact({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs text-gray-400">{label}</dt>
      <dd className="text-sm text-gray-800 mt-0.5 break-words">{children}</dd>
    </div>
  );
}

function Quote({ text, empty }: { text: string | null; empty: string }) {
  return text ? (
    <blockquote className="text-sm text-gray-800 whitespace-pre-wrap bg-gray-50 border border-gray-100 rounded-lg px-3 py-2">
      {text}
    </blockquote>
  ) : (
    <p className="text-sm text-gray-400">{empty}</p>
  );
}

/** Fiche d'un signalement : faits de la réservation, signalement, contestation, décision. */
export function OntimeReportDetails({ report }: { report: OntimeReport }) {
  return (
    <div className="space-y-4">
      <dl className="grid grid-cols-2 gap-3">
        <Fact label="Heure convenue">{formatInstant(report.slot_at)}</Fact>
        <Fact label="Couverts">{report.number_of_guests ?? '—'}</Fact>
        <Fact label="Retard déclaré">{delayCategoryLabel(report.delay_category)}</Fact>
        <Fact label="Signalé le">{formatInstant(report.reported_at)}</Fact>
        <Fact label="Réservation (faits enregistrés)">{bookingFactsSummary(report)}</Fact>
        <Fact label="Statut">
          <OntimeStatusPill status={report.status} />
        </Fact>
      </dl>

      <section>
        <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Commentaire du client</h4>
        <Quote
          text={report.comment}
          empty={report.reporter_erased ? 'Compte du client effacé : commentaire supprimé.' : 'Aucun commentaire.'}
        />
      </section>

      <section>
        <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Contestation du restaurant</h4>
        {report.status === 'open' ? (
          <p className="text-sm text-gray-500">
            {report.contest_paused
              ? 'Délai de contestation gelé : restaurant suspendu par TheResto.'
              : `Délai de contestation : ${formatRemaining(report.contest_remaining_seconds)} (échéance ${formatInstant(report.contest_deadline)}).`}
          </p>
        ) : report.contested_at ? (
          <>
            <p className="text-xs text-gray-500 mb-1.5">
              {contestSourceLabel(report.contest_source)}, le {formatInstant(report.contested_at)}
            </p>
            <Quote text={report.contest_text} empty="Aucun texte." />
          </>
        ) : (
          <p className="text-sm text-gray-400">Pas de contestation.</p>
        )}
      </section>

      {(report.decided_at || report.voided_at || report.withdrawn_at) && (
        <section>
          <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Issue</h4>
          {report.withdrawn_at && <p className="text-sm text-gray-700">Retiré par le client le {formatInstant(report.withdrawn_at)}.</p>}
          {report.decided_at && (
            <>
              <p className="text-xs text-gray-500 mb-1.5">
                {report.decision_source === 'deadline'
                  ? `Manquement retenu à l'échéance, sans contestation (${formatInstant(report.decided_at)})`
                  : `Décision de TheResto le ${formatInstant(report.decided_at)}`}
              </p>
              {report.decision_reason && <Quote text={report.decision_reason} empty="" />}
            </>
          )}
          {report.voided_at && (
            <>
              <p className="text-xs text-gray-500 mt-2 mb-1.5">Manquement annulé le {formatInstant(report.voided_at)}</p>
              <Quote text={report.void_reason} empty="Sans motif." />
            </>
          )}
        </section>
      )}
    </div>
  );
}

type Pending =
  | { kind: 'decide'; decision: 'upheld' | 'dismissed' }
  | { kind: 'void' }
  | { kind: 'lift'; sanction: OntimeSanction };

/**
 * Fiche d'un signalement avec ses actions : Retenir / Écarter une contestation, Annuler un
 * manquement retenu. Après une annulation, si le manquement avait déclenché une sanction encore
 * en vigueur, propose de la lever aussi (Q4 : l'annulation ne lève rien d'elle-même).
 */
export function OntimeReportDialog({
  report,
  showRestaurantLink = true,
  onClose,
}: {
  report: OntimeReport;
  showRestaurantLink?: boolean;
  onClose: () => void;
}) {
  const decide = useDecideOntimeReport();
  const voidReport = useVoidOntimeReport();
  const lift = useLiftOntimeSanction();
  const [pending, setPending] = useState<Pending | null>(null);
  const [current, setCurrent] = useState(report);
  const [toLift, setToLift] = useState<OntimeSanction | null>(null);

  /** Refus avec la ligne à jour (conflit, état changé) : la fiche la reprend, puis l'erreur s'affiche. */
  const refreshFrom = (error: unknown): never => {
    if (error instanceof OntimeWriteError) {
      if (error.report) setCurrent({ ...error.report, restaurant_name: current.restaurant_name });
      if (error.sanction) {
        setToLift(error.sanction);
        setPending((p) => (p?.kind === 'lift' ? { kind: 'lift', sanction: error.sanction! } : p));
      }
    }
    throw error;
  };

  return (
    <>
      <div className="fixed inset-0 z-40 flex items-center justify-center p-4">
        <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Signalement OnTime"
          className="relative bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto"
        >
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
            <div className="min-w-0">
              <h3 className="text-sm font-semibold text-gray-900">Signalement OnTime</h3>
              {showRestaurantLink && (
                <NextLink href={`/restaurants/${current.restaurant_id}`} className="text-xs text-[#FF6B35] hover:underline">
                  {current.restaurant_name || 'Voir le restaurant'}
                </NextLink>
              )}
            </div>
            <button
              onClick={onClose}
              className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-gray-100 text-gray-500 transition-colors"
              aria-label="Fermer"
            >
              <X size={15} />
            </button>
          </div>

          <div className="p-5 space-y-5">
            <OntimeReportDetails report={current} />

            {toLift && isSanctionActive(toLift) && (
              <div className="p-3 rounded-xl border border-amber-200 bg-amber-50 text-sm text-amber-900 flex items-center justify-between gap-3">
                <p>
                  Ce manquement avait déclenché : {sanctionKindLabel(toLift.kind)}
                  {toLift.ends_at ? ` jusqu'au ${formatInstant(toLift.ends_at)}` : ''}. Elle n&apos;est pas levée par l&apos;annulation.
                </p>
                <button
                  onClick={() => setPending({ kind: 'lift', sanction: toLift })}
                  className="px-3 py-1.5 text-xs font-medium text-white bg-gray-800 hover:bg-gray-900 rounded-lg flex-shrink-0"
                >
                  Lever aussi
                </button>
              </div>
            )}

            <div className="flex flex-wrap gap-2 justify-end">
              {current.status === 'contested' && (
                <>
                  <button
                    onClick={() => setPending({ kind: 'decide', decision: 'dismissed' })}
                    className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-50 hover:bg-gray-100 border border-gray-200 rounded-xl"
                  >
                    Écarter
                  </button>
                  <button
                    onClick={() => setPending({ kind: 'decide', decision: 'upheld' })}
                    className="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-xl"
                  >
                    Retenir le manquement
                  </button>
                </>
              )}
              {current.status === 'upheld' && (
                <button
                  onClick={() => setPending({ kind: 'void' })}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-50 hover:bg-gray-100 border border-gray-200 rounded-xl"
                >
                  Annuler ce manquement
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {pending?.kind === 'decide' && (
        <OntimeActionModal
          title={pending.decision === 'upheld' ? 'Retenir le manquement' : 'Écarter le signalement'}
          subtitle={delayCategoryLabel(current.delay_category)}
          reasonLabel="Motif de la décision"
          reasonPlaceholder={
            pending.decision === 'upheld'
              ? 'Ex. Aucune trace du service avant 20 h 45 ; la contestation ne s’appuie sur aucun élément vérifiable.'
              : 'Ex. Le ticket de caisse transmis montre un service à 20 h 05, dans le créneau.'
          }
          warning={
            pending.decision === 'upheld'
              ? 'Le manquement compte dans les 30 jours glissants du restaurant : un avertissement ou une suspension de 14 jours peut s’ensuivre si les sanctions automatiques sont allumées.'
              : 'Le signalement ne comptera pas. Le client verra « Écarté », sans le motif.'
          }
          confirmLabel={pending.decision === 'upheld' ? 'Retenir' : 'Écarter'}
          danger={pending.decision === 'upheld'}
          onConfirm={async (reason, totpCode) => {
            const data = await decide.mutateAsync({
              reportId: current.id,
              decision: pending.decision,
              reason,
              expectedUpdatedAt: current.updated_at,
              totpCode,
            }).catch(refreshFrom);
            setCurrent({ ...data.report, restaurant_name: current.restaurant_name });
          }}
          onClose={() => setPending(null)}
        />
      )}

      {pending?.kind === 'void' && (
        <OntimeActionModal
          title="Annuler ce manquement"
          reasonLabel="Motif de l'annulation"
          reasonPlaceholder="Ex. Signalement frauduleux établi après vérification."
          warning="Le manquement ne comptera plus. Une sanction qu’il a déclenchée n’est pas levée : elle se lève à part."
          confirmLabel="Annuler le manquement"
          onConfirm={async (reason, totpCode) => {
            const data = await voidReport.mutateAsync({
              reportId: current.id,
              reason,
              expectedUpdatedAt: current.updated_at,
              totpCode,
            }).catch(refreshFrom);
            setCurrent({ ...data.report, restaurant_name: current.restaurant_name });
            setToLift(data.triggeredSanction);
          }}
          onClose={() => setPending(null)}
        />
      )}

      {pending?.kind === 'lift' && (
        <OntimeActionModal
          title={pending.sanction.kind === 'withdrawal' ? 'Rétablir l’OnTime' : 'Lever la suspension'}
          reasonLabel="Motif de la levée"
          reasonPlaceholder="Ex. Manquement à l’origine de la suspension annulé après vérification."
          confirmLabel="Lever"
          onConfirm={async (reason, totpCode) => {
            await lift.mutateAsync({
              sanctionId: pending.sanction.id,
              reason,
              expectedUpdatedAt: pending.sanction.updated_at,
              totpCode,
            }).catch(refreshFrom);
            setToLift(null);
          }}
          onClose={() => setPending(null)}
        />
      )}
    </>
  );
}
