import { Toaster } from "@/components/ui/toaster";
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClientInstance } from '@/lib/query-client';
import { BrowserRouter as Router, Route, Routes, Navigate, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import UserNotRegisteredError from '@/components/UserNotRegisteredError';

// Layout
import AppLayout from '@/components/layout/AppLayout';

// Pages
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
import NotFound from './pages/NotFound';
import Player from './pages/Player';
import PlayerNew from './pages/PlayerNew';
import AddPlayerDevice from './pages/AddPlayerDevice';
import PlayerPairing from './pages/PlayerPairing';
import PlayerUsers from './pages/PlayerUsers';
import ManagePlayerDevices from './pages/ManagePlayerDevices';
import PlayerLoginIndex from './pages/PlayerLoginIndex';

const AuthenticatedApp = () => {
  const { isLoadingAuth, isLoadingPublicSettings, authError, navigateToLogin, isAuthenticated } = useAuth();
  const location = useLocation();

  // Public routes that don't need admin auth
  if (location.pathname === '/' || location.pathname === '/spotify-callback' || location.pathname === '/player-pairing' || location.pathname === '/player-new') {
    return (
      <Routes>
        <Route path="/" element={<PlayerLoginIndex />} />
        <Route path="/spotify-callback" element={<SpotifyCallback />} />
        <Route path="/player-pairing" element={<PlayerPairing />} />
        <Route path="/player-new" element={<PlayerNew />} />
      </Routes>
    );
  }

  if (isLoadingPublicSettings || isLoadingAuth) {
    return (
      <div className="fixed inset-0 flex items-center justify-center aurora-bg">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
          <p className="text-sm text-muted-foreground">Lade StudioSoundSet...</p>
        </div>
      </div>
    );
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
        <Route path="/logs" element={<Logs />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="/player" element={<Player />} />
        <Route path="/add-player-device" element={<AddPlayerDevice />} />
        <Route path="/player-users" element={<PlayerUsers />} />
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
        </Router>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;