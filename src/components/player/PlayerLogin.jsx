import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { AlertCircle, Loader } from 'lucide-react';
import { toast } from 'sonner';

export default function PlayerLogin({ onLoginSuccess, onLoginFail }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Check if credentials are in localStorage from pairing
  useEffect(() => {
    const storedEmail = localStorage.getItem('playerEmail');
    const storedPassword = localStorage.getItem('playerPassword');
    if (storedEmail && storedPassword) {
      setEmail(storedEmail);
      setPassword(storedPassword);
      // Auto-login
      handleLogin(storedEmail, storedPassword);
    }
  }, []);

  const handleLogin = async (loginEmail, loginPassword) => {
    setLoading(true);
    setError('');
    try {
      // First redirect to login page with email
      await base44.auth.redirectToLogin();
      
      // After successful login, onLoginSuccess will be called
      onLoginSuccess(loginEmail, loginPassword);
    } catch (e) {
      const msg = e.message || 'Login fehlgeschlagen';
      setError(msg);
      onLoginFail(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen aurora-bg flex items-center justify-center p-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="flex flex-col items-center gap-3 text-center">
          <div className="w-12 h-12 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center">
            <svg className="w-6 h-6 text-primary" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm3.5-9c.83 0 1.5-.67 1.5-1.5S16.33 8 15.5 8 14 8.67 14 9.5s.67 1.5 1.5 1.5zm-7 0c.83 0 1.5-.67 1.5-1.5S9.33 8 8.5 8 7 8.67 7 9.5 7.67 11 8.5 11zm3.5 6.5c2.33 0 4.31-1.46 5.11-3.5H6.89c.8 2.04 2.78 3.5 5.11 3.5z" />
            </svg>
          </div>
          <div>
            <h1 className="text-2xl font-black gradient-text">StudioSoundSet</h1>
            <p className="text-sm text-muted-foreground mt-1">Player Login</p>
          </div>
        </div>

        <div className="bento-panel p-6 space-y-4">
          {error && (
            <div className="flex gap-2 p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-xs text-red-400">
              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <div>{error}</div>
            </div>
          )}

          <div>
            <label className="text-sm font-semibold block mb-2">Email</label>
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="player-xxx@studio"
              disabled={loading}
              className="h-10"
            />
          </div>

          <div>
            <label className="text-sm font-semibold block mb-2">Passwort</label>
            <Input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              disabled={loading}
              className="h-10"
            />
          </div>

          <Button
            className="w-full bg-primary hover:bg-primary/90 font-bold h-11"
            disabled={!email || !password || loading}
            onClick={() => handleLogin(email, password)}
          >
            {loading ? (
              <>
                <Loader className="w-4 h-4 mr-2 animate-spin" />
                Anmelden...
              </>
            ) : (
              'Anmelden'
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}