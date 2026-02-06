import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  Server,
  ShieldAlert,
  FileText,
  ShieldCheck,
  Activity,
} from 'lucide-react';

const navItems = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/assets', icon: Server, label: 'Assets' },
  { to: '/threats', icon: ShieldAlert, label: 'Threats' },
  { to: '/briefings', icon: FileText, label: 'Briefings' },
];

export default function Sidebar() {
  return (
    <aside className="fixed left-0 top-0 h-screen w-60 bg-gray-950 border-r border-gray-800 flex flex-col z-40">
      {/* Logo / Brand */}
      <div className="px-5 py-5 border-b border-gray-800">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center">
            <ShieldCheck className="w-5 h-5 text-cyan-400" />
          </div>
          <div>
            <h1 className="text-base font-bold text-white tracking-tight">
              ThreatSynth
            </h1>
            <span className="text-[10px] font-medium text-cyan-400 uppercase tracking-widest">
              AI Engine
            </span>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-1">
        {navItems.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 group ${
                isActive
                  ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/20'
                  : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800/50 border border-transparent'
              }`
            }
          >
            <Icon className="w-[18px] h-[18px]" />
            <span>{label}</span>
          </NavLink>
        ))}
      </nav>

      {/* Status indicator */}
      <div className="px-4 py-4 border-t border-gray-800 space-y-3">
        <div className="px-2 py-1.5 rounded-md bg-amber-500/10 border border-amber-500/20">
          <p className="text-[10px] font-semibold text-amber-400 uppercase tracking-wider">Demo Mode</p>
          <p className="text-[10px] text-amber-400/60 mt-0.5 leading-snug">Showing sample data. Deploy with backend for live intel.</p>
        </div>
        <div className="flex items-center gap-2 text-xs text-gray-500">
          <Activity className="w-3.5 h-3.5 text-green-500" />
          <span>System Online</span>
        </div>
      </div>
    </aside>
  );
}
