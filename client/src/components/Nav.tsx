import { NavLink } from 'react-router-dom';
import { LayoutDashboard, Crosshair, Settings, Zap } from 'lucide-react';
import clsx from 'clsx';

interface NavProps {
  leadCount: number;
}

const links = [
  { to: '/',         label: 'Dashboard', icon: LayoutDashboard },
  { to: '/scraper',  label: 'Scraper',   icon: Crosshair },
  { to: '/settings', label: 'Settings',  icon: Settings },
];

export default function Nav({ leadCount }: NavProps) {
  return (
    <aside className="fixed inset-y-0 left-0 w-56 bg-slate-900 border-r border-slate-800 flex flex-col z-10">
      {/* Logo */}
      <div className="px-5 py-5 border-b border-slate-800">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 bg-violet-600 rounded-lg flex items-center justify-center flex-shrink-0">
            <Zap size={14} className="text-white" />
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-100 leading-tight">Lead Scraper</p>
            <p className="text-xs text-slate-500 leading-tight">B2B Intelligence</p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-1">
        {links.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className={({ isActive }) =>
              clsx(
                'flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors',
                isActive
                  ? 'bg-violet-600/20 text-violet-400'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
              )
            }
          >
            <Icon size={16} />
            <span>{label}</span>
            {label === 'Dashboard' && leadCount > 0 && (
              <span className="ml-auto badge bg-slate-800 text-slate-300">{leadCount}</span>
            )}
          </NavLink>
        ))}
      </nav>

      {/* Footer */}
      <div className="px-5 py-4 border-t border-slate-800">
        <p className="text-xs text-slate-600">Powered by Claude AI</p>
      </div>
    </aside>
  );
}
