import { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { appParams } from '@/lib/app-params';
import { CheckCircle2, XCircle, RefreshCw, LogIn } from 'lucide-react';
import { Button } from '@/components/ui/button';

// Dynamisch basierend auf aktuellem Origin
const getRedirectUri = () => window.location.origin + '/spotify-callback';

export default function SpotifyCallback() {
  const [status, setStatus] = useState('loading');
  const [message, setMessage] = useState('');
  const [detail, setDetail] = useState('');
  const [accountName, setAccountName] = useState('');
  const navigate = useNavigate();
  const hasRun = useRef(false);

  useEffect(() => {
    if (hasRun.current) return;
    hasRun.current = true;
    handleCallback();
  }, []);

  const handleCallback = async () => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');
    const state = params.get('state'); // accountId
    const error = params.get('error');

    setDetail(`code=${code ? code.substring(0, 10) + '...' : 'MISSING'}, state=${state || 'MISSING'}, error=${error || 'none'}`);

    if (error) {
      setStatus('error');
      setMessage(`Spotify hat die Verbindung abgelehnt: ${error}`);
      return;
    }
    if (!code || !state) {
      setStatus('error');
      setMessage('Ungültige Callback-Parameter (code oder state fehlt).');
      return;
    }

    // Check if we have an auth token in localStorage
    const token = appParams.token;
    if (!token) {
      // No session — save the callback params and redirect to login
      // After login, user will come back here (via from_url in SDK)
      sessionStorage.setItem('spotify_callback_code', code);
      sessionStorage.setItem('spotify_callback_state', state);
      setStatus('needs_login');
      setMessage('Du musst eingeloggt sein um den Spotify Account zu verbinden.');
      return;
    }

    await doExchange(code, state, token);
  };

  const doExchange = async (code, state, token) => {
    setStatus('loading');
    setMessage('Verbinde mit Spotify...');

    try {
      // Get provider with credentials
      let provider = null;
      try {
        const providers = await base44.entities.Provider.list();
        provider = providers.find(p => p.id === state);
        if (provider) setAccountName(provider.name);
      } catch {}

      if (!provider || !provider.clientId || !provider.clientSecret) {
        setStatus('error');
        setMessage('Provider hat keine Spotify Credentials. Bitte aktualisieren Sie den Provider.');
        return;
      }

      const res = await base44.functions.invoke('spotifyAuth', {
        action: 'exchange',
        code,
        redirectUri: getRedirectUri(),
        providerId: state,
        clientId: provider.clientId,
        clientSecret: provider.clientSecret,
      });

      if (res.data?.success) {
        setStatus('success');
        setMessage('Spotify Provider erfolgreich verbunden!');
        setTimeout(() => navigate('/spotify-accounts'), 2500);
      } else {
        setStatus('error');
        setMessage(res.data?.error || 'Token-Austausch fehlgeschlagen.');
      }
    } catch (e) {
      setStatus('error');
      setMessage(`Fehler: ${e.message}`);
    }
  };

  const handleLoginAndRetry = () => {
    // The SDK will redirect back to this URL after login
    base44.auth.redirectToLogin(window.location.href);
  };

  const handleRetryFromStorage = async () => {
    const code = sessionStorage.getItem('spotify_callback_code');
    const state = sessionStorage.getItem('spotify_callback_state');
    if (code && state) {
      sessionStorage.removeItem('spotify_callback_code');
      sessionStorage.removeItem('spotify_callback_state');
      await doExchange(code, state, appParams.token);
    }
  };

  // Check if we came back after login with stored params
  useEffect(() => {
    const storedCode = sessionStorage.getItem('spotify_callback_code');
    const storedState = sessionStorage.getItem('spotify_callback_state');
    if (storedCode && storedState && appParams.token && !hasRun.current) {
      // We're back after login
      handleRetryFromStorage();
    }
  }, []);

  return (
    <div className="min-h-screen aurora-bg flex items-center justify-center p-6">
      <div className="glass-card rounded-2xl p-10 max-w-md w-full text-center space-y-5">

        {status === 'loading' && (
          <>
            <RefreshCw className="w-12 h-12 text-primary animate-spin mx-auto" />
            <h2 className="text-xl font-bold">Spotify verbinden...</h2>
            <p className="text-muted-foreground text-sm">{message || 'Token wird ausgetauscht.'}</p>
            {detail && <p className="text-xs text-muted-foreground/50 font-mono break-all">{detail}</p>}
          </>
        )}

        {status === 'needs_login' && (
          <>
            <LogIn className="w-12 h-12 text-yellow-400 mx-auto" />
            <h2 className="text-xl font-bold text-yellow-400">Login erforderlich</h2>
            <p className="text-sm text-muted-foreground">{message}</p>
            <p className="text-xs text-muted-foreground">
              Klicke unten um dich einzuloggen. Danach wird die Verbindung automatisch abgeschlossen.
            </p>
            <Button className="w-full bg-primary" onClick={handleLoginAndRetry}>
              <LogIn className="w-4 h-4 mr-2" /> Einloggen & Verbinden
            </Button>
            {detail && <p className="text-xs text-muted-foreground/50 font-mono break-all">{detail}</p>}
          </>
        )}

        {status === 'success' && (
          <>
            <CheckCircle2 className="w-12 h-12 text-green-400 mx-auto" />
            <h2 className="text-xl font-bold text-green-400">Verbindung erfolgreich!</h2>
            {accountName && <p className="text-muted-foreground text-sm">Account: <strong>{accountName}</strong></p>}
            <p className="text-sm text-muted-foreground">{message}</p>
            <p className="text-xs text-muted-foreground">Weiterleitung in 2 Sekunden...</p>
            <Button variant="outline" className="w-full" onClick={() => navigate('/spotify-accounts')}>
              Jetzt weiterleiten
            </Button>
          </>
        )}

        {status === 'error' && (
          <>
            <XCircle className="w-12 h-12 text-destructive mx-auto" />
            <h2 className="text-xl font-bold text-destructive">Verbindung fehlgeschlagen</h2>
            <p className="text-sm text-muted-foreground">{message}</p>
            {detail && (
              <details className="text-left">
                <summary className="text-xs text-muted-foreground cursor-pointer">Details</summary>
                <p className="text-xs text-muted-foreground/60 font-mono mt-1 break-all">{detail}</p>
              </details>
            )}
            <Button className="w-full" onClick={() => navigate('/spotify-accounts')}>
              Zurück zu Spotify Accounts
            </Button>
          </>
        )}

      </div>
    </div>
  );
}