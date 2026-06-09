interface BadgeProps {
  label: string;
  variant?: 'primary' | 'success' | 'warning' | 'error' | 'gray';
  size?: 'sm' | 'md';
}

const variantMap = {
  primary: 'bg-blue-100 text-blue-800',
  success: 'bg-green-100 text-green-800',
  warning: 'bg-yellow-100 text-yellow-800',
  error: 'bg-red-100 text-red-800',
  gray: 'bg-gray-100 text-gray-800',
};

const sizeMap = {
  sm: 'px-2 py-1 text-xs',
  md: 'px-3 py-1 text-sm',
};

export function Badge({ label, variant = 'gray', size = 'md' }: BadgeProps) {
  return (
    <span className={`inline-block rounded-full font-medium ${variantMap[variant]} ${sizeMap[size]}`}>
      {label}
    </span>
  );
}
