import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';



export default function SpotifyConnect() {
  const navigate = useNavigate();
  const [status, setStatus] = useState('idle'); // idle | exchanging | success | error
  const [message, setMessage] = useState('');
  const [profile, setProfile] = useState(null);

  // Read providerId from URL
  const urlParams = new URLSearchParams(window.location.search);
  const code = urlParams.get('code');
  const error = urlParams.get('error');
  const providerId = urlParams.get('state'); // we pass providerId as state

  useEffect(() => {
    if (error) {
      setStatus('error');
      setMessage('Spotify Autorisierung wurde abgelehnt.');
      return;
    }
    if (code && providerId) {
      // Exchange code for token
      setStatus('exchanging');
      const redirectUri = `${window.location.origin}/spotify-connect`;
      base44.functions.invoke('spotifyAuth', {
        action: 'exchange',
        code,
        redirectUri,
        providerId,
      }).then((res) => {
        if (res.data?.success) {
          setStatus('success');
          setMessage('Spotify wurde erfolgreich verbunden!');
          // Clean URL
          window.history.replaceState({}, document.title, '/spotify-connect?connected=1');
        } else {
          setStatus('error');
          setMessage(res.data?.error || 'Token-Austausch fehlgeschlagen.');
        }
      }).catch((e) => {
        setStatus('error');
        setMessage(e.message || 'Unbekannter Fehler.');
      });
    }
  }, []);

  const handleConnect = async (pId) => {
    const targetProviderId = pId || providerId || 'default';
    const redirectUri = `${window.location.origin}/spotify-connect`;
    const res = await base44.functions.invoke('spotifyAuth', {
      action: 'getAuthUrl',
      redirectUri,
      providerId: targetProviderId,
    });
    if (res.data?.url) {
      window.location.href = res.data.url;
    } else {
      setStatus('error');
      setMessage('Konnte Spotify-Auth-URL nicht laden. Bitte prüfe SPOTIFY_CLIENT_ID in den App-Secrets.');
    }
  };

  // Called from providers page with ?connect=providerId
  const connectParam = urlParams.get('connect');
  useEffect(() => {
    if (connectParam && !code && !error) {
      handleConnect(connectParam);
    }
  }, []);

  return (
    <div className="min-h-screen aurora-bg flex items-center justify-center p-6">
      <div className="glass-card rounded-2xl p-8 max-w-md w-full text-center space-y-6">
        <div className="w-16 h-16 rounded-2xl bg-green-500/15 flex items-center justify-center mx-auto">
          <span className="text-3xl">🎵</span>
        </div>
        <div>
          <h1 className="text-xl font-bold text-foreground">Spotify Verbindung</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Verbinde deinen Spotify-Account für Wiedergabe und Geräteverwaltung
          </p>
        </div>

        {status === 'idle' && !connectParam && (
          <div className="space-y-3">
            <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-xl p-3 text-xs text-yellow-400 text-left">
              ⚠️ Spotify ist nur für private/Test-Nutzung geeignet. Für gewerbliche Studiobeschallung bitte lizenzierte Dienste verwenden.
            </div>
            <Button
              className="w-full bg-green-600 hover:bg-green-500 text-white"
              onClick={() => handleConnect()}
            >
              Mit Spotify verbinden
            </Button>
          </div>
        )}

        {status === 'exchanging' && (
          <div className="flex flex-col items-center gap-3 py-4">
            <Loader2 className="w-8 h-8 text-primary animate-spin" />
            <p className="text-sm text-muted-foreground">Token wird ausgetauscht...</p>
          </div>
        )}

        {status === 'success' && (
          <div className="space-y-4">
            <div className="flex flex-col items-center gap-2">
              <CheckCircle2 className="w-10 h-10 text-green-500" />
              <p className="text-sm font-medium text-green-400">{message}</p>
            </div>
            <Button className="w-full bg-primary hover:bg-primary/90" onClick={() => navigate('/providers')}>
              Zurück zu Provider
            </Button>
          </div>
        )}

        {status === 'error' && (
          <div className="space-y-4">
            <div className="flex flex-col items-center gap-2">
              <AlertCircle className="w-10 h-10 text-destructive" />
              <p className="text-sm text-destructive">{message}</p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => navigate('/providers')}>Abbrechen</Button>
              <Button className="flex-1 bg-primary hover:bg-primary/90" onClick={() => handleConnect()}>Erneut versuchen</Button>
            </div>
          </div>
        )}

        {(status === 'exchanging' || connectParam) && status !== 'success' && status !== 'error' && (
          <div className="flex flex-col items-center gap-3 py-4">
            <Loader2 className="w-8 h-8 text-primary animate-spin" />
            <p className="text-sm text-muted-foreground">Weiterleitung zu Spotify...</p>
          </div>
        )}
      </div>
    </div>
  );
}