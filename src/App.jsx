import { Toaster } from "@/components/ui/toaster";
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClientInstance } from '@/lib/query-client';
import { BrowserRouter as Router, Route, Routes, Navigate } from 'react-router-dom';
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

const AuthenticatedApp = () => {
  const { isLoadingAuth, isLoadingPublicSettings, authError, navigateToLogin, isAuthenticated } = useAuth();

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

  // SpotifyCallback is handled before auth check (see Routes below)
  // If not authenticated and not on callback page, redirect to login
  if (!isLoadingAuth && !isAuthenticated && window.location.pathname !== '/spotify-callback') {
    navigateToLogin();
    return null;
  }

  return (
    <Routes>
      <Route path="/" element={<Navigate to="/dashboard" replace />} />

      {/* Spotify OAuth callback — MUST be outside auth gate, Spotify redirects lose session */}
      <Route path="/spotify-callback" element={<SpotifyCallback />} />

      {/* App with Layout */}
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