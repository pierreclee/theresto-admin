import React from 'react';
import { render, screen } from '@testing-library/react';
import { AuditLogsViewer } from '@/components/monitoring/AuditLogsViewer';
import { ActionError } from '@/lib/api/actionResult';

const useAuditLogs = jest.fn();
jest.mock('@/lib/hooks/useAuditLogs', () => ({ useAuditLogs: (...args: unknown[]) => useAuditLogs(...args) }));

describe('AuditLogsViewer : erreur de lecture du journal', () => {
  it('affiche le message renvoyé par la Server Action', () => {
    useAuditLogs.mockReturnValue({ data: undefined, isPending: false, error: new ActionError('relation indisponible') });
    render(<AuditLogsViewer />);
    expect(screen.getByRole('alert')).toHaveTextContent('relation indisponible');
  });

  it('message de repli pour une autre erreur', () => {
    useAuditLogs.mockReturnValue({ data: undefined, isPending: false, error: new Error('masqué') });
    render(<AuditLogsViewer />);
    expect(screen.getByRole('alert')).toHaveTextContent('Erreur de chargement du journal');
  });

  it('aucune alerte sans erreur', () => {
    useAuditLogs.mockReturnValue({ data: { logs: [], total: 0 }, isPending: false, error: null });
    render(<AuditLogsViewer />);
    expect(screen.queryByRole('alert')).toBeNull();
  });
});
