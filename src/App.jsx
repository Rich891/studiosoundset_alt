import { Toaster } from "@/components/ui/toaster";
import { Toaster as SonnerToaster } from 'sonner';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClientInstance } from '@/lib/query-client';
import { BrowserRouter as Router, Route, Routes, Navigate, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import UserNotRegisteredError from '@/components/UserNotRegisteredError';

import AppLayout from '@/components/layout/AppLayout';

import PublicLogin from './pages/PublicLogin';
import Dashboard from './pages/Dashboard';
import SpotifyAccounts from './pages/SpotifyAccounts';
import SpotifyCallback from './pages/SpotifyCallback';
import Zones from './pages/Zones';
import NowPlaying from './pages/NowPlaying';
import Playlists from './pages/Playlists';
import Calendar from './pages/Calendar';
import SystemCheck from './pages/SystemCheck';
import Logs from './pages/Logs';
import Settings from './pages/Settings';
import NetworkSettings from './pages/NetworkSettings';
import Commands from './pages/Commands';
import NotFound from './pages/NotFound';
import Player from './pages/Player';
import PlayerNewBootstrap from './pages/PlayerNewBootstrap';
import AddPlayerDevice from './pages/AddPlayerDevice';
import PlayerPairing from './pages/PlayerPairing';
import ManagePlayerDevices from './pages/ManagePlayerDevices';

const PUBLIC_PREFIXES = ['/', '/spotify-callback', '/player-pairing', '/player-new', '/player-login'];

function normalizePath(pathname = '/') {
  if (!pathname) return '/';
  if (pathname.length > 1 && pathname.endsWith('/')) return pathname.slice(0, -1);
  return pathname;
}

function isPublicPath(pathname = '/') {
  const path = normalizePath(pathname);
  return PUBLIC_PREFIXES.some((publicPath) => {
    if (publicPath === '/') return path === '/';
    return path === publicPath || path.startsWith(`${publicPath}/`);
  });
}

const AuthenticatedApp = () => {
  const { isLoadingAuth, isLoadingPublicSettings, authError, navigateToLogin, isAuthenticated } = useAuth();
  const location = useLocation();

  if (isPublicPath(location.pathname)) {
    return (
      <Routes>
        <Route path="/" element={<PublicLogin />} />
        <Route path="/spotify-callback" element={<SpotifyCallback />} />
        <Route path="/player-pairing" element={<PlayerPairing />} />
        <Route path="/player-new" element={<PlayerNewBootstrap />} />
        <Route path="/player-login" element={<Navigate to="/player-new" replace />} />
      </Routes>
    );
  }

  if (isLoadingPublicSettings || isLoadingAuth) {
    return <div className="fixed inset-0 flex items-center justify-center aurora-bg"><div className="flex flex-col items-center gap-3"><div className="w-8 h-8 border-4 border-primary/30 border-t-primary rounded-full animate-spin" /><p className="text-sm text-muted-foreground">Lade StudioSoundSet...</p></div></div>;
  }

  if (authError) {
    if (authError.type === 'user_not_registered') return <UserNotRegisteredError />;
    if (authError.type === 'auth_required') { navigateToLogin(); return null; }
  }

  if (!isAuthenticated) {
    navigateToLogin();
    return null;
  }

  return (
    <Routes>
      <Route path="/" element={<Navigate to="/dashboard" replace />} />
      <Route element={<AppLayout />}>
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/spotify-accounts" element={<SpotifyAccounts />} />
        <Route path="/zones" element={<Zones />} />
        <Route path="/now-playing" element={<NowPlaying />} />
        <Route path="/playlists" element={<Playlists />} />
        <Route path="/calendar" element={<Calendar />} />
        <Route path="/system-check" element={<SystemCheck />} />
        <Route path="/commands" element={<Commands />} />
        <Route path="/logs" element={<Logs />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="/settings/network" element={<NetworkSettings />} />
        <Route path="/player" element={<Player />} />
        <Route path="/add-player-device" element={<AddPlayerDevice />} />
        <Route path="/manage-players" element={<ManagePlayerDevices />} />
      </Route>
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
};

function App() {
  return (
    <QueryClientProvider client={queryClientInstance}>
      <AuthProvider>
        <Router>
          <AuthenticatedApp />
          <Toaster />
          <SonnerToaster richColors closeButton position="top-right" />
        </Router>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
