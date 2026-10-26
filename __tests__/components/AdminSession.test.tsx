import { render, screen, waitFor } from '@testing-library/react';

const push = jest.fn();
let pathname = '/';
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push }),
  usePathname: () => pathname,
}));

const getAuthenticatorAssuranceLevel = jest.fn();
const verifiedFactors = { data: { totp: [{ id: 'f1', status: 'verified' }], all: [{ id: 'f1', status: 'verified' }] }, error: null };
const auth = {
  getSession: jest.fn(),
  onAuthStateChange: jest.fn(() => ({ data: { subscription: { unsubscribe: jest.fn() } } })),
  signOut: jest.fn(),
  mfa: {
    listFactors: jest.fn(),
    getAuthenticatorAssuranceLevel,
    challenge: jest.fn(),
    verify: jest.fn(),
  },
};
jest.mock('@/lib/supabase/client', () => ({ createClient: () => ({ auth }) }));

import { AuthProvider } from '@/lib/auth/context';
import { AdminGuard } from '@/components/AdminGuard';
import MFAChallengePage from '@/app/auth/mfa-challenge/page';
import { fireEvent } from '@testing-library/react';

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
    auth.mfa.listFactors.mockResolvedValue(verifiedFactors);
  });

  it("envoie vers l'enrôlement un admin dont l'enrôlement TOTP a été abandonné", async () => {
    auth.mfa.listFactors.mockResolvedValue({
      data: { totp: [], all: [{ id: 'f0', status: 'unverified' }] },
      error: null,
    });
    getAuthenticatorAssuranceLevel.mockResolvedValue({ data: { currentLevel: 'aal1', nextLevel: 'aal1' }, error: null });
    renderApp();
    await waitFor(() => expect(push).toHaveBeenCalledWith('/auth/mfa-enrollment'));
    expect(push).not.toHaveBeenCalledWith('/auth/mfa-challenge');
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

describe('MFAChallengePage : code refusé', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.clear();
    auth.mfa.listFactors.mockResolvedValue(verifiedFactors);
    auth.mfa.challenge.mockResolvedValue({ data: { id: 'c1' }, error: null });
    auth.mfa.verify.mockResolvedValue({ error: { message: 'Invalid TOTP code entered' } });
  });

  async function submitWrongCode() {
    render(<MFAChallengePage />);
    fireEvent.change(screen.getByLabelText(/Code de vérification/), { target: { value: '123456' } });
    fireEvent.submit(screen.getByLabelText(/Code de vérification/).closest('form')!);
    await screen.findByText('Invalid TOTP code entered');
  }

  it("retire adminSessionStart s'il n'existait pas", async () => {
    await submitWrongCode();
    expect(localStorage.getItem('adminSessionStart')).toBeNull();
    expect(push).not.toHaveBeenCalled();
  });

  it("remet l'ancienne valeur d'adminSessionStart", async () => {
    localStorage.setItem('adminSessionStart', '1700000000000');
    await submitWrongCode();
    expect(localStorage.getItem('adminSessionStart')).toBe('1700000000000');
  });
});
