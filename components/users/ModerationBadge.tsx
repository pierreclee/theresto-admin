import type { ModerationStatus } from '@/lib/types/user';

const config: Record<ModerationStatus, { label: string; className: string }> = {
  active: { label: 'Actif', className: 'bg-green-50 text-green-700 border-green-100' },
  suspended: { label: 'Suspendu', className: 'bg-orange-50 text-orange-700 border-orange-100' },
  banned: { label: 'Banni', className: 'bg-red-50 text-red-700 border-red-100' },
};

export function ModerationBadge({ status }: { status: ModerationStatus }) {
  const { label, className } = config[status] ?? config.active;
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${className}`}>
      {label}
    </span>
  );
}
