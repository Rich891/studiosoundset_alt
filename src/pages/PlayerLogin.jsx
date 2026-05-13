import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { AlertCircle, Music2, Loader } from 'lucide-react';
import { toast } from 'sonner';

export default function PlayerLogin() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const response = await base44.functions.invoke('playerAuthLogin', {
        email,
        password,
      });

      if (response.data?.success) {
        // Speichere Session-Token
        localStorage.setItem('playerSessionToken', response.data.sessionToken);
        localStorage.setItem('playerUser', JSON.stringify(response.data.playerUser));
        
        // Reload page um Player zu laden
        window.location.reload();
      } else {
        setError(response.data?.error || 'Login fehlgeschlagen');
      }
    } catch (e) {
      setError('Fehler: ' + e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen aurora-bg flex items-center justify-center p-4">
      <div className="w-full max-w-sm space-y-6">
        {/* Header */}
        <div className="flex flex-col items-center gap-3 text-center">
          <div className="w-12 h-12 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center">
            <Music2 className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-black gradient-text">StudioSoundSet</h1>
            <p className="text-sm text-muted-foreground mt-1">Player Login</p>
          </div>
        </div>

        {/* Login Form */}
        <form onSubmit={handleLogin} className="bento-panel p-6 space-y-4">
          {error && (
            <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3 flex gap-3">
              <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-red-300">{error}</p>
            </div>
          )}

          <div>
            <label className="text-xs font-semibold text-muted-foreground mb-2 block">
              Player ID
            </label>
            <Input
              type="text"
              placeholder="player-xxx@studio"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={loading}
              className="bg-background/50"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-muted-foreground mb-2 block">
              Passwort
            </label>
            <Input
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={loading}
              className="bg-background/50"
            />
          </div>

          <Button
            type="submit"
            disabled={loading || !email || !password}
            className="w-full h-10 bg-primary hover:bg-primary/90 font-semibold"
          >
            {loading ? (
              <>
                <Loader className="w-4 h-4 animate-spin mr-2" />
                Anmelden...
              </>
            ) : (
              'Anmelden'
            )}
          </Button>
        </form>

        <p className="text-xs text-muted-foreground text-center">
          Wende dich an den Admin um einen Player zu registrieren
        </p>
      </div>
    </div>
  );
}