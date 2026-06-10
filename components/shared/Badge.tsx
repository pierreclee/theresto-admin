interface BadgeProps {
  label: string;
  variant?: 'primary' | 'success' | 'warning' | 'error' | 'gray';
  size?: 'sm' | 'md';
}

const variantMap = {
  primary: 'bg-blue-50 text-blue-700 border-blue-100',
  success: 'bg-green-50 text-green-700 border-green-100',
  warning: 'bg-orange-50 text-orange-700 border-orange-100',
  error: 'bg-red-50 text-red-600 border-red-100',
  gray: 'bg-gray-50 text-gray-600 border-gray-100',
};

const sizeMap = {
  sm: 'px-2 py-0.5 text-[10px]',
  md: 'px-2.5 py-1 text-xs',
};

export function Badge({ label, variant = 'gray', size = 'md' }: BadgeProps) {
  return (
    <span className={`inline-flex items-center rounded-md font-semibold border tracking-wide ${variantMap[variant]} ${sizeMap[size]}`}>
      {label}
    </span>
  );
}
