'use client';

export const dynamic = 'force-dynamic';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

export default function MFAChallengePage() {
  const router = useRouter();
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [verifying, setVerifying] = useState(false);
  const supabase = createClient();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setVerifying(true);

    try {
      if (!code || code.length !== 6) {
        setError('Code invalide (6 chiffres requis)');
        setVerifying(false);
        return;
      }

      // 1. Fetch user's MFA factors
      const { data: mfaData, error: listError } = await supabase.auth.mfa.listFactors();
      if (listError) throw listError;

      const totpFactor = mfaData?.totp?.[0];
      if (!totpFactor) throw new Error('Aucun facteur TOTP configuré pour ce compte');

      // 2. Create a challenge
      const { data: challengeData, error: challengeError } = await supabase.auth.mfa.challenge({ factorId: totpFactor.id });
      if (challengeError) throw challengeError;

      // 3. Verify the code against the challenge
      const { error: verifyError } = await supabase.auth.mfa.verify({
        factorId: totpFactor.id,
        challengeId: challengeData.id,
        code
      });

      if (verifyError) throw verifyError;

      // Ensure flags are updated and proceed
      localStorage.setItem('mfaVerified', 'true');
      localStorage.setItem('adminSessionStart', Date.now().toString());
      
      router.push('/');
    } catch (err: any) {
      setError(err.message || 'Erreur de vérification MFA');
      setVerifying(false);
    }
  };

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
            disabled={verifying || code.length !== 6}
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
            Retourner à la connexion
          </button>
        </div>
      </div>
    </div>
  );
}
