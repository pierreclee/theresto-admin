'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import { auth } from '@/lib/firebase';
import { onAuthStateChanged, signOut as firebaseSignOut, User } from 'firebase/auth';
import { AuthContextType } from './types';
import { AdminUser } from '@/lib/types/admin';

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [adminUser, setAdminUser] = useState<AdminUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [sessionValid, setSessionValid] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      try {
        if (firebaseUser) {
          const idTokenResult = await firebaseUser.getIdTokenResult(true);
          const isAdmin = idTokenResult.claims.admin === true;
          const hasMfa = idTokenResult.claims.mfaEnrolled === true;

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
        }

        setUser(firebaseUser);
      } catch (err) {
        setError(err instanceof Error ? err : new Error('Auth error'));
      } finally {
        setLoading(false);
      }
    });

    return unsubscribe;
  }, []);

  const signOut = async () => {
    await firebaseSignOut(auth);
    localStorage.removeItem('adminSessionStart');
  };

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
