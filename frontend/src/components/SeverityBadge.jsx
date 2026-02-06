const severityStyles = {
  critical: 'bg-red-500/15 text-red-400 border-red-500/30',
  high: 'bg-orange-500/15 text-orange-400 border-orange-500/30',
  medium: 'bg-yellow-500/15 text-yellow-400 border-yellow-500/30',
  low: 'bg-green-500/15 text-green-400 border-green-500/30',
  info: 'bg-blue-500/15 text-blue-400 border-blue-500/30',
};

const statusStyles = {
  new: 'bg-blue-500/15 text-blue-400 border-blue-500/30',
  acknowledged: 'bg-purple-500/15 text-purple-400 border-purple-500/30',
  in_progress: 'bg-yellow-500/15 text-yellow-400 border-yellow-500/30',
  resolved: 'bg-green-500/15 text-green-400 border-green-500/30',
};

const statusLabels = {
  new: 'New',
  acknowledged: 'Acknowledged',
  in_progress: 'In Progress',
  resolved: 'Resolved',
};

export default function SeverityBadge({ severity, status, size = 'sm' }) {
  const isStatus = !!status;
  const key = isStatus ? status : severity?.toLowerCase();
  const styles = isStatus ? statusStyles : severityStyles;
  const label = isStatus ? statusLabels[key] || key : key;

  const sizeClasses =
    size === 'xs'
      ? 'text-[10px] px-1.5 py-0.5'
      : 'text-xs px-2 py-0.5';

  return (
    <span
      className={`inline-flex items-center rounded-md border font-medium capitalize ${sizeClasses} ${
        styles[key] || 'bg-gray-500/15 text-gray-400 border-gray-500/30'
      }`}
    >
      {label}
    </span>
  );
}
