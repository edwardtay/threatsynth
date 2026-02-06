import { Loader2 } from 'lucide-react';

export default function Spinner({ size = 'md', className = '' }) {
  const sizeClasses = {
    sm: 'w-4 h-4',
    md: 'w-6 h-6',
    lg: 'w-10 h-10',
  };

  return (
    <Loader2
      className={`spinner text-cyan-400 ${sizeClasses[size] || sizeClasses.md} ${className}`}
    />
  );
}

export function FullPageSpinner({ message = 'Loading...' }) {
  return (
    <div className="flex flex-col items-center justify-center py-20">
      <Spinner size="lg" />
      <p className="text-sm text-gray-400 mt-4">{message}</p>
    </div>
  );
}
