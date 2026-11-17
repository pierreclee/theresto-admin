import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { RestaurantAlertSettingsCard } from '@/components/config/RestaurantAlertSettingsCard';
import { ActionError } from '@/lib/api/actionResult';
import { ALERT_SETTINGS_CONFLICT_MESSAGE } from '@/lib/utils/restaurantAlerts';

const mutateAsync = jest.fn();
const settings = {
  minCount: 5, minRate: 0.1, trackingSince: '2026-11-17T00:00:00Z', updatedAt: '2026-11-17T10:00:00.123Z', updatedBy: 'vous',
};

jest.mock('@/lib/hooks/useRestaurantAlerts', () => ({
  useAlertSettings: () => ({ data: settings, isPending: false, error: null }),
  useUpdateAlertSettings: () => ({ mutateAsync, isPending: false }),
}));

describe('RestaurantAlertSettingsCard', () => {
  beforeEach(() => mutateAsync.mockReset());

  it('affiche N, X en %, le début du suivi et l’auteur', () => {
    render(<RestaurantAlertSettingsCard />);
    expect(screen.getByText('5')).toBeInTheDocument();
    expect(screen.getByText(/^10\s%$/)).toBeInTheDocument();
    expect(screen.getByText(/Suivi depuis le 17 nov\. 2026/)).toBeInTheDocument();
    expect(screen.getByText(/par vous/)).toBeInTheDocument();
  });

  it('envoie le pourcentage saisi et la version lue', async () => {
    mutateAsync.mockResolvedValue({ changed: true });
    render(<RestaurantAlertSettingsCard />);
    fireEvent.click(screen.getByText('Modifier'));
    fireEvent.change(screen.getByLabelText(/N : demandes/), { target: { value: '3' } });
    fireEvent.change(screen.getByLabelText(/X : taux/), { target: { value: '7,5' } });
    fireEvent.click(screen.getByText('Enregistrer'));
    await waitFor(() => expect(mutateAsync).toHaveBeenCalledWith({
      values: { minCount: 3, minRatePercent: 7.5 }, expectedUpdatedAt: '2026-11-17T10:00:00.123Z',
    }));
  });

  it('refuse une saisie invalide sans appel', () => {
    render(<RestaurantAlertSettingsCard />);
    fireEvent.click(screen.getByText('Modifier'));
    fireEvent.change(screen.getByLabelText(/N : demandes/), { target: { value: '0' } });
    fireEvent.click(screen.getByText('Enregistrer'));
    expect(screen.getByRole('alert')).toHaveTextContent(/entier entre 1 et 1000/);
    expect(mutateAsync).not.toHaveBeenCalled();
  });

  it('conflit : message « modifiés entre-temps », formulaire refermé sur les valeurs rechargées', async () => {
    mutateAsync.mockRejectedValue(new ActionError(ALERT_SETTINGS_CONFLICT_MESSAGE, 'conflict'));
    render(<RestaurantAlertSettingsCard />);
    fireEvent.click(screen.getByText('Modifier'));
    fireEvent.change(screen.getByLabelText(/N : demandes/), { target: { value: '3' } });
    fireEvent.click(screen.getByText('Enregistrer'));
    expect(await screen.findByRole('alert')).toHaveTextContent(ALERT_SETTINGS_CONFLICT_MESSAGE);
    expect(screen.queryByText('Enregistrer')).not.toBeInTheDocument();
  });
});
