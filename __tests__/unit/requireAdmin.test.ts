/**
 * @jest-environment node
 */
const getUser = jest.fn();
const getSession = jest.fn();

jest.mock('next/headers', () => ({
  cookies: jest.fn(async () => ({ get: () => undefined, getAll: () => [], set: () => {} })),
}));
jest.mock('@supabase/ssr', () => ({
  createServerClient: jest.fn(() => ({ auth: { getUser, getSession } })),
}));
jest.mock('@/lib/supabase/config', () => ({
  getSupabaseCredentials: () => ({ url: 'http://localhost', anonKey: 'anon', serviceKey: 'service' }),
}));

import { requireAdmin } from '@/lib/supabase/server';

const jwt = (claims: Record<string, unknown>) =>
  `${Buffer.from('{"alg":"HS256"}').toString('base64url')}.${Buffer.from(JSON.stringify(claims)).toString('base64url')}.sig`;
const admin = { id: 'admin-1', app_metadata: { admin: true } };

describe('requireAdmin', () => {
  beforeEach(() => jest.clearAllMocks());

  it('accepte un admin en session AAL2', async () => {
    getUser.mockResolvedValue({ data: { user: admin }, error: null });
    getSession.mockResolvedValue({ data: { session: { access_token: jwt({ aal: 'aal2' }) } } });
    await expect(requireAdmin()).resolves.toMatchObject({ id: 'admin-1' });
  });

  it('valide auprès de Supabase le jeton dont il lit le niveau AAL', async () => {
    const token = jwt({ aal: 'aal2' });
    getUser.mockResolvedValue({ data: { user: admin }, error: null });
    getSession.mockResolvedValue({ data: { session: { access_token: token } } });
    await requireAdmin();
    expect(getUser).toHaveBeenCalledWith(token);
  });

  it('refuse un admin sans second facteur (AAL1)', async () => {
    getUser.mockResolvedValue({ data: { user: admin }, error: null });
    getSession.mockResolvedValue({ data: { session: { access_token: jwt({ aal: 'aal1' }) } } });
    await expect(requireAdmin()).rejects.toThrow(/AAL2/);
  });

  it('refuse sans session', async () => {
    getUser.mockResolvedValue({ data: { user: null }, error: null });
    getSession.mockResolvedValue({ data: { session: null } });
    await expect(requireAdmin()).rejects.toThrow(/Unauthorized/);
  });

  it('refuse un compte non admin, même en AAL2', async () => {
    getUser.mockResolvedValue({ data: { user: { id: 'u', app_metadata: {} } }, error: null });
    getSession.mockResolvedValue({ data: { session: { access_token: jwt({ aal: 'aal2' }) } } });
    await expect(requireAdmin()).rejects.toThrow(/not an admin/);
  });
});
