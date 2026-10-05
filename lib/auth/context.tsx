'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { User } from '@supabase/supabase-js';
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
    if (!mounted) return;

    const supabase = createClient();

    const handleUser = async (supabaseUser: User | null) => {
      if (supabaseUser) {
        const isAdmin = supabaseUser.app_metadata?.admin === true;
        
        const { data: mfaData, error: mfaError } = await supabase.auth.mfa.listFactors();
        const hasMfaActual = !mfaError && (mfaData?.totp?.length > 0 || mfaData?.all?.length > 0);
        
        const hasMfaClaim = supabaseUser.app_metadata?.mfaEnrolled === true;
        const hasMfaVerified = localStorage.getItem('mfaVerified') === 'true';
        const hasMfa = hasMfaClaim || hasMfaActual || hasMfaVerified;

        setAdminUser({
          uid: supabaseUser.id,
          email: supabaseUser.email || '',
          displayName: supabaseUser.user_metadata?.displayName || undefined,
          admin: isAdmin,
          mfaEnrolled: hasMfa,
        });

        if (isAdmin && hasMfa) {
          const sessionStart = localStorage.getItem('adminSessionStart');
          const isValid = sessionStart
            ? Date.now() - parseInt(sessionStart) < 2 * 60 * 60 * 1000
            : false;
          setSessionValid(isValid);
        } else {
          setSessionValid(false);
        }
      } else {
        setAdminUser(null);
        setSessionValid(false);
        localStorage.removeItem('adminSessionStart');
        localStorage.removeItem('mfaVerified');
      }

      setUser(supabaseUser);
      setLoading(false);
    };

    const initializeAuth = async () => {
      try {
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        if (sessionError) throw sessionError;
        
        await handleUser(session?.user || null);

        const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
          await handleUser(session?.user || null);
        });

        return subscription;
      } catch (err) {
        setError(err instanceof Error ? err : new Error('Auth error'));
        setLoading(false);
      }
    };

    let authSubscription: { unsubscribe: () => void } | undefined;
    
    initializeAuth().then(sub => {
      if (sub) authSubscription = sub;
    });

    return () => {
      if (authSubscription) {
        authSubscription.unsubscribe();
      }
    };
  }, [mounted]);

  const signOut = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    localStorage.removeItem('adminSessionStart');
    localStorage.removeItem('mfaVerified');
  };

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
