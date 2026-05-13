import { Link, useLocation } from 'react-router-dom';
import {
  LayoutDashboard, Music2, MapPin, Radio, Calendar,
  Settings, Activity, FileText, ChevronRight, Zap, LogOut, User, Headphones, Plus
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';

const NAV = [
  { path: '/dashboard',         label: 'Dashboard',           icon: LayoutDashboard },
  { path: '/player',            label: '▶ Browser Player',    icon: Headphones,  highlight: true },
  { path: '/manage-players',    label: '⚙ Player verwalten',  icon: Plus,        highlight: true },
  { path: '/player-users',      label: 'Player-Users',        icon: Plus },
  { path: '/spotify-accounts',  label: 'Spotify Accounts',    icon: Music2 },
  { path: '/zones',             label: 'Zonen',               icon: MapPin },
  { path: '/now-playing',       label: 'Now Playing',         icon: Radio },
  { path: '/playlists',         label: 'Playlists',           icon: Music2 },
  { path: '/calendar',          label: 'Zeitplaner',          icon: Calendar },
  { path: '/system-check',      label: 'System Check',        icon: Activity },
  { path: '/logs',              label: 'Logs',                icon: FileText },
  { path: '/settings',          label: 'Einstellungen',       icon: Settings },
];

export default function Sidebar() {
  const { pathname } = useLocation();
  const [user, setUser] = useState(null);

  useEffect(() => {
    base44.auth.me().then(setUser).catch(() => setUser(null));
  }, []);

  return (
    <aside className="hidden lg:flex flex-col w-64 min-h-screen bg-sidebar border-r border-sidebar-border">
      {/* Logo */}
      <div className="p-6 border-b border-sidebar-border">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center">
            <Zap className="w-5 h-5 text-primary" />
          </div>
          <div>
            <p className="font-black text-sm gradient-text">StudioSoundSet</p>
            <p className="text-[10px] text-muted-foreground">Multi-Zone Control</p>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto">
        {NAV.map(item => {
          const Icon = item.icon;
          const active = pathname === item.path || (item.path !== '/dashboard' && pathname.startsWith(item.path));
          return (
            <Link key={item.path} to={item.path}>
              <div className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-all group ${
                active
                  ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                  : item.highlight
                  ? 'text-green-400 hover:bg-green-500/10 border border-green-500/20 mb-1'
                  : 'text-sidebar-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground'
              }`}>
                <Icon className={`w-4 h-4 flex-shrink-0 ${active ? 'text-sidebar-primary' : item.highlight ? 'text-green-400' : 'text-sidebar-foreground/60 group-hover:text-sidebar-foreground'}`} />
                <span className="flex-1">{item.label}</span>
                {active && <ChevronRight className="w-3 h-3 text-sidebar-primary" />}
              </div>
            </Link>
          );
        })}
      </nav>

      <div className="p-4 border-t border-sidebar-border space-y-2">
        {user ? (
          <div className="flex items-center gap-2 px-2 py-1.5 rounded-lg bg-green-500/10 border border-green-500/20">
            <div className="w-6 h-6 rounded-full bg-green-500/20 flex items-center justify-center flex-shrink-0">
              <User className="w-3 h-3 text-green-400" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[10px] text-green-400 font-semibold truncate">✓ Eingeloggt</p>
              <p className="text-[9px] text-muted-foreground truncate">{user.email}</p>
            </div>
            <button onClick={() => base44.auth.logout()} title="Ausloggen">
              <LogOut className="w-3 h-3 text-muted-foreground hover:text-destructive" />
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-2 px-2 py-1.5 rounded-lg bg-red-500/10 border border-red-500/20">
            <div className="w-6 h-6 rounded-full bg-red-500/20 flex items-center justify-center flex-shrink-0">
              <User className="w-3 h-3 text-red-400" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[10px] text-red-400 font-semibold">✗ Nicht eingeloggt</p>
              <button onClick={() => base44.auth.redirectToLogin()} className="text-[9px] text-blue-400 underline">Einloggen</button>
            </div>
          </div>
        )}
        <p className="text-[10px] text-muted-foreground">Nur für private Nutzung.</p>
      </div>
    </aside>
  );
}