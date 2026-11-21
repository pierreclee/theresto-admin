import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MaintenanceCard } from '@/components/config/MaintenanceCard';
import { ActionError } from '@/lib/api/actionResult';
import { platformStatusErrorMessage, PLATFORM_STATUS_CONFLICT_MESSAGE } from '@/lib/utils/platformStatus';
import type { PlatformStatus, PlatformStatusInput } from '@/lib/types/platformStatus';

const mutateAsync = jest.fn();
const T0 = '2026-12-01T10:00:00.123456+00:00';
const NOW = new Date('2026-12-01T10:00:00Z');
const HOUR = 3600 * 1000;
const at = (h: number) => new Date(NOW.getTime() + h * HOUR).toISOString();

const off: PlatformStatus = {
  enabled: false, level: 'clients', startsAt: null, endsAt: null, message: null,
  active: false, announced: false, updatedAt: T0,
};
let status: PlatformStatus = off;

jest.mock('@/lib/hooks/usePlatformStatus', () => ({
  usePlatformStatus: () => ({ data: status, isPending: false, error: null }),
  useUpdatePlatformStatus: () => ({ mutateAsync }),
  useMaintenancePeriods: () => ({
    data: [{ id: 1, level: 'all', startedAt: '2026-11-20T01:00:00Z', endedAt: '2026-11-20T03:30:00Z' }],
    isPending: false,
    error: null,
  }),
}));

/** Saisie envoyée : la mutation reçoit une fonction (appelée après la vérification du code). */
const sentInput = (): PlatformStatusInput => mutateAsync.mock.calls.at(-1)?.[0].input();

function typeCode() {
  fireEvent.change(screen.getByLabelText(/Code de votre application/), { target: { value: '123456' } });
}

describe('MaintenanceCard', () => {
  beforeEach(() => {
    jest.useFakeTimers({ now: NOW, doNotFake: ['nextTick', 'setImmediate', 'queueMicrotask'] });
    mutateAsync.mockReset().mockResolvedValue({});
    status = off;
  });
  afterEach(() => jest.useRealTimers());

  it('désactivée : état, historique, pas de « Terminer »', () => {
    render(<MaintenanceCard />);
    expect(screen.getByTestId('maintenance-phase')).toHaveTextContent('Désactivée');
    expect(screen.getByText('Aucune maintenance programmée.')).toBeInTheDocument();
    expect(screen.getByText('2 h 30')).toBeInTheDocument();
    expect(screen.queryByText('Terminer maintenant')).not.toBeInTheDocument();
  });

  it('programme une maintenance « clients » : saisie de Paris, annonce 48 h, code', async () => {
    render(<MaintenanceCard />);
    fireEvent.click(screen.getByText('Programmer une maintenance'));
    fireEvent.click(screen.getByLabelText('Programmé'));
    fireEvent.change(screen.getByLabelText('Date et heure de début'), { target: { value: '2026-12-05T02:00' } });
    fireEvent.click(screen.getByLabelText('Retour prévu'));
    fireEvent.change(screen.getByLabelText('Date et heure de fin'), { target: { value: '2026-12-05T04:00' } });
    fireEvent.click(screen.getByText('Continuer'));
    expect(screen.getByText(/affiché à partir du 3 déc\. 2026/)).toBeInTheDocument();
    expect(screen.queryByText(/Je confirme fermer aussi le Hub/)).not.toBeInTheDocument();
    typeCode();
    fireEvent.click(screen.getByText('Enregistrer'));
    await waitFor(() => expect(mutateAsync).toHaveBeenCalled());
    expect(mutateAsync.mock.calls[0][0].totpCode).toBe('123456');
    expect(sentInput()).toEqual({
      enabled: true, level: 'clients', startsAt: '2026-12-05T01:00:00.000Z', endsAt: '2026-12-05T03:00:00.000Z',
      message: null, expectedUpdatedAt: T0,
    });
  });

  it('niveau « tout » : confirmation explicite exigée avant l envoi', async () => {
    render(<MaintenanceCard />);
    fireEvent.click(screen.getByText('Programmer une maintenance'));
    fireEvent.click(screen.getByLabelText(/^Tout/));
    fireEvent.click(screen.getByText('Continuer'));
    expect(screen.getByText(/sans préavis/)).toBeInTheDocument();
    typeCode();
    const save = screen.getByText('Enregistrer');
    expect(save).toBeDisabled();
    fireEvent.click(screen.getByLabelText(/Je confirme fermer aussi le Hub/));
    expect(save).not.toBeDisabled();
    fireEvent.click(save);
    await waitFor(() => expect(mutateAsync).toHaveBeenCalled());
    expect(sentInput()).toMatchObject({ enabled: true, level: 'all', endsAt: null });
  });

  it('saisie invalide : message, pas d appel', () => {
    render(<MaintenanceCard />);
    fireEvent.click(screen.getByText('Programmer une maintenance'));
    fireEvent.click(screen.getByLabelText('Programmé'));
    fireEvent.change(screen.getByLabelText('Date et heure de début'), { target: { value: '2026-11-30T02:00' } });
    fireEvent.click(screen.getByText('Continuer'));
    expect(screen.getByRole('alert')).toHaveTextContent('Début déjà passé');
    expect(mutateAsync).not.toHaveBeenCalled();
  });

  it('en cours : « Terminer maintenant » désactive en gardant le réglage', async () => {
    status = { ...off, enabled: true, level: 'all', startsAt: at(-1), endsAt: at(2), message: 'Migration', active: true };
    render(<MaintenanceCard />);
    expect(screen.getByTestId('maintenance-phase')).toHaveTextContent('En cours');
    fireEvent.click(screen.getByText('Terminer maintenant'));
    typeCode();
    fireEvent.click(screen.getAllByText('Terminer maintenant').at(-1) as HTMLElement);
    await waitFor(() => expect(mutateAsync).toHaveBeenCalled());
    expect(sentInput()).toEqual({
      enabled: false, level: 'all', startsAt: at(-1), endsAt: at(2), message: 'Migration', expectedUpdatedAt: T0,
    });
  });

  it('annoncée puis en cours au fil du temps, sans relecture', () => {
    status = { ...off, enabled: true, startsAt: at(0.25), announced: true };
    render(<MaintenanceCard />);
    expect(screen.getByTestId('maintenance-phase')).toHaveTextContent('Annoncée');
    expect(screen.getByText('Annuler la maintenance')).toBeInTheDocument();
    act(() => { jest.advanceTimersByTime(0.5 * HOUR); });
    expect(screen.getByTestId('maintenance-phase')).toHaveTextContent('En cours');
  });

  it('nouvel état (enregistrement « Maintenant ») : « En cours » tout de suite, sans attendre 30 s', () => {
    const { rerender } = render(<MaintenanceCard />);
    act(() => { jest.advanceTimersByTime(20 * 1000); });
    // Enregistrée 20 s après le dernier tic : début = heure de l'envoi.
    status = { ...off, enabled: true, level: 'all', startsAt: new Date().toISOString(), active: true, updatedAt: '2026-12-01T10:00:20.000000+00:00' };
    rerender(<MaintenanceCard />);
    expect(screen.getByTestId('maintenance-phase')).toHaveTextContent('En cours');
  });

  it('début programmé dans quelques secondes : « En cours » à l heure dite', () => {
    status = { ...off, enabled: true, startsAt: new Date(NOW.getTime() + 5000).toISOString(), announced: true };
    render(<MaintenanceCard />);
    expect(screen.getByTestId('maintenance-phase')).toHaveTextContent('Annoncée');
    act(() => { jest.advanceTimersByTime(5100); });
    expect(screen.getByTestId('maintenance-phase')).toHaveTextContent('En cours');
  });

  it('fin automatique atteinte : « Terminée »', () => {
    status = { ...off, enabled: true, startsAt: at(-3), endsAt: at(-1) };
    render(<MaintenanceCard />);
    expect(screen.getByTestId('maintenance-phase')).toHaveTextContent('Terminée');
    expect(screen.getByText('Programmer une maintenance')).toBeInTheDocument();
  });

  it('conflit : retour à la saisie avec le message de rechargement', async () => {
    mutateAsync.mockRejectedValue(new ActionError(PLATFORM_STATUS_CONFLICT_MESSAGE, 'conflict'));
    render(<MaintenanceCard />);
    fireEvent.click(screen.getByText('Programmer une maintenance'));
    fireEvent.click(screen.getByText('Continuer'));
    typeCode();
    fireEvent.click(screen.getByText('Enregistrer'));
    expect(await screen.findByRole('alert')).toHaveTextContent('a changé entre-temps');
    expect(screen.getByText('Continuer')).toBeInTheDocument();
  });

  it('état relu pendant la saisie : la version lue à l ouverture part (409 côté serveur, pas d écrasement)', async () => {
    const { rerender } = render(<MaintenanceCard />);
    fireEvent.click(screen.getByText('Programmer une maintenance'));
    // Relecture (chaque minute, ou après un échec) : un autre admin a modifié la maintenance.
    status = { ...off, updatedAt: '2026-12-01T10:01:30.000000+00:00' };
    rerender(<MaintenanceCard />);
    fireEvent.click(screen.getByText('Continuer'));
    typeCode();
    fireEvent.click(screen.getByText('Enregistrer'));
    await waitFor(() => expect(mutateAsync).toHaveBeenCalled());
    expect(sentInput().expectedUpdatedAt).toBe(T0);
  });

  it('désactivation : version lue à l ouverture, même après une relecture', async () => {
    status = { ...off, enabled: true, startsAt: at(-1), endsAt: at(2), active: true };
    const { rerender } = render(<MaintenanceCard />);
    fireEvent.click(screen.getByText('Terminer maintenant'));
    status = { ...status, endsAt: at(5), updatedAt: '2026-12-01T10:01:30.000000+00:00' };
    rerender(<MaintenanceCard />);
    typeCode();
    fireEvent.click(screen.getAllByText('Terminer maintenant').at(-1) as HTMLElement);
    await waitFor(() => expect(mutateAsync).toHaveBeenCalled());
    expect(sentInput()).toMatchObject({ enabled: false, endsAt: at(2), expectedUpdatedAt: T0 });
  });

  it('conflit : la saisie repart de l état relu, avec sa version', async () => {
    const T1 = '2026-12-01T10:01:30.000000+00:00';
    mutateAsync.mockRejectedValueOnce(new ActionError(PLATFORM_STATUS_CONFLICT_MESSAGE, 'conflict'));
    const { rerender } = render(<MaintenanceCard />);
    fireEvent.click(screen.getByText('Programmer une maintenance'));
    fireEvent.click(screen.getByText('Continuer'));
    typeCode();
    fireEvent.click(screen.getByText('Enregistrer'));
    expect(await screen.findByRole('alert')).toHaveTextContent('a changé entre-temps');
    expect(sentInput().expectedUpdatedAt).toBe(T0);
    status = { ...off, enabled: true, startsAt: at(30), endsAt: at(32), updatedAt: T1 };
    rerender(<MaintenanceCard />);
    // Saisie reprise de l'état relu (maintenance programmée par l'autre admin).
    expect(screen.getByLabelText('Date et heure de début')).toHaveValue('2026-12-02T17:00');
    fireEvent.click(screen.getByText('Continuer'));
    typeCode();
    fireEvent.click(screen.getByText('Enregistrer'));
    await waitFor(() => expect(mutateAsync).toHaveBeenCalledTimes(2));
    expect(sentInput()).toMatchObject({ startsAt: at(30), expectedUpdatedAt: T1 });
  });

  it('journal en échec (503) : reste sur le code, message affiché', async () => {
    mutateAsync.mockRejectedValue(new ActionError(platformStatusErrorMessage('audit-log-failed'), 'audit-log-failed'));
    render(<MaintenanceCard />);
    fireEvent.click(screen.getByText('Programmer une maintenance'));
    fireEvent.click(screen.getByText('Continuer'));
    typeCode();
    fireEvent.click(screen.getByText('Enregistrer'));
    expect(await screen.findByRole('alert')).toHaveTextContent("journal d'administration");
    expect(screen.getByLabelText(/Code de votre application/)).toHaveValue('');
  });
});
