import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Menu, X, LayoutDashboard, Music2, MapPin, Radio, Calendar, Settings, Activity, Zap, Terminal, Globe, Plus, Headphones, FileText } from 'lucide-react';

const NAV = [
  { path: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { path: '/now-playing', label: 'Now Playing', icon: Radio },
  { path: '/player', label: 'Browser Player', icon: Headphones },
  { path: '/manage-players', label: 'Player verwalten', icon: Plus },
  { path: '/playlists', label: 'Playlists', icon: Music2 },
  { path: '/spotify-accounts', label: 'Spotify Provider', icon: Music2 },
  { path: '/calendar', label: 'Zeitplaner', icon: Calendar },
  { path: '/commands', label: 'Commands', icon: Terminal },
  { path: '/system-check', label: 'System Check', icon: Activity },
  { path: '/logs', label: 'Logs', icon: FileText },
  { path: '/zones', label: 'Zonen', icon: MapPin },
  { path: '/settings/network', label: 'Network', icon: Globe },
  { path: '/settings', label: 'Einstellungen', icon: Settings },
];

export default function MobileNav() {
  const [open, setOpen] = useState(false);
  const { pathname } = useLocation();

  return (
    <div className="lg:hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border/30 bg-card/50 backdrop-blur-sm">
        <div className="flex items-center gap-2"><div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center"><Zap className="w-4 h-4 text-primary" /></div><span className="font-black text-sm gradient-text">StudioSoundSet</span></div>
        <button onClick={() => setOpen(!open)} className="p-2 rounded-xl hover:bg-muted/20 transition-colors">{open ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}</button>
      </div>

      {open && (
        <div className="fixed inset-0 z-50 bg-background/95 backdrop-blur-sm pt-16 overflow-y-auto">
          <div className="absolute top-3 right-4"><button onClick={() => setOpen(false)} className="p-2 rounded-xl hover:bg-muted/20"><X className="w-5 h-5" /></button></div>
          <nav className="p-4 space-y-1">
            {NAV.map(item => {
              const Icon = item.icon;
              const active = pathname === item.path || (item.path !== '/dashboard' && pathname.startsWith(item.path));
              return <Link key={item.path} to={item.path} onClick={() => setOpen(false)}><div className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition-all ${active ? 'bg-primary/10 text-primary' : 'text-foreground hover:bg-muted/20'}`}><Icon className="w-5 h-5" />{item.label}</div></Link>;
            })}
          </nav>
        </div>
      )}
    </div>
  );
}
