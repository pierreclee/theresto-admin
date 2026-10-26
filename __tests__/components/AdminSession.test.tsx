import { render, screen, waitFor } from '@testing-library/react';

const push = jest.fn();
let pathname = '/';
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push }),
  usePathname: () => pathname,
}));

const getAuthenticatorAssuranceLevel = jest.fn();
const auth = {
  getSession: jest.fn(),
  onAuthStateChange: jest.fn(() => ({ data: { subscription: { unsubscribe: jest.fn() } } })),
  signOut: jest.fn(),
  mfa: {
    listFactors: jest.fn(async () => ({ data: { totp: [{ id: 'f1' }], all: [{ id: 'f1' }] }, error: null })),
    getAuthenticatorAssuranceLevel,
  },
};
jest.mock('@/lib/supabase/client', () => ({ createClient: () => ({ auth }) }));

import { AuthProvider } from '@/lib/auth/context';
import { AdminGuard } from '@/components/AdminGuard';

const adminUser = { id: 'admin-1', email: 'a@theresto.fr', app_metadata: { admin: true }, user_metadata: {} };

function renderApp() {
  return render(
    <AuthProvider>
      <AdminGuard>
        <p>tableau de bord</p>
      </AdminGuard>
    </AuthProvider>,
  );
}

describe('AuthProvider + AdminGuard : niveau AAL de la session', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.clear();
    pathname = '/';
    auth.getSession.mockResolvedValue({ data: { session: { user: adminUser } }, error: null });
  });

  it('renvoie un admin en session AAL1 vers le challenge, même avec une session récente', async () => {
    localStorage.setItem('adminSessionStart', Date.now().toString());
    getAuthenticatorAssuranceLevel.mockResolvedValue({ data: { currentLevel: 'aal1', nextLevel: 'aal2' }, error: null });
    renderApp();
    await waitFor(() => expect(push).toHaveBeenCalledWith('/auth/mfa-challenge'));
    expect(push).not.toHaveBeenCalledWith('/');
  });

  it('reste sur le challenge tant que la session est AAL1', async () => {
    localStorage.setItem('adminSessionStart', Date.now().toString());
    getAuthenticatorAssuranceLevel.mockResolvedValue({ data: { currentLevel: 'aal1', nextLevel: 'aal2' }, error: null });
    pathname = '/auth/mfa-challenge';
    renderApp();
    await waitFor(() => expect(getAuthenticatorAssuranceLevel).toHaveBeenCalled());
    await screen.findByText('tableau de bord');
    expect(push).not.toHaveBeenCalledWith('/');
  });

  it('laisse passer un admin en session AAL2 récente', async () => {
    localStorage.setItem('adminSessionStart', Date.now().toString());
    getAuthenticatorAssuranceLevel.mockResolvedValue({ data: { currentLevel: 'aal2', nextLevel: 'aal2' }, error: null });
    renderApp();
    await screen.findByText('tableau de bord');
    expect(push).not.toHaveBeenCalled();
  });

  it('redemande le code quand la session AAL2 dépasse 2 h', async () => {
    localStorage.setItem('adminSessionStart', (Date.now() - 3 * 60 * 60 * 1000).toString());
    getAuthenticatorAssuranceLevel.mockResolvedValue({ data: { currentLevel: 'aal2', nextLevel: 'aal2' }, error: null });
    renderApp();
    await waitFor(() => expect(push).toHaveBeenCalledWith('/auth/mfa-challenge'));
  });
});
