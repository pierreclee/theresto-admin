'use client';

export const dynamic = 'force-dynamic';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { MultiFactorResolver } from 'firebase/auth';
import { verifyTOTPCode } from '@/lib/mfa/utils';
import { getMfaResolver, clearMfaResolver } from '@/lib/mfa/resolver-store';

export default function MFAChallengePage() {
  const router = useRouter();
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [resolver, setResolver] = useState<MultiFactorResolver | null>(null);

  // Retrieve MFA resolver from previous login attempt
  useEffect(() => {
    const { resolver: storedResolver } = getMfaResolver();

    if (!storedResolver) {
      router.push('/auth/login');
      return;
    }

    setResolver(storedResolver);
  }, [router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setVerifying(true);

    try {
      if (!resolver) {
        setError('Session MFA expirée, veuillez vous reconnecter');
        setVerifying(false);
        return;
      }

      if (!code || code.length !== 6) {
        setError('Code invalide (6 chiffres requis)');
        setVerifying(false);
        return;
      }

      // Set mfaVerified before resolveSignIn so onAuthStateChanged reads it immediately
      localStorage.setItem('mfaVerified', 'true');
      localStorage.setItem('adminSessionStart', Date.now().toString());

      let userCredential;
      try {
        userCredential = await verifyTOTPCode(resolver, code);
      } catch (verifyErr) {
        // Verification failed — clear optimistic flags
        localStorage.removeItem('mfaVerified');
        localStorage.removeItem('adminSessionStart');
        throw verifyErr;
      }

      // Verify admin claim
      const idTokenResult = await userCredential.user.getIdTokenResult(true);
      if (idTokenResult.claims.admin !== true) {
        localStorage.removeItem('mfaVerified');
        localStorage.removeItem('adminSessionStart');
        setError('Accès administrateur requis');
        setVerifying(false);
        return;
      }

      clearMfaResolver();

      router.push('/');
    } catch (err) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('Erreur de vérification MFA');
      }
      setVerifying(false);
    }
  };

  if (!resolver) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          <p className="mt-4 text-gray-700">Chargement de la vérification MFA...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-50">
      <div className="w-full max-w-md p-8 bg-white rounded-lg shadow-lg">
        <h1 className="text-2xl font-bold text-center mb-2 text-gray-900">Vérification MFA</h1>
        <p className="text-center text-gray-600 mb-8">
          Entrez le code de votre application authenticatrice
        </p>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label htmlFor="code" className="block text-sm font-medium text-gray-700 mb-2">
              Code de vérification (6 chiffres)
            </label>
            <input
              type="text"
              id="code"
              maxLength={6}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg text-center text-2xl tracking-widest focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono"
              placeholder="000000"
              autoFocus
              required
              disabled={verifying}
            />
          </div>

          {error && (
            <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={verifying || !code}
            className="w-full py-2 px-4 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {verifying ? 'Vérification...' : 'Vérifier'}
          </button>
        </form>

        <div className="mt-6 pt-6 border-t border-gray-200">
          <button
            onClick={() => router.push('/auth/login')}
            className="text-center text-sm text-blue-600 hover:text-blue-700 w-full py-2"
          >
            Utiliser un code de secours
          </button>
        </div>
      </div>
    </div>
  );
}
