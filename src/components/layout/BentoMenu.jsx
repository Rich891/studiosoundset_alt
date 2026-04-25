import { useEffect, useRef } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  LayoutDashboard, Calendar, Radio, Cpu, Music2,
  Shield, HelpCircle, FileText, Settings, Zap, X
} from 'lucide-react';
import { cn } from '@/lib/utils';

const navItems = [
  { icon: LayoutDashboard, label: 'Dashboard', path: '/dashboard', desc: 'Systemübersicht' },
  { icon: Radio, label: 'Now Playing', path: '/now-playing', desc: 'Aktuelle Wiedergabe' },
  { icon: Calendar, label: 'Wochenplan', path: '/calendar', desc: 'Zeitplan verwalten' },
  { icon: Cpu, label: 'Geräte', path: '/devices', desc: 'Geräte & Zonen' },
  { icon: Zap, label: 'Provider', path: '/providers', desc: 'Spotify & mehr' },
  { icon: Music2, label: 'Playlists', path: '/playlists', desc: 'Musik verwalten' },
  { icon: Shield, label: 'Admin', path: '/admin', desc: 'Systemverwaltung' },
  { icon: FileText, label: 'Logs', path: '/logs', desc: 'Aktivitätsprotokoll' },
  { icon: Settings, label: 'Einstellungen', path: '/settings', desc: 'App konfigurieren' },
  { icon: HelpCircle, label: 'Hilfe', path: '/how-it-works', desc: 'Wie es funktioniert' },
];

export default function BentoMenu({ open, onClose }) {
  const location = useLocation();
  const menuRef = useRef(null);

  // Close on ESC
  useEffect(() => {
    const handleKey = (e) => { if (e.key === 'Escape') onClose(); };
    if (open) window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [open, onClose]);

  // Close on outside click
  useEffect(() => {
    const handleClick = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        onClose();
      }
    };
    if (open) {
      // Delay to avoid immediate close on the same click that opened it
      setTimeout(() => document.addEventListener('mousedown', handleClick), 10);
    }
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
          />

          {/* Bento Panel */}
          <motion.div
            ref={menuRef}
            className="fixed top-16 right-4 z-50 w-[min(92vw,480px)]"
            initial={{ opacity: 0, scale: 0.92, y: -12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.92, y: -12 }}
            transition={{ duration: 0.22, ease: [0.4, 0, 0.2, 1] }}
          >
            {/* Glass container */}
            <div
              className="rounded-2xl border border-white/10 shadow-2xl overflow-hidden"
              style={{
                background: 'hsl(222 47% 7% / 0.92)',
                backdropFilter: 'blur(24px)',
              }}
            >
              {/* Header */}
              <div className="flex items-center justify-between px-4 py-3 border-b border-white/8">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-lg bg-primary/20 flex items-center justify-center">
                    <span className="text-primary text-xs font-bold">S</span>
                  </div>
                  <span className="text-sm font-semibold text-foreground">Studio Sound Control</span>
                </div>
                <button
                  onClick={onClose}
                  className="w-7 h-7 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-white/8 transition-all"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Bento Grid */}
              <div className="p-3 grid grid-cols-2 sm:grid-cols-3 gap-2">
                {navItems.map((item) => {
                  const isActive = location.pathname === item.path ||
                    (item.path !== '/dashboard' && location.pathname.startsWith(item.path));
                  return (
                    <Link
                      key={item.path}
                      to={item.path}
                      onClick={onClose}
                      className={cn(
                        'group relative flex flex-col gap-2 p-3.5 rounded-xl border transition-all duration-200',
                        'hover:-translate-y-0.5 hover:shadow-lg',
                        isActive
                          ? 'border-primary/40 bg-primary/10 text-primary'
                          : 'border-white/6 bg-white/4 text-foreground hover:border-white/14 hover:bg-white/8'
                      )}
                    >
                      <div className={cn(
                        'w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 transition-colors',
                        isActive ? 'bg-primary/20' : 'bg-white/8 group-hover:bg-white/14'
                      )}>
                        <item.icon className="w-4 h-4" />
                      </div>
                      <div>
                        <p className="text-sm font-medium leading-tight">{item.label}</p>
                        <p className={cn(
                          'text-xs mt-0.5 leading-tight',
                          isActive ? 'text-primary/70' : 'text-muted-foreground'
                        )}>
                          {item.desc}
                        </p>
                      </div>
                      {isActive && (
                        <div className="absolute top-2.5 right-2.5 w-1.5 h-1.5 rounded-full bg-primary" />
                      )}
                    </Link>
                  );
                })}
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}