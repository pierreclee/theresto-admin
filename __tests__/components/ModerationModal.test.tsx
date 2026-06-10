import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ModerationModal } from '@/components/users/ModerationModal';
import type { AppUser } from '@/lib/types/user';

const makeUser = (overrides: Partial<AppUser> = {}): AppUser => ({
  id: 'u1',
  email: 'alice@example.com',
  name: 'Alice Dupont',
  roles: ['customer'],
  loyaltyPoints: 0,
  lifetimePoints: 0,
  moderationStatus: 'active',
  ...overrides,
});

describe('ModerationModal', () => {
  it('shows suspend and ban options for an active user', () => {
    render(<ModerationModal user={makeUser()} onConfirm={jest.fn()} onClose={jest.fn()} />);
    expect(screen.getByText('Suspendre')).toBeInTheDocument();
    expect(screen.getByText('Bannir')).toBeInTheDocument();
    expect(screen.queryByText('Réactiver')).not.toBeInTheDocument();
  });

  it('shows only activate option for a suspended user', () => {
    render(<ModerationModal user={makeUser({ moderationStatus: 'suspended' })} onConfirm={jest.fn()} onClose={jest.fn()} />);
    // Single-action mode shows description, not label buttons
    expect(screen.getByText("Restaure l'accès complet au compte.")).toBeInTheDocument();
    expect(screen.queryByText('Suspendre')).not.toBeInTheDocument();
    expect(screen.queryByText('Bannir')).not.toBeInTheDocument();
  });

  it('shows only activate option for a banned user', () => {
    render(<ModerationModal user={makeUser({ moderationStatus: 'banned' })} onConfirm={jest.fn()} onClose={jest.fn()} />);
    expect(screen.getByText("Restaure l'accès complet au compte.")).toBeInTheDocument();
    expect(screen.queryByText('Suspendre')).not.toBeInTheDocument();
  });

  it('requires a reason when suspending', async () => {
    render(<ModerationModal user={makeUser()} onConfirm={jest.fn()} onClose={jest.fn()} />);
    fireEvent.click(screen.getByText('Confirmer'));
    await waitFor(() => {
      expect(screen.getByText('Une raison est obligatoire.')).toBeInTheDocument();
    });
  });

  it('calls onConfirm with suspend action and reason', async () => {
    const onConfirm = jest.fn().mockResolvedValue(undefined);
    render(<ModerationModal user={makeUser()} onConfirm={onConfirm} onClose={jest.fn()} />);

    fireEvent.change(screen.getByPlaceholderText(/raison/i), {
      target: { value: 'Comportement inapproprié' },
    });
    fireEvent.click(screen.getByText('Confirmer'));

    await waitFor(() => {
      expect(onConfirm).toHaveBeenCalledWith('suspend', 'Comportement inapproprié');
    });
  });

  it('calls onConfirm with activate action and no reason', async () => {
    const onConfirm = jest.fn().mockResolvedValue(undefined);
    render(
      <ModerationModal
        user={makeUser({ moderationStatus: 'suspended' })}
        onConfirm={onConfirm}
        onClose={jest.fn()}
      />
    );
    fireEvent.click(screen.getByText('Confirmer'));
    await waitFor(() => {
      expect(onConfirm).toHaveBeenCalledWith('activate', undefined);
    });
  });

  it('calls onClose when Annuler is clicked', () => {
    const onClose = jest.fn();
    render(<ModerationModal user={makeUser()} onConfirm={jest.fn()} onClose={onClose} />);
    fireEvent.click(screen.getByText('Annuler'));
    expect(onClose).toHaveBeenCalled();
  });

  it('displays the user name and email', () => {
    render(<ModerationModal user={makeUser()} onConfirm={jest.fn()} onClose={jest.fn()} />);
    expect(screen.getByText('Alice Dupont')).toBeInTheDocument();
    expect(screen.getByText('alice@example.com')).toBeInTheDocument();
  });
});
