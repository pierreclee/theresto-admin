import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { AppVersionPoliciesCard } from '@/components/config/AppVersionPoliciesCard';
import { ActionError } from '@/lib/api/actionResult';
import { appVersionErrorMessage } from '@/lib/utils/appVersion';

const mutateAsync = jest.fn();
const T0 = '2026-11-27T10:00:00.123456+00:00';
const policies = [
  { platform: 'android', minVersion: '1.0.0', minBuild: 1, recommendedVersion: '1.0.0', recommendedBuild: 1, message: null, storeUrl: null, updatedAt: T0 },
  { platform: 'ios', minVersion: '1.0.0', minBuild: 1, recommendedVersion: '1.0.0', recommendedBuild: 1, message: null, storeUrl: null, updatedAt: T0 },
];

jest.mock('@/lib/hooks/useAppVersionPolicies', () => ({
  useAppVersionPolicies: () => ({ data: policies, isPending: false, error: null }),
  useUpdateAppVersionPolicy: () => ({ mutateAsync }),
}));

function openAndRaise() {
  render(<AppVersionPoliciesCard />);
  fireEvent.click(screen.getAllByText('Modifier')[0]);
  fireEvent.change(screen.getByLabelText('Version minimale'), { target: { value: '1.2.0' } });
  fireEvent.change(screen.getByLabelText('Build minimal'), { target: { value: '12' } });
  fireEvent.change(screen.getByLabelText('Version recommandée'), { target: { value: '1.2.0' } });
  fireEvent.change(screen.getByLabelText('Build recommandé'), { target: { value: '12' } });
  fireEvent.change(screen.getByLabelText('Lien du store'), {
    target: { value: 'https://play.google.com/store/apps/details?id=com.theresto.application' },
  });
}

describe('AppVersionPoliciesCard', () => {
  beforeEach(() => mutateAsync.mockReset());

  it('avertit avant de relever le minimum et envoie la saisie complète avec le code', async () => {
    mutateAsync.mockResolvedValue({});
    openAndRaise();
    expect(screen.getByText(/les versions plus anciennes seront bloquées/)).toBeInTheDocument();
    fireEvent.click(screen.getByText('Continuer'));
    fireEvent.change(screen.getByLabelText(/Code de votre application/), { target: { value: '123456' } });
    fireEvent.click(screen.getByText('Relever le minimum'));
    await waitFor(() => expect(mutateAsync).toHaveBeenCalledWith({
      platform: 'android', minVersion: '1.2.0', minBuild: 12, recommendedVersion: '1.2.0', recommendedBuild: 12,
      message: null, storeUrl: 'https://play.google.com/store/apps/details?id=com.theresto.application',
      expectedUpdatedAt: T0, totpCode: '123456',
    }));
  });

  it('refus MFA : reste sur le code et invite à le ressaisir', async () => {
    mutateAsync.mockRejectedValue(new ActionError(appVersionErrorMessage('permission-denied'), 'permission-denied'));
    openAndRaise();
    fireEvent.click(screen.getByText('Continuer'));
    fireEvent.change(screen.getByLabelText(/Code de votre application/), { target: { value: '123456' } });
    fireEvent.click(screen.getByText('Relever le minimum'));
    expect(await screen.findByRole('alert')).toHaveTextContent('Saisissez un nouveau code');
    expect(screen.getByLabelText(/Code de votre application/)).toHaveValue('');
  });

  it('saisie invalide : message, pas d envoi', () => {
    render(<AppVersionPoliciesCard />);
    fireEvent.click(screen.getAllByText('Modifier')[1]);
    fireEvent.change(screen.getByLabelText('Version recommandée'), { target: { value: '1.1.0' } });
    fireEvent.click(screen.getByText('Continuer'));
    expect(screen.getByRole('alert')).toHaveTextContent('Lien du store obligatoire');
    expect(mutateAsync).not.toHaveBeenCalled();
  });
});
