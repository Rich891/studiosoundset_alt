import AppHeader from './AppHeader';
import MobileNav from './MobileNav';
import { Outlet } from 'react-router-dom';

export default function AppLayout() {
  return (
    <div className="min-h-screen aurora-bg">
      <AppHeader />
      <main className="pt-14 min-h-screen pb-20 md:pb-0">
        <Outlet />
      </main>
      <MobileNav />
    </div>
  );
}