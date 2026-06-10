'use client';

export const dynamic = 'force-dynamic';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { TotpSecret, EmailAuthProvider, reauthenticateWithCredential, getMultiFactorResolver } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { useAuth } from '@/lib/hooks/useAuth';
import { generateTOTPSecret, enrollTOTP } from '@/lib/mfa/utils';
import { storeMfaResolver } from '@/lib/mfa/resolver-store';

type Step = 'reauth' | 'qr' | 'done';

export default function MFAEnrollmentPage() {
  const router = useRouter();
  const { user, loading } = useAuth();
  const [step, setStep] = useState<Step>('reauth');
  const [password, setPassword] = useState('');
  const [reauthenticating, setReauthenticating] = useState(false);
  const [qrCodeUrl, setQrCodeUrl] = useState('');
  const [totpSecret, setTotpSecret] = useState<TotpSecret | null>(null);
  const [verificationCode, setVerificationCode] = useState('');
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState('');
  const [verifying, setVerifying] = useState(false);
  const generated = useRef(false);

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.push('/auth/login');
    }
  }, [user, loading, router]);

  const handleReauth = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.email) return;
    setReauthenticating(true);
    setError('');

    try {
      const credential = EmailAuthProvider.credential(user.email, password);
      await reauthenticateWithCredential(user, credential);

      // Reauthentication successful, now generate TOTP
      setGenerating(true);
      setStep('qr');
      generated.current = false;

      const { secret, qrCodeUrl } = await generateTOTPSecret(user);
      setTotpSecret(secret);
      setQrCodeUrl(qrCodeUrl);
    } catch (err: any) {
      if (err?.code === 'auth/multi-factor-auth-required') {
        // User already has MFA enrolled — redirect to challenge instead
        const resolver = getMultiFactorResolver(auth, err);
        storeMfaResolver(resolver, user.email || '');
        router.push('/auth/mfa-challenge');
        return;
      }
      setError(err instanceof Error ? err.message : 'Erreur de ré-authentification');
    } finally {
      setReauthenticating(false);
      setGenerating(false);
    }
  };

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setVerifying(true);
    setError('');

    try {
      if (!totpSecret) {
        setError('Secret TOTP manquant, rechargez la page');
        setVerifying(false);
        return;
      }

      if (!verificationCode || verificationCode.length !== 6) {
        setError('Code invalide (6 chiffres requis)');
        setVerifying(false);
        return;
      }

      await enrollTOTP(user!, totpSecret, verificationCode);

      // Enrollment successful — start session and redirect
      localStorage.setItem('adminSessionStart', Date.now().toString());
      router.push('/');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur de vérification');
      setVerifying(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          <p className="mt-4 text-gray-700">Chargement...</p>
        </div>
      </div>
    );
  }

  // Step 1: Re-authenticate
  if (step === 'reauth') {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="w-full max-w-md p-8 bg-white rounded-lg shadow-lg">
          <h1 className="text-2xl font-bold text-center mb-2 text-gray-900">
            Confirmer votre identité
          </h1>
          <p className="text-center text-gray-600 mb-6 text-sm">
            Pour activer le MFA, confirmez votre mot de passe
          </p>
          <p className="text-center text-sm font-medium text-gray-700 mb-6 bg-gray-50 py-2 px-4 rounded">
            {user?.email}
          </p>

          <form onSubmit={handleReauth} className="space-y-6">
            <input
              type="email"
              autoComplete="username"
              value={user?.email || ''}
              readOnly
              className="hidden"
              aria-hidden="true"
            />
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
                placeholder="••••••••"
                required
                autoFocus
                disabled={reauthenticating}
              />
            </div>

            {error && (
              <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={reauthenticating || !password}
              className="w-full py-2 px-4 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {reauthenticating ? 'Vérification...' : 'Continuer'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  // Step 2: Show QR and verify code
  if (generating) {
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
          Scannez le QR code avec votre application authenticatrice
        </p>

        {qrCodeUrl && (
          <div className="text-center mb-8">
            <div className="mb-4 bg-gray-100 p-4 rounded-lg inline-block">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={qrCodeUrl} alt="QR Code TOTP" className="w-64 h-64" />
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
            disabled={verifying || !verificationCode || !totpSecret}
            className="w-full py-2 px-4 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {verifying ? 'Vérification...' : 'Activer MFA'}
          </button>
        </form>
      </div>
    </div>
  );
}
