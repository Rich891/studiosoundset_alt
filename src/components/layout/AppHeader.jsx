import { useState } from 'react';
import { useLocation } from 'react-router-dom';
import { MoreHorizontal } from 'lucide-react';
import { cn } from '@/lib/utils';
import BentoMenu from './BentoMenu';

const pageTitles = {
  '/dashboard': 'Dashboard',
  '/now-playing': 'Now Playing',
  '/calendar': 'Wochenplan',
  '/devices': 'Geräte',
  '/devices/add': 'Gerät hinzufügen',
  '/providers': 'Provider',
  '/providers/add': 'Provider hinzufügen',
  '/playlists': 'Playlists',
  '/playlists/import': 'Playlist importieren',
  '/admin': 'Admin',
  '/admin/system-check': 'Systemprüfung',
  '/how-it-works': 'Hilfe',
  '/logs': 'Logs',
  '/settings': 'Einstellungen',
};

export default function AppHeader() {
  const [menuOpen, setMenuOpen] = useState(false);
  const location = useLocation();

  const title = pageTitles[location.pathname] || 'Studio Sound Control Pro';

  return (
    <>
      <header className="fixed top-0 left-0 right-0 z-30 h-14 flex items-center justify-between px-4 border-b border-white/8"
        style={{ background: 'hsl(222 47% 5% / 0.85)', backdropFilter: 'blur(16px)' }}
      >
        {/* Logo / Title */}
        <div className="flex items-center gap-3">
          <div className="w-7 h-7 rounded-lg bg-primary/20 flex items-center justify-center flex-shrink-0">
            <span className="text-primary text-xs font-bold">S</span>
          </div>
          <span className="text-sm font-semibold text-foreground truncate max-w-[180px] sm:max-w-none">
            {title}
          </span>
        </div>

        {/* Menu trigger button */}
        <button
          onClick={() => setMenuOpen((v) => !v)}
          aria-label="Menü öffnen"
          className={cn(
            'relative w-10 h-10 rounded-xl flex items-center justify-center',
            'border transition-all duration-200',
            'focus:outline-none focus-visible:ring-2 focus-visible:ring-primary',
            menuOpen
              ? 'border-primary/50 bg-primary/15 text-primary shadow-[0_0_12px_hsl(var(--primary)/0.25)]'
              : 'border-white/10 bg-white/5 text-muted-foreground hover:border-white/20 hover:bg-white/10 hover:text-foreground'
          )}
          style={{ backdropFilter: 'blur(8px)' }}
        >
          <MoreHorizontal className="w-5 h-5" />
        </button>
      </header>

      <BentoMenu open={menuOpen} onClose={() => setMenuOpen(false)} />
    </>
  );
}