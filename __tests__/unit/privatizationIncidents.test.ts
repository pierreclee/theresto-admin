import { incidentDetailLines, moneyActionLabel, resolutionError } from '@/lib/utils/privatizationIncidents';
import { incidentErrorMessage } from '@/lib/hooks/usePrivatizationIncidents';
import type { PrivatizationIncident } from '@/lib/types/privatizationIncidents';

jest.mock('@/lib/actions/privatizationIncidents', () => ({}));
jest.mock('@/lib/auth/verifyTotp', () => ({ verifyTotpCode: jest.fn() }));

describe('resolutionError', () => {
  it('exige 3 à 1000 caractères', () => {
    expect(resolutionError('  ')).toMatch(/Décrivez/);
    expect(resolutionError('ok')).toMatch(/Décrivez/);
    expect(resolutionError('Remboursé')).toBeNull();
    expect(resolutionError('x'.repeat(1001))).toMatch(/1000 caractères/);
  });
});

describe('moneyActionLabel', () => {
  it('nomme l’action selon le type d’incident', () => {
    expect(moneyActionLabel('refund_failed', 'retryRefund')).toBe('Relancer le remboursement');
    expect(moneyActionLabel('paid_after_cancellation', 'retryRefund')).toBe('Rembourser le client');
    expect(moneyActionLabel('customer_balance_funds', 'returnCustomerBalance')).toBe('Restituer au client');
  });
});

describe('incidentDetailLines', () => {
  it('reprend erreur, tentatives, moyen et objet Stripe', () => {
    const lines = incidentDetailLines({
      details: { lastError: 'Card declined', attempts: 1, method: 'bank_transfer' },
      stripeObjectId: 're_1',
      stripeAccountId: 'acct_1',
    } as unknown as PrivatizationIncident);
    expect(lines).toEqual([
      'Erreur Stripe : Card declined',
      'Tentatives : 1',
      'Moyen : virement',
      'Objet Stripe : re_1',
      'Compte Stripe : acct_1',
    ]);
  });
});

describe('incidentErrorMessage', () => {
  it('garde le message métier du serveur', () => {
    expect(incidentErrorMessage('failed-precondition', 'Cet incident est déjà traité.')).toBe('Cet incident est déjà traité.');
  });
  it('traduit les erreurs techniques', () => {
    expect(incidentErrorMessage('permission-denied', 'MFA required')).toMatch(/deux étapes/);
    expect(incidentErrorMessage('internal', 'Incident action failed')).toMatch(/Réessayez/);
  });
});
