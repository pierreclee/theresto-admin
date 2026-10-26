import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';

const push = jest.fn();
let pathname = '/';
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push }),
  usePathname: () => pathname,
}));

type AuthCallback = (event: string, session: unknown) => Promise<void> | void;
let authCallback: AuthCallback | undefined;

const getAuthenticatorAssuranceLevel = jest.fn();
const verifiedFactors = { data: { totp: [{ id: 'f1', status: 'verified' }], all: [{ id: 'f1', status: 'verified' }] }, error: null };
const auth = {
  getSession: jest.fn(),
  onAuthStateChange: jest.fn((callback: AuthCallback) => {
    authCallback = callback;
    return { data: { subscription: { unsubscribe: jest.fn() } } };
  }),
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
import { ADMIN_SESSION_MAX_AGE_SECONDS } from '@/lib/utils/recentMfa';

const adminUser = { id: 'admin-1', email: 'a@theresto.fr', app_metadata: { admin: true }, user_metadata: {} };
const nowSeconds = () => Math.floor(Date.now() / 1000);

/** Session renvoyée par getAuthenticatorAssuranceLevel, TOTP vérifié il y a [ageSeconds]. */
function aal2(ageSeconds: number) {
  return {
    data: {
      currentLevel: 'aal2',
      nextLevel: 'aal2',
      currentAuthenticationMethods: [
        { method: 'password', timestamp: nowSeconds() - ageSeconds - 10 },
        { method: 'totp', timestamp: nowSeconds() - ageSeconds },
      ],
    },
    error: null,
  };
}
const aal1 = {
  data: { currentLevel: 'aal1', nextLevel: 'aal2', currentAuthenticationMethods: [{ method: 'password', timestamp: 1 }] },
  error: null,
};

function renderApp(children: React.ReactNode = <p>tableau de bord</p>) {
  return render(
    <AuthProvider>
      <AdminGuard>{children}</AdminGuard>
    </AuthProvider>,
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  authCallback = undefined;
  pathname = '/';
  auth.getSession.mockResolvedValue({ data: { session: { user: adminUser } }, error: null });
  auth.mfa.listFactors.mockResolvedValue(verifiedFactors);
});

describe('AuthProvider + AdminGuard : session admin = AAL2 + TOTP de moins de 2 h', () => {
  it('renvoie un admin en session AAL1 vers le challenge', async () => {
    getAuthenticatorAssuranceLevel.mockResolvedValue(aal1);
    renderApp();
    await waitFor(() => expect(push).toHaveBeenCalledWith('/auth/mfa-challenge'));
    expect(push).not.toHaveBeenCalledWith('/');
  });

  it('reste sur le challenge tant que la session est AAL1', async () => {
    getAuthenticatorAssuranceLevel.mockResolvedValue(aal1);
    pathname = '/auth/mfa-challenge';
    renderApp();
    await waitFor(() => expect(getAuthenticatorAssuranceLevel).toHaveBeenCalled());
    await screen.findByText('tableau de bord');
    expect(push).not.toHaveBeenCalledWith('/');
  });

  it("envoie vers l'enrôlement un admin dont l'enrôlement TOTP a été abandonné", async () => {
    auth.mfa.listFactors.mockResolvedValue({
      data: { totp: [], all: [{ id: 'f0', status: 'unverified' }] },
      error: null,
    });
    getAuthenticatorAssuranceLevel.mockResolvedValue({ ...aal1, data: { ...aal1.data, nextLevel: 'aal1' } });
    renderApp();
    await waitFor(() => expect(push).toHaveBeenCalledWith('/auth/mfa-enrollment'));
    expect(push).not.toHaveBeenCalledWith('/auth/mfa-challenge');
  });

  it('laisse passer un admin dont le code TOTP date de moins de 2 h', async () => {
    getAuthenticatorAssuranceLevel.mockResolvedValue(aal2(119 * 60));
    renderApp();
    await screen.findByText('tableau de bord');
    await waitFor(() => expect(getAuthenticatorAssuranceLevel).toHaveBeenCalled());
    expect(push).not.toHaveBeenCalled();
  });

  it('renvoie vers le challenge une session AAL2 dont le code TOTP date de 3 h', async () => {
    getAuthenticatorAssuranceLevel.mockResolvedValue(aal2(3 * 60 * 60));
    renderApp();
    await waitFor(() => expect(push).toHaveBeenCalledWith('/auth/mfa-challenge'));
  });

  it('refuse une session AAL2 sans TOTP horodaté (amr au format texte)', async () => {
    getAuthenticatorAssuranceLevel.mockResolvedValue({
      data: { currentLevel: 'aal2', nextLevel: 'aal2', currentAuthenticationMethods: ['password', 'totp'] },
      error: null,
    });
    renderApp();
    await waitFor(() => expect(push).toHaveBeenCalledWith('/auth/mfa-challenge'));
  });
});

describe("AuthProvider : échéance des 2 h sans événement d'authentification", () => {
  afterEach(() => jest.useRealTimers());

  it("renvoie vers le challenge à l'échéance du code TOTP, pas avant", async () => {
    jest.useFakeTimers();
    getAuthenticatorAssuranceLevel.mockResolvedValue(aal2(ADMIN_SESSION_MAX_AGE_SECONDS - 60));
    renderApp();
    await screen.findByText('tableau de bord');
    await waitFor(() => expect(getAuthenticatorAssuranceLevel).toHaveBeenCalled());

    await act(async () => { jest.advanceTimersByTime(59 * 1000); });
    expect(push).not.toHaveBeenCalledWith('/auth/mfa-challenge');

    await act(async () => { jest.advanceTimersByTime(2 * 1000); });
    expect(push).toHaveBeenCalledWith('/auth/mfa-challenge');
  });

  it("annule l'échéance au démontage", async () => {
    jest.useFakeTimers();
    getAuthenticatorAssuranceLevel.mockResolvedValue(aal2(ADMIN_SESSION_MAX_AGE_SECONDS - 60));
    const { unmount } = renderApp();
    await screen.findByText('tableau de bord');
    await waitFor(() => expect(getAuthenticatorAssuranceLevel).toHaveBeenCalled());
    expect(jest.getTimerCount()).toBeGreaterThan(0);
    unmount();
    expect(jest.getTimerCount()).toBe(0);
  });

  it("repousse l'échéance quand un nouveau code TOTP est vérifié", async () => {
    jest.useFakeTimers();
    getAuthenticatorAssuranceLevel.mockResolvedValue(aal2(ADMIN_SESSION_MAX_AGE_SECONDS - 60));
    renderApp();
    await screen.findByText('tableau de bord');
    await waitFor(() => expect(authCallback).toBeDefined());

    getAuthenticatorAssuranceLevel.mockResolvedValue(aal2(0));
    await act(async () => { await authCallback!('MFA_CHALLENGE_VERIFIED', { user: adminUser }); });
    await act(async () => { jest.advanceTimersByTime(5 * 60 * 1000); });
    expect(push).not.toHaveBeenCalledWith('/auth/mfa-challenge');
  });
});

describe('Parcours challenge', () => {
  it('valide la session dès verify, sans retour au challenge', async () => {
    pathname = '/auth/mfa-challenge';
    getAuthenticatorAssuranceLevel.mockResolvedValue(aal1);
    auth.mfa.challenge.mockResolvedValue({ data: { id: 'c1' }, error: null });
    // Comme auth-js : le nouveau jeton (AAL2, TOTP de maintenant) est enregistré, puis
    // MFA_CHALLENGE_VERIFIED est notifié et attendu avant que verify rende la main.
    auth.mfa.verify.mockImplementation(async () => {
      getAuthenticatorAssuranceLevel.mockResolvedValue(aal2(0));
      await authCallback!('MFA_CHALLENGE_VERIFIED', { user: adminUser });
      return { data: {}, error: null };
    });

    renderApp(<MFAChallengePage />);
    await waitFor(() => expect(authCallback).toBeDefined());
    fireEvent.change(screen.getByLabelText(/Code de vérification/), { target: { value: '123456' } });
    fireEvent.submit(screen.getByLabelText(/Code de vérification/).closest('form')!);

    await waitFor(() => expect(push).toHaveBeenCalledWith('/'));
    expect(push).not.toHaveBeenCalledWith('/auth/mfa-challenge');
  });

  it('un code refusé laisse la session invalide', async () => {
    pathname = '/auth/mfa-challenge';
    getAuthenticatorAssuranceLevel.mockResolvedValue(aal1);
    auth.mfa.challenge.mockResolvedValue({ data: { id: 'c1' }, error: null });
    auth.mfa.verify.mockResolvedValue({ error: { message: 'Invalid TOTP code entered' } });

    renderApp(<MFAChallengePage />);
    await waitFor(() => expect(getAuthenticatorAssuranceLevel).toHaveBeenCalled());
    fireEvent.change(screen.getByLabelText(/Code de vérification/), { target: { value: '123456' } });
    fireEvent.submit(screen.getByLabelText(/Code de vérification/).closest('form')!);
    await screen.findByText('Invalid TOTP code entered');
    expect(push).not.toHaveBeenCalledWith('/');
  });
});
