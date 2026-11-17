import React from 'react';
import { render } from '@testing-library/react';
import { Sidebar } from '@/components/Sidebar';

// D4 (recette PR #8) : les badges de la barre latérale n'interrogent pas le serveur sur les
// pages de connexion ni hors session admin valide.

const auth = { adminUser: null, signOut: jest.fn(), isAdmin: true, sessionValid: true };
let pathname = '/';
const openIncidentCount = jest.fn<number, [boolean]>(() => 0);
const restaurants = jest.fn<{ data: undefined }, [unknown, { enabled?: boolean } | undefined]>(() => ({ data: undefined }));

jest.mock('next/navigation', () => ({ usePathname: () => pathname, useRouter: () => ({ push: jest.fn() }) }));
jest.mock('next/link', () => ({
  __esModule: true,
  default: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));
jest.mock('@/lib/hooks/useAuth', () => ({ useAuth: () => auth }));
jest.mock('@/lib/hooks/useRestaurants', () => ({
  useRestaurants: (f: unknown, o?: { enabled?: boolean }) => restaurants(f, o),
}));
jest.mock('@/lib/hooks/usePrivatizationIncidents', () => ({
  useOpenIncidentCount: (e: boolean) => openIncidentCount(e),
}));

beforeEach(() => {
  openIncidentCount.mockClear();
  restaurants.mockClear();
  Object.assign(auth, { isAdmin: true, sessionValid: true });
});

describe('Sidebar : badges et session', () => {
  it('page de connexion : aucune requête', () => {
    pathname = '/auth/login';
    render(<Sidebar />);
    expect(openIncidentCount).toHaveBeenLastCalledWith(false);
    expect(restaurants.mock.calls.at(-1)?.[1]).toEqual({ enabled: false });
  });

  it('session admin expirée : aucune requête', () => {
    pathname = '/';
    auth.sessionValid = false;
    render(<Sidebar />);
    expect(openIncidentCount).toHaveBeenLastCalledWith(false);
    expect(restaurants.mock.calls.at(-1)?.[1]).toEqual({ enabled: false });
  });

  it('pas admin : aucune requête', () => {
    pathname = '/';
    auth.isAdmin = false;
    render(<Sidebar />);
    expect(openIncidentCount).toHaveBeenLastCalledWith(false);
  });

  it('session valide : badges chargés', () => {
    pathname = '/';
    render(<Sidebar />);
    expect(openIncidentCount).toHaveBeenLastCalledWith(true);
    expect(restaurants.mock.calls.at(-1)?.[1]).toEqual({ enabled: true });
  });
});
