import { TrendingUp, TrendingDown } from 'lucide-react';

const colorClasses = {
  cyan: {
    icon: 'text-cyan-400 bg-cyan-500/10 border-cyan-500/20',
    glow: 'glow-cyan',
  },
  red: {
    icon: 'text-red-400 bg-red-500/10 border-red-500/20',
    glow: 'glow-red',
  },
  amber: {
    icon: 'text-amber-400 bg-amber-500/10 border-amber-500/20',
    glow: 'glow-amber',
  },
  green: {
    icon: 'text-green-400 bg-green-500/10 border-green-500/20',
    glow: 'glow-green',
  },
  purple: {
    icon: 'text-purple-400 bg-purple-500/10 border-purple-500/20',
    glow: '',
  },
};

export default function StatCard({ icon: Icon, label, value, color = 'cyan', trend }) {
  const colors = colorClasses[color] || colorClasses.cyan;

  return (
    <div
      className={`bg-gray-900 border border-gray-800 rounded-xl p-4 hover:border-gray-700 transition-all duration-300 ${colors.glow}`}
    >
      <div className="flex items-start justify-between">
        <div
          className={`w-10 h-10 rounded-lg border flex items-center justify-center ${colors.icon}`}
        >
          <Icon className="w-5 h-5" />
        </div>
        {trend && (
          <div
            className={`flex items-center gap-1 text-xs font-medium ${
              trend > 0 ? 'text-red-400' : 'text-green-400'
            }`}
          >
            {trend > 0 ? (
              <TrendingUp className="w-3.5 h-3.5" />
            ) : (
              <TrendingDown className="w-3.5 h-3.5" />
            )}
            <span>{Math.abs(trend)}%</span>
          </div>
        )}
      </div>
      <div className="mt-3">
        <p className="text-2xl font-bold text-white tracking-tight">
          {value ?? '--'}
        </p>
        <p className="text-xs text-gray-400 mt-1 uppercase tracking-wide">
          {label}
        </p>
      </div>
    </div>
  );
}
