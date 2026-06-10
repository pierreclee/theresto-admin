const roleLabels: Record<string, string> = {
  customer: 'Client',
  restaurateur: 'Restaurateur',
  cook: 'Cuisinier',
  server: 'Serveur',
  barman: 'Barman',
};

export function RoleBadge({ role }: { role: string }) {
  const label = roleLabels[role] ?? role;
  const isStaff = role !== 'customer';
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${
      isStaff
        ? 'bg-blue-50 text-blue-700 border-blue-100'
        : 'bg-gray-50 text-gray-600 border-gray-100'
    }`}>
      {label}
    </span>
  );
}
