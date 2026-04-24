import { Link, useLocation } from 'react-router-dom';
import { LayoutDashboard, Calendar, Radio, Cpu, Music2, MoreHorizontal } from 'lucide-react';
import { cn } from '@/lib/utils';

const mobileNavItems = [
  { icon: LayoutDashboard, label: 'Dashboard', path: '/' },
  { icon: Radio, label: 'Playing', path: '/now-playing' },
  { icon: Calendar, label: 'Kalender', path: '/calendar' },
  { icon: Music2, label: 'Playlists', path: '/playlists' },
  { icon: Cpu, label: 'Mehr', path: '/devices' },
];

export default function MobileNav() {
  const location = useLocation();

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-card/95 backdrop-blur-md border-t border-border z-50 md:hidden">
      <ul className="flex items-center justify-around px-2 py-2">
        {mobileNavItems.map((item) => {
          const active = location.pathname === item.path || 
            (item.path !== '/' && location.pathname.startsWith(item.path));
          return (
            <li key={item.path}>
              <Link
                to={item.path}
                className={cn(
                  'flex flex-col items-center gap-1 px-3 py-1.5 rounded-lg transition-all',
                  active ? 'text-primary' : 'text-muted-foreground'
                )}
              >
                <item.icon className="w-5 h-5" />
                <span className="text-xs font-medium">{item.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}