import { useState } from 'react';
import { useLocation } from 'react-router-dom';
import { MoreHorizontal, Volume2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import BentoMenu from './BentoMenu';

const pageTitles = {
  '/dashboard': 'Dashboard',
  '/now-playing': 'Now Playing',
  '/calendar': 'Zeitplaner',
  '/devices': 'Geräte',
  '/devices/add': 'Gerät hinzufügen',
  '/providers': 'Provider',
  '/providers/add': 'Provider hinzufügen',
  '/playlists': 'Playlists',
  '/playlists/import': 'Playlist importieren',
  '/admin': 'Admin',
  '/admin/system-check': 'System Check',
  '/how-it-works': 'Hilfe',
  '/logs': 'Logs',
  '/settings': 'Einstellungen',
};

export default function AppHeader() {
  const [menuOpen, setMenuOpen] = useState(false);
  const location = useLocation();
  const title = pageTitles[location.pathname] || 'StudioSoundSet';

  return (
    <>
      <header
        className="fixed top-0 left-0 right-0 z-30 h-14 flex items-center justify-between px-4 border-b border-white/6"
        style={{ background: 'hsl(222 47% 4% / 0.88)', backdropFilter: 'blur(20px)' }}
      >
        {/* Logo + Title */}
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-primary/15 border border-primary/20 flex items-center justify-center flex-shrink-0">
            <Volume2 className="w-4 h-4 text-primary" />
          </div>
          <div className="hidden sm:block">
            <span className="text-xs font-bold text-muted-foreground uppercase tracking-widest">StudioSoundSet</span>
          </div>
          <div className="w-px h-4 bg-border/50 hidden sm:block" />
          <span className="text-sm font-semibold text-foreground truncate max-w-[160px] sm:max-w-none">
            {title}
          </span>
        </div>

        {/* Menu trigger */}
        <button
          onClick={() => setMenuOpen(v => !v)}
          aria-label="Menü öffnen"
          className={cn(
            'relative w-9 h-9 rounded-xl flex items-center justify-center border transition-all duration-200',
            'focus:outline-none focus-visible:ring-2 focus-visible:ring-primary',
            menuOpen
              ? 'border-primary/50 bg-primary/15 text-primary shadow-[0_0_12px_hsl(var(--primary)/0.2)]'
              : 'border-white/8 bg-white/4 text-muted-foreground hover:border-white/18 hover:bg-white/8 hover:text-foreground'
          )}
        >
          <MoreHorizontal className="w-4 h-4" />
        </button>
      </header>

      <BentoMenu open={menuOpen} onClose={() => setMenuOpen(false)} />
    </>
  );
}