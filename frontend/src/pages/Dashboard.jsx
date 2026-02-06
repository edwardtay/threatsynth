import { useState, useEffect } from 'react';
import {
  Server,
  ShieldAlert,
  AlertTriangle,
  Flame,
  FileText,
  CheckCircle2,
  Zap,
  RefreshCw,
  Radar,
  ChevronRight,
} from 'lucide-react';
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip } from 'recharts';
import { useNavigate } from 'react-router-dom';
import StatCard from '../components/StatCard';
import SeverityBadge from '../components/SeverityBadge';
import Spinner, { FullPageSpinner } from '../components/Spinner';
import { useToast } from '../components/ToastContext';
import {
  getDashboardStats,
  getDashboardRecent,
  ingestAllThreats,
  generateBriefings,
  scanAssets,
} from '../services/api';
import { mockStats, mockRecent } from '../services/mockData';

const SEVERITY_COLORS = {
  critical: '#ef4444',
  high: '#f97316',
  medium: '#eab308',
  low: '#22c55e',
};

function PriorityIndicator({ score }) {
  const color =
    score > 8
      ? 'text-red-400 bg-red-500/15 border-red-500/30'
      : score > 5
        ? 'text-orange-400 bg-orange-500/15 border-orange-500/30'
        : 'text-yellow-400 bg-yellow-500/15 border-yellow-500/30';

  return (
    <div
      className={`w-11 h-11 rounded-lg border flex items-center justify-center font-mono font-bold text-sm ${color}`}
    >
      {score?.toFixed(1) ?? '--'}
    </div>
  );
}

export default function Dashboard() {
  const [stats, setStats] = useState(null);
  const [recent, setRecent] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState({});
  const [scanTarget, setScanTarget] = useState('');
  const { addToast } = useToast();
  const navigate = useNavigate();

  const fetchData = async () => {
    try {
      const [statsRes, recentRes] = await Promise.all([
        getDashboardStats(),
        getDashboardRecent(),
      ]);
      setStats(statsRes.data);
      setRecent(Array.isArray(recentRes.data) ? recentRes.data : []);
    } catch (err) {
      // Fallback to demo data when backend is unavailable
      setStats(mockStats);
      setRecent(mockRecent);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleAction = async (key, action, successMsg) => {
    setActionLoading((prev) => ({ ...prev, [key]: true }));
    try {
      await action();
      addToast(successMsg, 'success');
      fetchData();
    } catch (err) {
      addToast(err.response?.data?.detail || `Action failed: ${key}`, 'error');
    } finally {
      setActionLoading((prev) => ({ ...prev, [key]: false }));
    }
  };

  if (loading) return <FullPageSpinner message="Loading dashboard..." />;

  // Build severity distribution for pie chart from stats
  const severityData = [];
  if (stats?.severity_breakdown) {
    Object.entries(stats.severity_breakdown).forEach(([name, value]) => {
      if (value > 0) severityData.push({ name, value });
    });
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Dashboard</h1>
          <p className="text-sm text-gray-400 mt-1">
            Autonomous threat intelligence overview
          </p>
        </div>
        <button
          onClick={fetchData}
          className="flex items-center gap-2 px-3 py-2 text-sm text-gray-400 hover:text-white bg-gray-800 hover:bg-gray-700 rounded-lg border border-gray-700 transition-all"
        >
          <RefreshCw className="w-4 h-4" />
          Refresh
        </button>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <StatCard
          icon={Server}
          label="Total Assets"
          value={stats?.total_assets}
          color="cyan"
        />
        <StatCard
          icon={ShieldAlert}
          label="Total Threats"
          value={stats?.total_threats}
          color="amber"
        />
        <StatCard
          icon={AlertTriangle}
          label="Critical Threats"
          value={stats?.critical_threats}
          color="red"
        />
        <StatCard
          icon={Flame}
          label="Active Exploits"
          value={stats?.active_exploits}
          color="red"
        />
        <StatCard
          icon={FileText}
          label="Pending Briefings"
          value={stats?.pending_briefings}
          color="amber"
        />
        <StatCard
          icon={CheckCircle2}
          label="Resolved"
          value={stats?.resolved_briefings}
          color="green"
        />
      </div>

      {/* Middle Section: Recent Briefings + Chart */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Briefings */}
        <div className="lg:col-span-2 bg-gray-900 border border-gray-800 rounded-xl">
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-800">
            <h2 className="text-sm font-semibold text-white uppercase tracking-wide">
              Recent High-Priority Briefings
            </h2>
            <button
              onClick={() => navigate('/briefings')}
              className="text-xs text-cyan-400 hover:text-cyan-300 flex items-center gap-1 transition-colors"
            >
              View All <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
          <div className="divide-y divide-gray-800">
            {recent.length === 0 ? (
              <div className="px-5 py-10 text-center text-gray-500 text-sm">
                No recent briefings. Generate briefings to see results.
              </div>
            ) : (
              recent.slice(0, 6).map((briefing, idx) => (
                <div
                  key={briefing.id || idx}
                  className="flex items-start gap-4 px-5 py-3.5 hover:bg-gray-800/40 transition-colors cursor-pointer"
                  onClick={() => navigate('/briefings')}
                >
                  <PriorityIndicator score={briefing.priority_score} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-gray-200 line-clamp-1">
                      {briefing.summary || 'No summary available'}
                    </p>
                    <div className="flex items-center gap-2 mt-1.5">
                      {briefing.threat?.severity && (
                        <SeverityBadge severity={briefing.threat.severity} size="xs" />
                      )}
                      {briefing.asset?.name && (
                        <span className="text-[10px] font-mono text-gray-500">
                          {briefing.asset.name}
                        </span>
                      )}
                    </div>
                  </div>
                  <SeverityBadge status={briefing.status || 'new'} size="xs" />
                </div>
              ))
            )}
          </div>
        </div>

        {/* Severity Distribution Chart */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
          <h2 className="text-sm font-semibold text-white uppercase tracking-wide mb-4">
            Threat Severity Distribution
          </h2>
          {severityData.length > 0 ? (
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie
                  data={severityData}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={80}
                  paddingAngle={3}
                  dataKey="value"
                  stroke="none"
                >
                  {severityData.map((entry, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={SEVERITY_COLORS[entry.name] || '#6b7280'}
                    />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#1f2937',
                    border: '1px solid #374151',
                    borderRadius: '8px',
                    color: '#e5e7eb',
                    fontSize: '12px',
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-[200px] text-gray-500 text-sm">
              No data available
            </div>
          )}
          <div className="flex flex-wrap gap-3 mt-4 justify-center">
            {Object.entries(SEVERITY_COLORS).map(([key, color]) => (
              <div key={key} className="flex items-center gap-1.5">
                <div
                  className="w-2.5 h-2.5 rounded-full"
                  style={{ backgroundColor: color }}
                />
                <span className="text-[10px] text-gray-400 capitalize">{key}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Source Breakdown */}
      {stats?.source_breakdown && Object.values(stats.source_breakdown).some(v => v > 0) && (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
          <h2 className="text-sm font-semibold text-white uppercase tracking-wide mb-4">
            Threat Intelligence Sources
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            {Object.entries(stats.source_breakdown).map(([src, count]) => {
              const colors = {
                nvd: 'border-blue-500/30 text-blue-400',
                cisa_kev: 'border-red-500/30 text-red-400',
                exploitdb: 'border-orange-500/30 text-orange-400',
                github: 'border-purple-500/30 text-purple-400',
                shodan: 'border-cyan-500/30 text-cyan-400',
                greynoise: 'border-green-500/30 text-green-400',
              };
              const labels = {
                nvd: 'NVD', cisa_kev: 'CISA KEV', exploitdb: 'ExploitDB',
                github: 'GitHub', shodan: 'Shodan', greynoise: 'GreyNoise',
              };
              return (
                <div key={src} className={`bg-gray-800/50 border rounded-lg p-3 text-center ${colors[src] || 'border-gray-700 text-gray-400'}`}>
                  <p className="text-2xl font-bold">{count}</p>
                  <p className="text-[10px] uppercase tracking-wider mt-1 opacity-70">{labels[src] || src}</p>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Quick Actions Bar */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
        <h2 className="text-sm font-semibold text-white uppercase tracking-wide mb-4">
          Quick Actions
        </h2>
        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={() =>
              handleAction('ingest', ingestAllThreats, 'Threat ingestion started successfully')
            }
            disabled={actionLoading.ingest}
            className="flex items-center gap-2 px-4 py-2.5 bg-cyan-500/10 text-cyan-400 border border-cyan-500/30 rounded-lg text-sm font-medium hover:bg-cyan-500/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {actionLoading.ingest ? (
              <Spinner size="sm" />
            ) : (
              <Zap className="w-4 h-4" />
            )}
            Ingest Threats
          </button>

          <button
            onClick={() =>
              handleAction(
                'generate',
                generateBriefings,
                'Briefing generation started successfully'
              )
            }
            disabled={actionLoading.generate}
            className="flex items-center gap-2 px-4 py-2.5 bg-purple-500/10 text-purple-400 border border-purple-500/30 rounded-lg text-sm font-medium hover:bg-purple-500/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {actionLoading.generate ? (
              <Spinner size="sm" />
            ) : (
              <FileText className="w-4 h-4" />
            )}
            Generate Briefings
          </button>

          <div className="flex items-center gap-2">
            <input
              type="text"
              placeholder="192.168.1.0/24"
              value={scanTarget}
              onChange={(e) => setScanTarget(e.target.value)}
              className="px-3 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-sm font-mono text-gray-200 placeholder-gray-500 focus:outline-none focus:border-cyan-500/50 w-48"
            />
            <button
              onClick={() => {
                if (!scanTarget.trim()) {
                  addToast('Enter a target IP or range', 'warning');
                  return;
                }
                handleAction(
                  'scan',
                  () => scanAssets(scanTarget),
                  'Network scan initiated successfully'
                );
              }}
              disabled={actionLoading.scan}
              className="flex items-center gap-2 px-4 py-2.5 bg-amber-500/10 text-amber-400 border border-amber-500/30 rounded-lg text-sm font-medium hover:bg-amber-500/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {actionLoading.scan ? (
                <Spinner size="sm" />
              ) : (
                <Radar className="w-4 h-4" />
              )}
              Scan Network
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
