'use client';

export const dynamic = 'force-dynamic';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/lib/hooks/useAuth';

export default function MFAEnrollmentPage() {
  const router = useRouter();
  const { user, loading } = useAuth();
  const [qrCodeUrl, setQrCodeUrl] = useState('');
  const [factorId, setFactorId] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [error, setError] = useState('');
  const [verifying, setVerifying] = useState(false);
  const supabase = createClient();

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.push('/auth/login');
      return;
    }

    const initEnrollment = async () => {
      try {
        const { data, error: enrollError } = await supabase.auth.mfa.enroll({ factorType: 'totp' });
        if (enrollError) throw enrollError;
        
        setFactorId(data.id);
        setQrCodeUrl(data.totp.qr_code);
      } catch (err: any) {
        setError(err.message || 'Erreur d\'initialisation MFA');
      }
    };

    if (!qrCodeUrl && !factorId) {
      initEnrollment();
    }
  }, [user, loading, router, supabase, qrCodeUrl, factorId]);

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setVerifying(true);
    setError('');

    try {
      if (!factorId) {
        setError('Secret TOTP manquant, rechargez la page');
        setVerifying(false);
        return;
      }

      if (!verificationCode || verificationCode.length !== 6) {
        setError('Code invalide (6 chiffres requis)');
        setVerifying(false);
        return;
      }

      const { data: challengeData, error: challengeError } = await supabase.auth.mfa.challenge({ factorId });
      if (challengeError) throw challengeError;

      const { error: verifyError } = await supabase.auth.mfa.verify({
        factorId,
        challengeId: challengeData.id,
        code: verificationCode
      });
      if (verifyError) throw verifyError;

      localStorage.setItem('adminSessionStart', Date.now().toString());
      localStorage.setItem('mfaVerified', 'true');
      router.push('/');
    } catch (err: any) {
      setError(err.message || 'Erreur de vérification');
      setVerifying(false);
    }
  };

  if (loading || (!qrCodeUrl && !error)) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          <p className="mt-4 text-gray-700">Préparation de l'enrôlement...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-50">
      <div className="w-full max-w-md p-8 bg-white rounded-lg shadow-lg">
        <h1 className="text-2xl font-bold text-center mb-2 text-gray-900">
          Configurer l'authentification MFA
        </h1>
        <p className="text-center text-gray-600 mb-6 text-sm">
          Scannez le QR code avec votre application authenticatrice
        </p>

        {qrCodeUrl && (
          <div className="text-center mb-8">
            <div className="mb-4 bg-gray-100 p-4 rounded-lg inline-block">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={qrCodeUrl} alt="QR Code TOTP" className="w-64 h-64 mx-auto" />
            </div>
            <p className="text-sm text-gray-600">
              Google Authenticator, Authy, Microsoft Authenticator...
            </p>
          </div>
        )}

        <form onSubmit={handleVerify} className="space-y-6">
          <div>
            <label htmlFor="code" className="block text-sm font-medium text-gray-700 mb-2">
              Code de vérification (6 chiffres)
            </label>
            <input
              type="text"
              id="code"
              maxLength={6}
              value={verificationCode}
              onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, ''))}
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
            disabled={verifying || verificationCode.length !== 6 || !factorId}
            className="w-full py-2 px-4 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {verifying ? 'Vérification...' : 'Activer MFA'}
          </button>
        </form>
      </div>
    </div>
  );
}
