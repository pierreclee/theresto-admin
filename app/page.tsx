'use client';

export default function DashboardPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Tableau de bord</h1>
        <p className="text-gray-600 mt-2">Bienvenue sur le panneau d&apos;administration TheResto</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white p-6 rounded-lg shadow hover:shadow-lg transition-shadow">
          <h3 className="text-gray-600 text-sm font-semibold">Restaurants</h3>
          <p className="text-3xl font-bold text-blue-600 mt-2">-</p>
          <p className="text-xs text-gray-500 mt-2">Restaurants actifs</p>
        </div>

        <div className="bg-white p-6 rounded-lg shadow hover:shadow-lg transition-shadow">
          <h3 className="text-gray-600 text-sm font-semibold">En attente</h3>
          <p className="text-3xl font-bold text-yellow-600 mt-2">-</p>
          <p className="text-xs text-gray-500 mt-2">Restaurants en attente</p>
        </div>

        <div className="bg-white p-6 rounded-lg shadow hover:shadow-lg transition-shadow">
          <h3 className="text-gray-600 text-sm font-semibold">Premium</h3>
          <p className="text-3xl font-bold text-green-600 mt-2">-</p>
          <p className="text-xs text-gray-500 mt-2">Abonnements premium</p>
        </div>

        <div className="bg-white p-6 rounded-lg shadow hover:shadow-lg transition-shadow">
          <h3 className="text-gray-600 text-sm font-semibold">Revenu (MTD)</h3>
          <p className="text-3xl font-bold text-purple-600 mt-2">-</p>
          <p className="text-xs text-gray-500 mt-2">Mois en cours</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white p-6 rounded-lg shadow">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Activité récente</h2>
          <div className="space-y-3">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="flex items-center justify-between py-3 border-b border-gray-100 last:border-b-0">
                <div>
                  <p className="text-sm font-medium text-gray-900">Événement {i}</p>
                  <p className="text-xs text-gray-500">Il y a quelques minutes</p>
                </div>
                <span className="text-xs font-semibold text-gray-500">Détails</span>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Statistiques</h2>
          <div className="space-y-4">
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span className="text-gray-600">Taux de conversion</span>
                <span className="text-gray-900 font-semibold">-</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div className="bg-blue-600 h-2 rounded-full" style={{ width: '0%' }}></div>
              </div>
            </div>
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span className="text-gray-600">Utilisation API</span>
                <span className="text-gray-900 font-semibold">-</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div className="bg-green-600 h-2 rounded-full" style={{ width: '0%' }}></div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
