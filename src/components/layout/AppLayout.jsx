import AppHeader from './AppHeader';
import MobileNav from './MobileNav';
import { Outlet } from 'react-router-dom';

export default function AppLayout() {
  return (
    <div className="min-h-screen aurora-bg">
      <AppHeader />
      {/* No sidebar — main content uses full width, offset only for fixed header */}
      <main className="pt-14 min-h-screen pb-16 md:pb-0">
        <Outlet />
      </main>
      <MobileNav />
    </div>
  );
}