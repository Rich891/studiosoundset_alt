import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { CheckCircle2, AlertCircle, Loader2, Copy } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function SpotifyConnect() {
  const navigate = useNavigate();
  const [status, setStatus] = useState('idle');
  const [message, setMessage] = useState('');
  const [copied, setCopied] = useState(false);

  const urlParams = new URLSearchParams(window.location.search);
  const code = urlParams.get('code');
  const error = urlParams.get('error');
  const providerId = urlParams.get('state');
  const connectParam = urlParams.get('connect');

  // The redirect URI must match EXACTLY what's in Spotify Dashboard
  const redirectUri = `${window.location.origin}/spotify-connect`;

  const copyRedirectUri = () => {
    navigator.clipboard.writeText(redirectUri);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleConnect = async (pId) => {
    const targetProviderId = pId || providerId || 'default';
    setStatus('loading');
    try {
      const res = await base44.functions.invoke('spotifyAuth', {
        action: 'getAuthUrl',
        redirectUri,
        providerId: targetProviderId,
      });
      if (res.data?.url) {
        window.location.href = res.data.url;
      } else {
        setStatus('error');
        setMessage('Konnte Auth-URL nicht laden: ' + (res.data?.error || 'Unbekannt'));
      }
    } catch (e) {
      setStatus('error');
      setMessage('Fehler: ' + e.message);
    }
  };

  // Handle callback from Spotify (code in URL)
  useEffect(() => {
    if (error) {
      setStatus('error');
      setMessage(`Spotify hat die Verbindung abgelehnt: "${error}". Stelle sicher, dass die Redirect URI im Spotify Dashboard eingetragen ist.`);
      return;
    }

    if (code && providerId) {
      setStatus('exchanging');
      base44.functions.invoke('spotifyAuth', {
        action: 'exchange',
        code,
        redirectUri,
        providerId,
      }).then((res) => {
        if (res.data?.success) {
          setStatus('success');
          setMessage('Spotify wurde erfolgreich verbunden!');
          window.history.replaceState({}, document.title, '/spotify-connect?connected=1');
        } else {
          setStatus('error');
          setMessage(res.data?.error || 'Token-Austausch fehlgeschlagen.');
        }
      }).catch((e) => {
        setStatus('error');
        setMessage(e.message || 'Unbekannter Fehler.');
      });
      return;
    }

    // Triggered from providers page with ?connect=providerId
    if (connectParam) {
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

        {/* Redirect URI Info - always visible */}
        <div className="bg-muted/40 border border-border rounded-xl p-3 text-left">
          <p className="text-xs text-muted-foreground mb-1.5 font-medium">Diese URI muss im Spotify Dashboard eingetragen sein:</p>
          <div className="flex items-center gap-2">
            <code className="text-xs text-primary flex-1 break-all">{redirectUri}</code>
            <button onClick={copyRedirectUri} className="flex-shrink-0 text-muted-foreground hover:text-foreground">
              <Copy className="w-3.5 h-3.5" />
            </button>
          </div>
          {copied && <p className="text-xs text-green-400 mt-1">✓ Kopiert!</p>}
        </div>

        {(status === 'idle' || status === 'loading') && !connectParam && (
          <div className="space-y-3">
            <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-xl p-3 text-xs text-yellow-400 text-left">
              ⚠️ Nur für private/Test-Nutzung. Für gewerbliche Nutzung lizenzierte Dienste verwenden.
            </div>
            <Button
              className="w-full bg-green-600 hover:bg-green-500 text-white"
              onClick={() => handleConnect()}
              disabled={status === 'loading'}
            >
              {status === 'loading' ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Mit Spotify verbinden
            </Button>
          </div>
        )}

        {(status === 'exchanging' || (connectParam && status !== 'error' && status !== 'success')) && (
          <div className="flex flex-col items-center gap-3 py-4">
            <Loader2 className="w-8 h-8 text-primary animate-spin" />
            <p className="text-sm text-muted-foreground">
              {status === 'exchanging' ? 'Token wird ausgetauscht...' : 'Weiterleitung zu Spotify...'}
            </p>
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
              <p className="text-sm text-destructive text-left">{message}</p>
            </div>
            <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-3 text-xs text-blue-400 text-left">
              <p className="font-medium mb-1">📋 Checkliste:</p>
              <ol className="space-y-1 list-decimal list-inside">
                <li>Gehe zu <a href="https://developer.spotify.com/dashboard" target="_blank" className="underline">developer.spotify.com/dashboard</a></li>
                <li>Wähle deine App (Client ID: <code className="text-xs">661e865b...</code>)</li>
                <li>Edit Settings → Redirect URIs → URI oben kopieren und einfügen</li>
                <li>Save klicken</li>
              </ol>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => navigate('/providers')}>Abbrechen</Button>
              <Button className="flex-1 bg-primary hover:bg-primary/90" onClick={() => handleConnect(providerId || connectParam)}>
                Erneut versuchen
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}