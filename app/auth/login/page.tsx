'use client';

export const dynamic = 'force-dynamic';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { signInWithEmailAndPassword, getMultiFactorResolver } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { LoginFormSchema } from '@/lib/utils/validators';
import { isMFAError, type MFASession } from '@/lib/mfa/utils';
import { storeMfaResolver } from '@/lib/mfa/resolver-store';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const validated = LoginFormSchema.parse({ email, password });

      try {
        // Try to sign in
        const result = await signInWithEmailAndPassword(
          auth,
          validated.email,
          validated.password
        );

        const idTokenResult = await result.user.getIdTokenResult(true);

        if (idTokenResult.claims.admin !== true) {
          setError('Accès administrateur requis');
          setLoading(false);
          return;
        }

        // Successfully authenticated, no MFA required
        localStorage.setItem('adminSessionStart', Date.now().toString());
        router.push('/');
      } catch (signInError: any) {
        console.log('Sign-in error:', signInError);
        console.log('Error code:', signInError.code);
        console.log('Is MFA error?', isMFAError(signInError));

        // Check if MFA is required
        if (isMFAError(signInError)) {
          console.log('MFA required, redirecting...');

          try {
            // Get the resolver using Firebase's proper function
            const resolver = getMultiFactorResolver(auth, signInError);
            console.log('Resolver obtained:', !!resolver);

            // Store MFA session for the challenge page
            storeMfaResolver(resolver, validated.email);

            console.log('MFA resolver stored, navigating to challenge...');
            router.push('/auth/mfa-challenge');
          } catch (resolverError) {
            console.error('Failed to get MFA resolver:', resolverError);
            setError('Erreur lors de la récupération du résolveur MFA');
            setLoading(false);
          }
        } else {
          // Regular sign-in error
          console.log('Regular error, not MFA');
          if (signInError instanceof Error) {
            setError(signInError.message);
            console.log('Error message:', signInError.message);
          } else {
            setError('Erreur de connexion');
            console.log('Unknown error');
          }
          setLoading(false);
        }
      }
    } catch (err) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('Erreur de validation');
      }
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-50">
      <div className="w-full max-w-md p-8 bg-white rounded-lg shadow-lg">
        <h1 className="text-3xl font-bold text-center mb-2 text-gray-900">Admin TheResto</h1>
        <p className="text-center text-gray-600 mb-8">Plateforme d&apos;administration</p>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
              Email
            </label>
            <input
              type="email"
              id="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="admin@theresto.fr"
              required
              disabled={loading}
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-2">
              Mot de passe
            </label>
            <input
              type="password"
              id="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="&bull;&bull;&bull;&bull;&bull;&bull;&bull;&bull;"
              required
              disabled={loading}
            />
          </div>

          {error && (
            <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2 px-4 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? 'Connexion en cours...' : 'Se connecter'}
          </button>
        </form>
      </div>
    </div>
  );
}
