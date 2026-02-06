import { Bug, Flame, ExternalLink } from 'lucide-react';
import SeverityBadge from './SeverityBadge';

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

export default function ThreatCard({ threat, onClick }) {
  return (
    <div
      onClick={onClick}
      className="bg-gray-900 border border-gray-800 rounded-lg p-4 hover:border-gray-700 hover:bg-gray-900/80 transition-all cursor-pointer group"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-2 flex-wrap">
            <span
              className={`text-[10px] px-1.5 py-0.5 rounded border font-medium uppercase tracking-wider ${
                sourceColors[threat.source] || 'bg-gray-500/15 text-gray-400 border-gray-500/30'
              }`}
            >
              {sourceLabels[threat.source] || threat.source}
            </span>
            <span className="text-xs font-mono text-cyan-400">
              {threat.source_id}
            </span>
          </div>
          <h3 className="text-sm font-medium text-gray-200 truncate group-hover:text-white transition-colors">
            {threat.title}
          </h3>
        </div>
        <div className="flex flex-col items-end gap-2 shrink-0">
          <SeverityBadge severity={threat.severity} size="xs" />
          {threat.cvss_score != null && (
            <span className="text-xs font-mono font-bold text-gray-300">
              CVSS {threat.cvss_score.toFixed(1)}
            </span>
          )}
        </div>
      </div>

      <div className="flex items-center gap-3 mt-3 pt-3 border-t border-gray-800">
        {threat.exploits_available && (
          <div className="flex items-center gap-1 text-orange-400">
            <Bug className="w-3.5 h-3.5" />
            <span className="text-[10px] font-medium uppercase">Exploit Available</span>
          </div>
        )}
        {threat.actively_exploited && (
          <div className="flex items-center gap-1 text-red-400 threat-pulse">
            <Flame className="w-3.5 h-3.5" />
            <span className="text-[10px] font-medium uppercase">Actively Exploited</span>
          </div>
        )}
        {threat.published_date && (
          <span className="text-[10px] text-gray-500 ml-auto">
            {new Date(threat.published_date).toLocaleDateString()}
          </span>
        )}
      </div>
    </div>
  );
}
