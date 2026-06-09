'use client';

export const dynamic = 'force-dynamic';

import { useRouter } from 'next/navigation';

export default function AccessDeniedPage() {
  const router = useRouter();

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-50">
      <div className="w-full max-w-md p-8 bg-white rounded-lg shadow-lg text-center">
        <div className="mb-4">
          <div className="text-6xl mb-4">🔒</div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Accès refusé</h1>
          <p className="text-gray-600">
            Vous n&apos;avez pas les permissions pour accéder à la plateforme d&apos;administration.
          </p>
        </div>

        <div className="mt-8 space-y-3">
          <button
            onClick={() => router.push('/auth/login')}
            className="w-full py-2 px-4 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition-colors"
          >
            Retour à la connexion
          </button>
          <button
            onClick={() => router.back()}
            className="w-full py-2 px-4 bg-gray-200 text-gray-700 font-semibold rounded-lg hover:bg-gray-300 transition-colors"
          >
            Retour
          </button>
        </div>

        <p className="text-xs text-gray-500 mt-6">
          Si vous pensez qu&apos;il y a une erreur, veuillez contacter un administrateur système.
        </p>
      </div>
    </div>
  );
}
