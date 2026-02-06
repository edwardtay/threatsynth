import { useState, useEffect, Fragment } from 'react';
import {
  Filter,
  Zap,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  Bug,
  Flame,
  ShieldAlert,
} from 'lucide-react';
import SeverityBadge from '../components/SeverityBadge';
import Spinner, { FullPageSpinner } from '../components/Spinner';
import { useToast } from '../components/ToastContext';
import { getThreats, ingestAllThreats, ingestThreatSource } from '../services/api';

const SOURCES = [
  { value: 'all', label: 'All Sources' },
  { value: 'nvd', label: 'NVD' },
  { value: 'cisa_kev', label: 'CISA KEV' },
  { value: 'exploitdb', label: 'ExploitDB' },
  { value: 'github', label: 'GitHub' },
  { value: 'shodan', label: 'Shodan' },
  { value: 'greynoise', label: 'GreyNoise' },
];

const SEVERITIES = [
  { value: 'all', label: 'All Severities' },
  { value: 'critical', label: 'Critical' },
  { value: 'high', label: 'High' },
  { value: 'medium', label: 'Medium' },
  { value: 'low', label: 'Low' },
];

const sourceColors = {
  nvd: 'bg-blue-500/15 text-blue-400 border-blue-500/30',
  cisa_kev: 'bg-red-500/15 text-red-400 border-red-500/30',
  exploitdb: 'bg-orange-500/15 text-orange-400 border-orange-500/30',
  github: 'bg-purple-500/15 text-purple-400 border-purple-500/30',
  shodan: 'bg-cyan-500/15 text-cyan-400 border-cyan-500/30',
  greynoise: 'bg-green-500/15 text-green-400 border-green-500/30',
};

const sourceLabels = {
  nvd: 'NVD',
  cisa_kev: 'CISA KEV',
  exploitdb: 'ExploitDB',
  github: 'GitHub',
  shodan: 'Shodan',
  greynoise: 'GreyNoise',
};

export default function Threats() {
  const [threats, setThreats] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sourceFilter, setSourceFilter] = useState('all');
  const [severityFilter, setSeverityFilter] = useState('all');
  const [expandedId, setExpandedId] = useState(null);
  const [ingesting, setIngesting] = useState(false);
  const [ingestingSource, setIngestingSource] = useState(null);
  const { addToast } = useToast();

  const fetchThreats = async () => {
    try {
      const res = await getThreats({
        source: sourceFilter,
        severity: severityFilter,
      });
      setThreats(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      addToast('Failed to load threats', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setLoading(true);
    fetchThreats();
  }, [sourceFilter, severityFilter]);

  const handleIngestAll = async () => {
    setIngesting(true);
    try {
      await ingestAllThreats();
      addToast('All threat feeds ingestion started', 'success');
      setTimeout(() => {
        setLoading(true);
        fetchThreats();
      }, 2000);
    } catch (err) {
      addToast(err.response?.data?.detail || 'Ingestion failed', 'error');
    } finally {
      setIngesting(false);
    }
  };

  const handleIngestSource = async (source) => {
    setIngestingSource(source);
    try {
      await ingestThreatSource(source);
      addToast(`${sourceLabels[source] || source} ingestion started`, 'success');
      setTimeout(() => {
        setLoading(true);
        fetchThreats();
      }, 2000);
    } catch (err) {
      addToast(err.response?.data?.detail || 'Ingestion failed', 'error');
    } finally {
      setIngestingSource(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Threats</h1>
          <p className="text-sm text-gray-400 mt-1">
            {threats.length} threat{threats.length !== 1 ? 's' : ''} tracked
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleIngestAll}
            disabled={ingesting}
            className="flex items-center gap-2 px-4 py-2 bg-cyan-500/10 text-cyan-400 border border-cyan-500/30 rounded-lg text-sm font-medium hover:bg-cyan-500/20 transition-all disabled:opacity-50"
          >
            {ingesting ? <Spinner size="sm" /> : <Zap className="w-4 h-4" />}
            Ingest All
          </button>
          <button
            onClick={() => {
              setLoading(true);
              fetchThreats();
            }}
            className="flex items-center gap-2 px-3 py-2 text-gray-400 hover:text-white bg-gray-800 hover:bg-gray-700 rounded-lg border border-gray-700 transition-all"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
        <div className="flex items-center gap-4 flex-wrap">
          <div className="flex items-center gap-2 text-sm text-gray-400">
            <Filter className="w-4 h-4" />
            <span>Filters:</span>
          </div>

          <select
            value={sourceFilter}
            onChange={(e) => setSourceFilter(e.target.value)}
            className="px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-gray-200 focus:outline-none focus:border-cyan-500/50"
          >
            {SOURCES.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>

          <select
            value={severityFilter}
            onChange={(e) => setSeverityFilter(e.target.value)}
            className="px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-gray-200 focus:outline-none focus:border-cyan-500/50"
          >
            {SEVERITIES.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>

          <div className="ml-auto flex items-center gap-2 flex-wrap">
            <span className="text-xs text-gray-500">Ingest:</span>
            {SOURCES.filter((s) => s.value !== 'all').map((s) => (
              <button
                key={s.value}
                onClick={() => handleIngestSource(s.value)}
                disabled={ingestingSource === s.value}
                className={`text-[10px] px-2 py-1 rounded border font-medium uppercase tracking-wider transition-all disabled:opacity-50 hover:opacity-80 ${
                  sourceColors[s.value] || 'bg-gray-800 text-gray-400 border-gray-700'
                }`}
              >
                {ingestingSource === s.value ? (
                  <Spinner size="sm" className="w-3 h-3" />
                ) : (
                  s.label
                )}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Threats Table */}
      {loading ? (
        <FullPageSpinner message="Loading threats..." />
      ) : (
        <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-800">
                  <th className="px-4 py-3 text-left text-[10px] font-semibold text-gray-400 uppercase tracking-wider w-8" />
                  <th className="px-4 py-3 text-left text-[10px] font-semibold text-gray-400 uppercase tracking-wider">
                    Source
                  </th>
                  <th className="px-4 py-3 text-left text-[10px] font-semibold text-gray-400 uppercase tracking-wider">
                    CVE / ID
                  </th>
                  <th className="px-4 py-3 text-left text-[10px] font-semibold text-gray-400 uppercase tracking-wider">
                    Title
                  </th>
                  <th className="px-4 py-3 text-left text-[10px] font-semibold text-gray-400 uppercase tracking-wider">
                    Severity
                  </th>
                  <th className="px-4 py-3 text-left text-[10px] font-semibold text-gray-400 uppercase tracking-wider">
                    CVSS
                  </th>
                  <th className="px-4 py-3 text-center text-[10px] font-semibold text-gray-400 uppercase tracking-wider">
                    Exploits
                  </th>
                  <th className="px-4 py-3 text-center text-[10px] font-semibold text-gray-400 uppercase tracking-wider">
                    Active
                  </th>
                  <th className="px-4 py-3 text-left text-[10px] font-semibold text-gray-400 uppercase tracking-wider">
                    Date
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800">
                {threats.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="px-5 py-12 text-center text-gray-500 text-sm">
                      <ShieldAlert className="w-8 h-8 mx-auto mb-2 opacity-30" />
                      No threats found. Try ingesting threat feeds.
                    </td>
                  </tr>
                ) : (
                  threats.map((threat) => (
                    <Fragment key={threat.id}>
                      <tr
                        onClick={() =>
                          setExpandedId(expandedId === threat.id ? null : threat.id)
                        }
                        className="hover:bg-gray-800/40 transition-colors cursor-pointer"
                      >
                        <td className="px-4 py-3">
                          {expandedId === threat.id ? (
                            <ChevronUp className="w-4 h-4 text-gray-500" />
                          ) : (
                            <ChevronDown className="w-4 h-4 text-gray-500" />
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`text-[10px] px-1.5 py-0.5 rounded border font-medium uppercase tracking-wider ${
                              sourceColors[threat.source] ||
                              'bg-gray-800 text-gray-400 border-gray-700'
                            }`}
                          >
                            {sourceLabels[threat.source] || threat.source}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm font-mono text-cyan-400">
                          {threat.source_id}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-300 max-w-xs truncate">
                          {threat.title}
                        </td>
                        <td className="px-4 py-3">
                          <SeverityBadge severity={threat.severity} size="xs" />
                        </td>
                        <td className="px-4 py-3 text-sm font-mono font-bold text-gray-300">
                          {threat.cvss_score != null ? threat.cvss_score.toFixed(1) : '--'}
                        </td>
                        <td className="px-4 py-3 text-center">
                          {threat.exploits_available ? (
                            <Bug className="w-4 h-4 text-orange-400 mx-auto" />
                          ) : (
                            <span className="text-gray-600">--</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-center">
                          {threat.actively_exploited ? (
                            <Flame className="w-4 h-4 text-red-400 mx-auto threat-pulse" />
                          ) : (
                            <span className="text-gray-600">--</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-xs text-gray-500">
                          {threat.published_date
                            ? new Date(threat.published_date).toLocaleDateString()
                            : '--'}
                        </td>
                      </tr>
                      {/* Expanded details row */}
                      {expandedId === threat.id && (
                        <tr key={`${threat.id}-details`}>
                          <td colSpan={9} className="bg-gray-950/50 px-8 py-4 border-l-2 border-cyan-500/30">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              <div>
                                <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">
                                  Details
                                </h4>
                                <p className="text-sm text-gray-300 leading-relaxed">
                                  {threat.title}
                                </p>
                                <div className="mt-3 flex items-center gap-4 flex-wrap">
                                  <div className="text-xs text-gray-500">
                                    <span className="text-gray-400">Source:</span>{' '}
                                    {sourceLabels[threat.source] || threat.source}
                                  </div>
                                  <div className="text-xs text-gray-500">
                                    <span className="text-gray-400">ID:</span>{' '}
                                    <span className="font-mono text-cyan-400">
                                      {threat.source_id}
                                    </span>
                                  </div>
                                  {threat.cvss_score != null && (
                                    <div className="text-xs text-gray-500">
                                      <span className="text-gray-400">CVSS:</span>{' '}
                                      <span className="font-mono font-bold">
                                        {threat.cvss_score.toFixed(1)}
                                      </span>
                                    </div>
                                  )}
                                </div>
                              </div>
                              <div>
                                <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">
                                  Indicators
                                </h4>
                                <div className="space-y-2">
                                  <div className="flex items-center gap-2">
                                    <Bug
                                      className={`w-4 h-4 ${
                                        threat.exploits_available
                                          ? 'text-orange-400'
                                          : 'text-gray-600'
                                      }`}
                                    />
                                    <span
                                      className={`text-sm ${
                                        threat.exploits_available
                                          ? 'text-orange-400'
                                          : 'text-gray-500'
                                      }`}
                                    >
                                      Exploits{' '}
                                      {threat.exploits_available
                                        ? 'Available'
                                        : 'Not Available'}
                                    </span>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <Flame
                                      className={`w-4 h-4 ${
                                        threat.actively_exploited
                                          ? 'text-red-400'
                                          : 'text-gray-600'
                                      }`}
                                    />
                                    <span
                                      className={`text-sm ${
                                        threat.actively_exploited
                                          ? 'text-red-400'
                                          : 'text-gray-500'
                                      }`}
                                    >
                                      {threat.actively_exploited
                                        ? 'Actively Exploited in the Wild'
                                        : 'No Active Exploitation Reported'}
                                    </span>
                                  </div>
                                </div>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
