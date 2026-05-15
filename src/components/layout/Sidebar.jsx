import { Link, useLocation } from 'react-router-dom';
import {
  LayoutDashboard, Music2, Radio, Calendar,
  Settings, Activity, FileText, ChevronRight, Zap, LogOut, User, Headphones, Terminal, Globe
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';

const NAV_GROUPS = [
  { title: 'Core', items: [
    { path: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { path: '/manage-players', label: 'Players', icon: Headphones, highlight: true },
    { path: '/now-playing', label: 'Now Playing', icon: Radio },
    { path: '/playlists', label: 'Playlists', icon: Music2 },
    { path: '/calendar', label: 'Calendar', icon: Calendar },
  ]},
  { title: 'Setup', items: [
    { path: '/spotify-accounts', label: 'Provider / API Center', icon: Music2 },
    { path: '/settings/network', label: 'Network', icon: Globe },
    { path: '/settings', label: 'Settings', icon: Settings },
  ]},
  { title: 'Diagnostics', items: [
    { path: '/system-check', label: 'System Check', icon: Activity },
    { path: '/commands', label: 'Commands', icon: Terminal },
    { path: '/logs', label: 'Logs', icon: FileText },
  ]},
];

export default function Sidebar() {
  const { pathname } = useLocation();
  const [user, setUser] = useState(null);

  useEffect(() => { base44.auth.me().then(setUser).catch(() => setUser(null)); }, []);

  return (
    <aside className="hidden lg:flex flex-col w-72 min-h-screen bg-sidebar border-r border-sidebar-border">
      <div className="p-6 border-b border-sidebar-border">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center"><Zap className="w-5 h-5 text-primary" /></div>
          <div><p className="font-black text-sm gradient-text">StudioSoundSet</p><p className="text-[10px] text-muted-foreground">Player-based Control</p></div>
        </div>
      </div>

      <nav className="flex-1 p-3 space-y-5 overflow-y-auto">
        {NAV_GROUPS.map((group) => (
          <div key={group.title} className="space-y-1">
            <p className="px-3 text-[10px] uppercase tracking-[0.18em] text-muted-foreground font-black">{group.title}</p>
            {group.items.map(item => {
              const Icon = item.icon;
              const active = pathname === item.path || (item.path !== '/dashboard' && pathname.startsWith(item.path));
              return (
                <Link key={item.path} to={item.path}>
                  <div className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-all group ${active ? 'bg-sidebar-accent text-sidebar-accent-foreground' : item.highlight ? 'text-green-400 hover:bg-green-500/10 border border-green-500/20' : 'text-sidebar-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground'}`}>
                    <Icon className={`w-4 h-4 flex-shrink-0 ${active ? 'text-sidebar-primary' : item.highlight ? 'text-green-400' : 'text-sidebar-foreground/60 group-hover:text-sidebar-foreground'}`} />
                    <span className="flex-1">{item.label}</span>
                    {active && <ChevronRight className="w-3 h-3 text-sidebar-primary" />}
                  </div>
                </Link>
              );
            })}
          </div>
        ))}
      </nav>

      <div className="p-4 border-t border-sidebar-border space-y-2">
        {user ? (
          <div className="flex items-center gap-2 px-2 py-1.5 rounded-lg bg-green-500/10 border border-green-500/20">
            <div className="w-6 h-6 rounded-full bg-green-500/20 flex items-center justify-center flex-shrink-0"><User className="w-3 h-3 text-green-400" /></div>
            <div className="flex-1 min-w-0"><p className="text-[10px] text-green-400 font-semibold truncate">✓ Eingeloggt</p><p className="text-[9px] text-muted-foreground truncate">{user.email}</p></div>
            <button onClick={() => base44.auth.logout()} title="Ausloggen"><LogOut className="w-3 h-3 text-muted-foreground hover:text-destructive" /></button>
          </div>
        ) : (
          <div className="flex items-center gap-2 px-2 py-1.5 rounded-lg bg-red-500/10 border border-red-500/20"><User className="w-3 h-3 text-red-400" /><button onClick={() => base44.auth.redirectToLogin('/dashboard')} className="text-[10px] text-blue-400 underline">Einloggen</button></div>
        )}
        <p className="text-[10px] text-muted-foreground">Player ist die zentrale Einheit. Zonen sind nur Räume/Defaults.</p>
      </div>
    </aside>
  );
}
