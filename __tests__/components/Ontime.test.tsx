import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { OntimeReport, OntimeSanction } from '@/lib/types/ontime';

// OnTime (chantier C, lot C5) : « Lever aussi » proposé seulement si l'annulation renvoie une
// sanction en vigueur ; case des CGV 1.2 obligatoire pour allumer, version figée à l'ouverture ;
// conflit : fiche reprise à jour, nouvel essai avec la bonne version ; liste ramenée à la
// dernière page qui existe après une décision ; lien filtré par restaurant.

const decide = jest.fn();
const voidReport = jest.fn();
const lift = jest.fn();
const setSwitch = jest.fn();
const reportsHook = jest.fn();
const switchHook = jest.fn();
let searchParams = new URLSearchParams();

jest.mock('next/navigation', () => ({
  useSearchParams: () => searchParams,
  usePathname: () => '/ontime',
  useRouter: () => ({ push: jest.fn() }),
}));
jest.mock('next/link', () => ({
  __esModule: true,
  default: ({ children, href }: { children: React.ReactNode; href: string }) => <a href={href}>{children}</a>,
}));
jest.mock('@/lib/hooks/useAuth', () => ({ useAuth: () => ({ isAdmin: true, sessionValid: true }) }));
jest.mock('@/lib/hooks/useOntime', () => {
  class OntimeWriteError extends Error {
    constructor(message: string, readonly code?: string, readonly report?: unknown, readonly sanction?: unknown) {
      super(message);
    }
  }
  return {
    OntimeWriteError,
    useDecideOntimeReport: () => ({ mutateAsync: decide }),
    useVoidOntimeReport: () => ({ mutateAsync: voidReport }),
    useLiftOntimeSanction: () => ({ mutateAsync: lift }),
    useWithdrawOntime: () => ({ mutateAsync: jest.fn() }),
    useSetOntimeSanctions: () => ({ mutateAsync: setSwitch }),
    useOntimeSanctionsSwitch: () => switchHook(),
    useOntimeReports: (status: string, offset: number, restaurantId: string | null) => reportsHook(status, offset, restaurantId),
    useOntimePendingCount: () => 0,
  };
});

import { OntimeWriteError } from '@/lib/hooks/useOntime';
import { OntimeReportDialog } from '@/components/ontime/OntimeReportDialog';
import { OntimeSanctionsCard } from '@/components/config/OntimeSanctionsCard';
import OntimePage from '@/app/ontime/page';

const RID = '11111111-2222-4333-8444-555555555555';
const T0 = '2026-12-01T10:00:00.123+00:00';
const T1 = '2026-12-01T11:00:00.456+00:00';

const report = (over: Partial<OntimeReport> = {}): OntimeReport => ({
  id: 'r1', restaurant_id: RID, restaurant_name: 'Chez Paul', booking_id: null, slot_at: T0, number_of_guests: 2,
  delay_category: '20_40', comment: null, status: 'upheld', reported_at: T0, contest_deadline: null, contest_paused: false,
  contest_remaining_seconds: null, contestable: false, contested_at: T0, contest_text: 'Faux', contest_source: 'team',
  decided_at: T0, decision_source: 'admin', decision_reason: 'Motif suffisamment long.', voided_at: null, void_reason: null,
  withdrawn_at: null, updated_at: T0, reporter_erased: false, booking_facts: null, ...over,
});

const sanction = (over: Partial<OntimeSanction> = {}): OntimeSanction => ({
  id: 's1', restaurant_id: RID, kind: 'suspension', created_at: T0, starts_at: '2026-01-01T00:00:00Z',
  ends_at: '2999-01-01T00:00:00Z', lifted_at: null, failures_count: 3, served_count: 20, failure_rate: 0.15,
  window_start: null, window_end: null, recidive: false, acknowledged_at: null, updated_at: T0,
  trigger_report_id: 'r1', reason: null, lift_reason: null, created_by_admin: false, ...over,
});

const totp = () => screen.getByPlaceholderText('000000');
const reasonField = () => screen.getByRole('textbox', { name: /Motif/ });

async function confirmAction(label: string, reason = 'Fraude établie après vérification.') {
  if (screen.queryByRole('textbox', { name: /Motif/ })) fireEvent.change(reasonField(), { target: { value: reason } });
  fireEvent.change(totp(), { target: { value: '123456' } });
  await act(async () => {
    fireEvent.click(screen.getAllByRole('button', { name: label }).at(-1)!);
  });
}

beforeEach(() => {
  for (const f of [decide, voidReport, lift, setSwitch, reportsHook, switchHook]) f.mockReset();
  searchParams = new URLSearchParams();
});

describe('OntimeReportDialog', () => {
  it('annulation sans sanction en vigueur : pas de « Lever aussi »', async () => {
    voidReport.mockResolvedValue({ report: report({ status: 'voided', voided_at: T1 }), triggeredSanction: null });
    render(<OntimeReportDialog report={report()} onClose={jest.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Annuler ce manquement' }));
    await confirmAction('Annuler le manquement');
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Annuler ce manquement' })).toBeNull());
    expect(screen.queryByRole('button', { name: 'Lever aussi' })).toBeNull();
  });

  it('annulation d’un manquement qui a déclenché une sanction finie : pas de « Lever aussi »', async () => {
    voidReport.mockResolvedValue({ report: report({ status: 'voided' }), triggeredSanction: sanction({ lifted_at: T1 }) });
    render(<OntimeReportDialog report={report()} onClose={jest.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Annuler ce manquement' }));
    await confirmAction('Annuler le manquement');
    await waitFor(() => expect(voidReport).toHaveBeenCalled());
    expect(screen.queryByRole('button', { name: 'Lever aussi' })).toBeNull();
  });

  it('sanction en vigueur : « Lever aussi » lève avec sa version', async () => {
    voidReport.mockResolvedValue({ report: report({ status: 'voided' }), triggeredSanction: sanction() });
    lift.mockResolvedValue({ sanction: sanction({ lifted_at: T1 }) });
    render(<OntimeReportDialog report={report()} onClose={jest.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Annuler ce manquement' }));
    await confirmAction('Annuler le manquement');
    fireEvent.click(await screen.findByRole('button', { name: 'Lever aussi' }));
    await confirmAction('Lever', 'Manquement annulé après vérification.');
    expect(lift).toHaveBeenCalledWith(expect.objectContaining({ sanctionId: 's1', expectedUpdatedAt: T0 }));
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Lever aussi' })).toBeNull());
  });

  it('conflit : fiche reprise à jour, nouvel essai avec la nouvelle version', async () => {
    decide
      .mockRejectedValueOnce(new OntimeWriteError('Modifié entre-temps.', 'conflict', report({ status: 'contested', decided_at: null, updated_at: T1 })))
      .mockResolvedValueOnce({ report: report({ status: 'dismissed', updated_at: T1 }), sanction: null });
    render(<OntimeReportDialog report={report({ status: 'contested', decided_at: null })} onClose={jest.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Écarter' }));
    await confirmAction('Écarter', 'Ticket de caisse : servi à l’heure.');
    expect(await screen.findByRole('alert')).toHaveTextContent('Modifié entre-temps.');
    expect(decide).toHaveBeenLastCalledWith(expect.objectContaining({ expectedUpdatedAt: T0 }));
    fireEvent.change(totp(), { target: { value: '654321' } });
    await act(async () => {
      fireEvent.click(screen.getAllByRole('button', { name: 'Écarter' }).at(-1)!);
    });
    expect(decide).toHaveBeenLastCalledWith(expect.objectContaining({ expectedUpdatedAt: T1, totpCode: '654321' }));
  });
});

describe('OntimeSanctionsCard', () => {
  it('allumer : case des CGV 1.2 obligatoire, version figée à l’ouverture', async () => {
    const state = { data: { enabled: false, updatedAt: T0, enabledAt: null }, isPending: false, error: null };
    switchHook.mockImplementation(() => state);
    setSwitch.mockResolvedValue({ enabled: true, previous: false, updatedAt: T1, enabledAt: T1 });
    const { rerender } = render(<OntimeSanctionsCard />);
    fireEvent.click(screen.getByRole('button', { name: 'Allumer' }));
    fireEvent.change(totp(), { target: { value: '123456' } });
    const confirm = screen.getAllByRole('button', { name: 'Allumer' }).at(-1)!;
    expect(confirm).toBeDisabled();
    // Rechargement de l'état pendant que la modale est ouverte : la version envoyée ne change pas.
    state.data = { enabled: false, updatedAt: T1, enabledAt: null };
    rerender(<OntimeSanctionsCard />);
    fireEvent.click(screen.getByRole('checkbox'));
    expect(confirm).toBeEnabled();
    await act(async () => {
      fireEvent.click(confirm);
    });
    expect(setSwitch).toHaveBeenCalledWith({ enabled: true, expectedUpdatedAt: T0, confirmCgv: true, totpCode: '123456' });
  });

  it('éteindre : pas de case', () => {
    switchHook.mockReturnValue({ data: { enabled: true, updatedAt: T0, enabledAt: T0 }, isPending: false, error: null });
    render(<OntimeSanctionsCard />);
    fireEvent.click(screen.getByRole('button', { name: 'Éteindre' }));
    expect(screen.queryByRole('checkbox')).toBeNull();
  });
});

describe('page OnTime', () => {
  const page = (reports: OntimeReport[], total: number) => ({
    data: { reports, total }, isPending: false, error: null, isFetching: false, isPlaceholderData: false,
  });

  it('décision sur le dernier signalement de la dernière page : retour à la page précédente', async () => {
    const many = Array.from({ length: 50 }, (_, i) => report({ id: `r${i}`, status: 'contested' }));
    let total = 51;
    reportsHook.mockImplementation((_status: string, offset: number) =>
      offset === 0 ? page(many, total) : page(total > 50 ? [report({ id: 'last', status: 'contested' })] : [], total));
    const { rerender } = render(<OntimePage />);
    fireEvent.click(screen.getByRole('button', { name: 'Suivant' }));
    expect(reportsHook).toHaveBeenLastCalledWith('contested', 50, null);
    total = 50; // le dernier signalement vient d'être tranché
    rerender(<OntimePage />);
    await waitFor(() => expect(reportsHook).toHaveBeenLastCalledWith('contested', 0, null));
  });

  it('pagination désactivée pendant l’affichage de la page précédente', () => {
    const many = Array.from({ length: 50 }, (_, i) => report({ id: `r${i}` }));
    reportsHook.mockReturnValue({ ...page(many, 120), isPlaceholderData: true });
    render(<OntimePage />);
    expect(screen.getByRole('button', { name: 'Suivant' })).toBeDisabled();
  });

  it('?restaurant= : liste filtrée sur ce restaurant, tous statuts', () => {
    searchParams = new URLSearchParams({ restaurant: RID });
    reportsHook.mockReturnValue(page([report()], 1));
    render(<OntimePage />);
    expect(reportsHook).toHaveBeenLastCalledWith('all', 0, RID);
    expect(screen.getByTestId('ontime-restaurant-filter')).toHaveTextContent('Chez Paul');
  });

  it('?restaurant= invalide : ignoré', () => {
    searchParams = new URLSearchParams({ restaurant: 'x' });
    reportsHook.mockReturnValue(page([], 0));
    render(<OntimePage />);
    expect(reportsHook).toHaveBeenLastCalledWith('contested', 0, null);
  });
});
