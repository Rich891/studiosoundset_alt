import { Link, useLocation } from 'react-router-dom';
import { 
  LayoutDashboard, Calendar, Radio, Cpu, Music2, 
  List, Shield, HelpCircle, FileText, Settings,
  ChevronRight, Zap, Volume2
} from 'lucide-react';
import { cn } from '@/lib/utils';

const navItems = [
  { icon: LayoutDashboard, label: 'Dashboard', path: '/' },
  { icon: Calendar, label: 'Kalender', path: '/calendar' },
  { icon: Radio, label: 'Now Playing', path: '/now-playing' },
  { icon: Cpu, label: 'Geräte', path: '/devices' },
  { icon: Zap, label: 'Provider', path: '/providers' },
  { icon: Music2, label: 'Playlists', path: '/playlists' },
  { icon: Shield, label: 'Admin', path: '/admin' },
  { icon: HelpCircle, label: 'How it works', path: '/how-it-works' },
  { icon: FileText, label: 'Logs', path: '/logs' },
  { icon: Settings, label: 'Einstellungen', path: '/settings' },
];

export default function Sidebar() {
  const location = useLocation();

  return (
    <aside className="fixed left-0 top-0 h-full w-64 bg-sidebar border-r border-sidebar-border z-40 flex flex-col">
      {/* Logo */}
      <div className="p-6 border-b border-sidebar-border">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-primary/20 flex items-center justify-center">
            <Volume2 className="w-5 h-5 text-primary" />
          </div>
          <div>
            <p className="font-bold text-sm text-foreground leading-tight">Studio Sound</p>
            <p className="text-xs text-muted-foreground">Control Pro</p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-3 overflow-y-auto">
        <ul className="space-y-1">
          {navItems.map((item) => {
            const active = location.pathname === item.path || 
              (item.path !== '/' && location.pathname.startsWith(item.path));
            return (
              <li key={item.path}>
                <Link
                  to={item.path}
                  className={cn(
                    'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200',
                    active
                      ? 'bg-primary/15 text-primary'
                      : 'text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'
                  )}
                >
                  <item.icon className="w-4 h-4 flex-shrink-0" />
                  <span className="flex-1">{item.label}</span>
                  {active && <ChevronRight className="w-3 h-3 opacity-60" />}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* Footer */}
      <div className="p-4 border-t border-sidebar-border">
        <p className="text-xs text-muted-foreground text-center">v1.0.0 — Studio Sound Control Pro</p>
      </div>
    </aside>
  );
}