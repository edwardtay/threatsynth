import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  Server,
  ShieldAlert,
  FileText,
  ShieldCheck,
  Activity,
  LogOut,
  User,
} from 'lucide-react';
import { useAuth } from './AuthContext';

const navItems = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/assets', icon: Server, label: 'Assets' },
  { to: '/threats', icon: ShieldAlert, label: 'Threats' },
  { to: '/briefings', icon: FileText, label: 'Briefings' },
];

export default function Sidebar() {
  const { user, logout } = useAuth();

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

      {/* User info + logout */}
      <div className="px-4 py-4 border-t border-gray-800 space-y-3">
        {user && (
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-purple-500/15 border border-purple-500/25 flex items-center justify-center shrink-0">
              <User className="w-4 h-4 text-purple-400" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-medium text-gray-200 truncate">{user.name}</p>
              <p className="text-[10px] text-gray-500 truncate">{user.email}</p>
            </div>
            <button
              onClick={logout}
              className="p-1.5 text-gray-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors shrink-0"
              title="Sign out"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        )}
        <div className="flex items-center gap-2 text-xs text-gray-500">
          <Activity className="w-3.5 h-3.5 text-green-500" />
          <span>System Online</span>
        </div>
      </div>
    </aside>
  );
}
