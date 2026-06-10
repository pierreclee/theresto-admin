'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import { auth } from '@/lib/firebase';
import { onAuthStateChanged, signOut as firebaseSignOut, multiFactor, User } from 'firebase/auth';
import { AuthContextType } from './types';
import { AdminUser } from '@/lib/types/admin';

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [adminUser, setAdminUser] = useState<AdminUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [sessionValid, setSessionValid] = useState(false);

  // Mark as mounted (client-side only)
  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return; // Don't run on server

    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      try {
        if (firebaseUser) {
          const idTokenResult = await firebaseUser.getIdTokenResult(true);
          const isAdmin = idTokenResult.claims.admin === true;
          // Check custom claim, actual Firebase enrollment, or post-challenge flag
          const hasMfaClaim = idTokenResult.claims.mfaEnrolled === true;
          const hasMfaActual = (multiFactor(firebaseUser).enrolledFactors?.length ?? 0) > 0;
          const hasMfaVerified = localStorage.getItem('mfaVerified') === 'true';
          const hasMfa = hasMfaClaim || hasMfaActual || hasMfaVerified;

          setAdminUser({
            uid: firebaseUser.uid,
            email: firebaseUser.email || '',
            displayName: firebaseUser.displayName || undefined,
            admin: isAdmin,
            mfaEnrolled: hasMfa,
          });

          if (isAdmin && hasMfa) {
            const sessionStart = localStorage.getItem('adminSessionStart');
            const isValid = sessionStart
              ? Date.now() - parseInt(sessionStart) < 2 * 60 * 60 * 1000
              : false;
            setSessionValid(isValid);
          }
        } else {
          setAdminUser(null);
          setSessionValid(false);
          localStorage.removeItem('adminSessionStart');
          localStorage.removeItem('mfaVerified');
        }

        setUser(firebaseUser);
      } catch (err) {
        setError(err instanceof Error ? err : new Error('Auth error'));
      } finally {
        setLoading(false);
      }
    });

    return unsubscribe;
  }, [mounted]);

  const signOut = async () => {
    await firebaseSignOut(auth);
    localStorage.removeItem('adminSessionStart');
    localStorage.removeItem('mfaVerified');
  };

  // During SSR, return empty state (will be hydrated on client)
  if (!mounted) {
    return <AuthContext.Provider value={{
      user: null,
      adminUser: null,
      loading: true,
      error: null,
      isAdmin: false,
      hasMfa: false,
      sessionValid: false,
      signOut: async () => {},
    }}>{children}</AuthContext.Provider>;
  }

  const value: AuthContextType = {
    user,
    adminUser,
    loading,
    error,
    isAdmin: adminUser?.admin ?? false,
    hasMfa: adminUser?.mfaEnrolled ?? false,
    sessionValid,
    signOut,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuthContext() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuthContext must be used within AuthProvider');
  }
  return context;
}
