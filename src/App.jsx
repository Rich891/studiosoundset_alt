import { Toaster } from "@/components/ui/toaster"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import { BrowserRouter as Router, Route, Routes, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import UserNotRegisteredError from '@/components/UserNotRegisteredError';

// Layout
import AppLayout from '@/components/layout/AppLayout';

// Pages
import Dashboard from './pages/Dashboard';
import Providers from './pages/Providers';
import AddProvider from './pages/AddProvider';
import Devices from './pages/Devices';
import AddDevice from './pages/AddDevice';
import Playlists from './pages/Playlists';
import ImportPlaylist from './pages/ImportPlaylist';
import Calendar from './pages/Calendar';
import NowPlaying from './pages/NowPlaying';
import Admin from './pages/Admin';
import SystemCheck from './pages/SystemCheck';
import HowItWorks from './pages/HowItWorks';
import Logs from './pages/Logs';
import Settings from './pages/Settings';
import NotFound from './pages/NotFound';

const AuthenticatedApp = () => {
  const { isLoadingAuth, isLoadingPublicSettings, authError, navigateToLogin } = useAuth();

  if (isLoadingPublicSettings || isLoadingAuth) {
    return (
      <div className="fixed inset-0 flex items-center justify-center aurora-bg">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
          <p className="text-sm text-muted-foreground">Lade App...</p>
        </div>
      </div>
    );
  }

  if (authError) {
    if (authError.type === 'user_not_registered') {
      return <UserNotRegisteredError />;
    } else if (authError.type === 'auth_required') {
      navigateToLogin();
      return null;
    }
  }

  return (
    <Routes>
      {/* Root redirect → Dashboard */}
      <Route path="/" element={<Navigate to="/dashboard" replace />} />

      {/* App with Layout */}
      <Route element={<AppLayout />}>
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/calendar" element={<Calendar />} />
        <Route path="/now-playing" element={<NowPlaying />} />
        <Route path="/devices" element={<Devices />} />
        <Route path="/devices/add" element={<AddDevice />} />
        <Route path="/providers" element={<Providers />} />
        <Route path="/providers/add" element={<AddProvider />} />
        <Route path="/playlists" element={<Playlists />} />
        <Route path="/playlists/import" element={<ImportPlaylist />} />
        <Route path="/admin" element={<Admin />} />
        <Route path="/admin/system-check" element={<SystemCheck />} />
        <Route path="/how-it-works" element={<HowItWorks />} />
        <Route path="/logs" element={<Logs />} />
        <Route path="/settings" element={<Settings />} />
      </Route>

      {/* 404 Fallback */}
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