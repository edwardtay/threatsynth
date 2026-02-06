import { useState, useEffect } from 'react';
import {
  Sparkles,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  Shield,
  FileText,
  Building2,
  Eye,
} from 'lucide-react';
import SeverityBadge from '../components/SeverityBadge';
import Spinner, { FullPageSpinner } from '../components/Spinner';
import { useToast } from '../components/ToastContext';
import { getBriefings, generateBriefings, updateBriefingStatus } from '../services/api';
import { mockBriefings } from '../services/mockData';

const STATUS_OPTIONS = [
  { value: 'new', label: 'New' },
  { value: 'acknowledged', label: 'Acknowledged' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'resolved', label: 'Resolved' },
];

function PriorityBadge({ score }) {
  const val = typeof score === 'number' ? score : 0;
  const color =
    val > 8
      ? 'from-red-500/20 to-red-500/5 border-red-500/40 text-red-400'
      : val > 5
        ? 'from-orange-500/20 to-orange-500/5 border-orange-500/40 text-orange-400'
        : 'from-yellow-500/20 to-yellow-500/5 border-yellow-500/40 text-yellow-400';

  return (
    <div
      className={`w-14 h-14 rounded-xl border bg-gradient-to-br flex flex-col items-center justify-center shrink-0 ${color}`}
    >
      <span className="text-lg font-bold font-mono leading-none">
        {val.toFixed(1)}
      </span>
      <span className="text-[8px] uppercase tracking-wider opacity-70 mt-0.5">
        Priority
      </span>
    </div>
  );
}

function ExpandableSection({ title, icon: Icon, children, defaultOpen = false }) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="border border-gray-800 rounded-lg overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-4 py-2.5 bg-gray-800/30 hover:bg-gray-800/60 transition-colors"
      >
        <div className="flex items-center gap-2 text-sm text-gray-300">
          <Icon className="w-4 h-4 text-gray-400" />
          <span className="font-medium">{title}</span>
        </div>
        {open ? (
          <ChevronUp className="w-4 h-4 text-gray-500" />
        ) : (
          <ChevronDown className="w-4 h-4 text-gray-500" />
        )}
      </button>
      {open && (
        <div className="px-4 py-3 text-sm text-gray-300 leading-relaxed">
          {children}
        </div>
      )}
    </div>
  );
}

export default function Briefings() {
  const [briefings, setBriefings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [updatingId, setUpdatingId] = useState(null);
  const { addToast } = useToast();

  const fetchBriefings = async () => {
    try {
      const res = await getBriefings();
      const raw = res.data;
      const list = Array.isArray(raw) ? raw : raw?.briefings || [];
      // Sort by priority_score descending
      list.sort((a, b) => (b.priority_score || 0) - (a.priority_score || 0));
      setBriefings(list);
    } catch (err) {
      // Fallback to demo data when backend is unavailable
      setBriefings([...mockBriefings].sort((a, b) => (b.priority_score || 0) - (a.priority_score || 0)));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBriefings();
  }, []);

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      await generateBriefings();
      addToast('Briefing generation started. This may take a moment...', 'info');
      // Poll for results
      setTimeout(() => {
        setLoading(true);
        fetchBriefings();
      }, 3000);
    } catch (err) {
      addToast(err.response?.data?.detail || 'Generation failed', 'error');
    } finally {
      setGenerating(false);
    }
  };

  const handleStatusChange = async (id, newStatus) => {
    setUpdatingId(id);
    try {
      await updateBriefingStatus(id, newStatus);
      setBriefings((prev) =>
        prev.map((b) => (b.id === id ? { ...b, status: newStatus } : b))
      );
      addToast(`Status updated to ${newStatus.replace('_', ' ')}`, 'success');
    } catch (err) {
      addToast('Failed to update status', 'error');
    } finally {
      setUpdatingId(null);
    }
  };

  const formatRemediation = (text) => {
    if (!text) return null;
    // Split on numbered steps or newlines
    const steps = text
      .split(/\n/)
      .map((s) => s.trim())
      .filter(Boolean);
    if (steps.length <= 1) return <p>{text}</p>;
    return (
      <ol className="list-decimal list-inside space-y-1.5">
        {steps.map((step, i) => (
          <li key={i} className="text-sm">
            {step.replace(/^\d+[\.\)]\s*/, '')}
          </li>
        ))}
      </ol>
    );
  };

  if (loading) return <FullPageSpinner message="Loading briefings..." />;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Briefings</h1>
          <p className="text-sm text-gray-400 mt-1">
            {briefings.length} AI-generated security briefing
            {briefings.length !== 1 ? 's' : ''}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleGenerate}
            disabled={generating}
            className="flex items-center gap-2 px-4 py-2 bg-purple-500/10 text-purple-400 border border-purple-500/30 rounded-lg text-sm font-medium hover:bg-purple-500/20 transition-all disabled:opacity-50"
          >
            {generating ? (
              <Spinner size="sm" />
            ) : (
              <Sparkles className="w-4 h-4" />
            )}
            Generate New Briefings
          </button>
          <button
            onClick={() => {
              setLoading(true);
              fetchBriefings();
            }}
            className="flex items-center gap-2 px-3 py-2 text-gray-400 hover:text-white bg-gray-800 hover:bg-gray-700 rounded-lg border border-gray-700 transition-all"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Generating overlay */}
      {generating && (
        <div className="bg-purple-500/5 border border-purple-500/20 rounded-xl p-6 text-center">
          <Spinner size="lg" className="mx-auto mb-3 text-purple-400" />
          <p className="text-sm text-purple-300 font-medium">
            AI is analyzing threats and generating briefings...
          </p>
          <p className="text-xs text-gray-500 mt-1">
            This may take a moment while the LLM synthesizes intelligence.
          </p>
        </div>
      )}

      {/* Briefings List */}
      {briefings.length === 0 && !generating ? (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-12 text-center">
          <FileText className="w-10 h-10 mx-auto mb-3 text-gray-600" />
          <p className="text-gray-400 text-sm">No briefings generated yet.</p>
          <p className="text-gray-500 text-xs mt-1">
            Ensure you have assets and threats, then click &quot;Generate New
            Briefings&quot;.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {briefings.map((briefing) => (
            <div
              key={briefing.id}
              className="bg-gray-900 border border-gray-800 rounded-xl hover:border-gray-700 transition-all"
            >
              {/* Card Header */}
              <div className="flex items-start gap-4 p-5">
                <PriorityBadge score={briefing.priority_score} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      {/* Threat + Asset info */}
                      <div className="flex items-center gap-2 flex-wrap mb-1.5">
                        {briefing.threat?.source_id && (
                          <span className="text-sm font-mono text-cyan-400 font-medium">
                            {briefing.threat.source_id}
                          </span>
                        )}
                        {briefing.threat?.severity && (
                          <SeverityBadge
                            severity={briefing.threat.severity}
                            size="xs"
                          />
                        )}
                      </div>
                      <h3 className="text-sm font-medium text-gray-200 leading-snug">
                        {briefing.threat?.title || 'Threat details unavailable'}
                      </h3>
                      {briefing.asset && (
                        <p className="text-xs text-gray-500 mt-1.5 font-mono">
                          Affects: {briefing.asset.name}
                          {briefing.asset.version &&
                            ` v${briefing.asset.version}`}
                          {briefing.asset.vendor &&
                            ` (${briefing.asset.vendor})`}
                        </p>
                      )}
                    </div>

                    {/* Status dropdown */}
                    <div className="shrink-0 flex items-center gap-2">
                      {updatingId === briefing.id ? (
                        <Spinner size="sm" />
                      ) : (
                        <select
                          value={briefing.status || 'new'}
                          onChange={(e) =>
                            handleStatusChange(briefing.id, e.target.value)
                          }
                          className="text-xs px-2 py-1 bg-gray-800 border border-gray-700 rounded-md text-gray-300 focus:outline-none focus:border-cyan-500/50 cursor-pointer"
                        >
                          {STATUS_OPTIONS.map((opt) => (
                            <option key={opt.value} value={opt.value}>
                              {opt.label}
                            </option>
                          ))}
                        </select>
                      )}
                      <SeverityBadge
                        status={briefing.status || 'new'}
                        size="xs"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Expandable sections */}
              <div className="px-5 pb-5 space-y-2">
                <ExpandableSection
                  title="AI Summary"
                  icon={Eye}
                  defaultOpen={true}
                >
                  <p>{briefing.summary || 'No summary available.'}</p>
                </ExpandableSection>

                <ExpandableSection title="Remediation Steps" icon={Shield}>
                  {briefing.remediation ? (
                    formatRemediation(briefing.remediation)
                  ) : (
                    <p className="text-gray-500">
                      No remediation steps available.
                    </p>
                  )}
                </ExpandableSection>

                <ExpandableSection title="Business Impact" icon={Building2}>
                  <p>
                    {briefing.business_impact || 'No impact assessment available.'}
                  </p>
                </ExpandableSection>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
