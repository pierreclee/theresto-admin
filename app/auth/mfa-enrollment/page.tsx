'use client';

export const dynamic = 'force-dynamic';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/hooks/useAuth';
import { generateTOTPSecret } from '@/lib/mfa/utils';

export default function MFAEnrollmentPage() {
  const router = useRouter();
  const { user, loading } = useAuth();
  const [qrCode, setQrCode] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [generating, setGenerating] = useState(true);
  const [error, setError] = useState('');
  const [verifying, setVerifying] = useState(false);

  useEffect(() => {
    if (loading) return;

    if (!user) {
      router.push('/auth/login');
      return;
    }

    const generateQR = async () => {
      try {
        const { qrCodeUrl } = await generateTOTPSecret();
        setQrCode(qrCodeUrl);
      } catch {
        setError('Erreur lors de la génération du code QR');
      } finally {
        setGenerating(false);
      }
    };

    generateQR();
  }, [user, loading, router]);

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setVerifying(true);
    setError('');

    try {
      if (!verificationCode || verificationCode.length !== 6) {
        setError('Code invalide (6 chiffres requis)');
        setVerifying(false);
        return;
      }

      // TODO: Call Cloud Function to verify and enroll MFA
      // For now, just proceed to challenge
      router.push('/auth/mfa-challenge');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur de vérification');
      setVerifying(false);
    }
  };

  if (loading || generating) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          <p className="mt-4 text-gray-700">Génération du code QR...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-50">
      <div className="w-full max-w-md p-8 bg-white rounded-lg shadow-lg">
        <h1 className="text-2xl font-bold text-center mb-2 text-gray-900">
          Configurer l&apos;authentification MFA
        </h1>
        <p className="text-center text-gray-600 mb-6 text-sm">
          Authentification à deux facteurs pour sécuriser votre compte
        </p>

        {qrCode && (
          <div className="text-center mb-8">
            <div className="mb-4 bg-gray-100 p-4 rounded-lg inline-block">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={qrCode} alt="QR Code" className="w-64 h-64" />
            </div>
            <p className="text-sm text-gray-600">
              Scannez ce code avec votre application authenticatrice
              <br />
              (Google Authenticator, Authy, Microsoft Authenticator, etc.)
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
            disabled={verifying || !verificationCode}
            className="w-full py-2 px-4 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {verifying ? 'Vérification...' : 'Activer MFA'}
          </button>
        </form>

        <p className="text-xs text-gray-500 text-center mt-6">
          Conservez votre code de secours dans un endroit sûr pour accéder à votre compte en cas de perte d&apos;accès à l&apos;authenticateur.
        </p>
      </div>
    </div>
  );
}
