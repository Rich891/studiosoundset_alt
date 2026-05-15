import { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { appParams } from '@/lib/app-params';
import { CheckCircle2, XCircle, RefreshCw, LogIn } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { exchangeSpotifyCodeWithPkce, fetchSpotifyMe, getSpotifyRedirectUri, getTokenExpiryIso } from '@/lib/spotifyPkceAuth';

export default function SpotifyCallback() {
  const [status, setStatus] = useState('loading');
  const [message, setMessage] = useState('');
  const [detail, setDetail] = useState('');
  const [accountName, setAccountName] = useState('');
  const navigate = useNavigate();
  const hasRun = useRef(false);

  useEffect(() => { if (hasRun.current) return; hasRun.current = true; handleCallback(); }, []);

  const handleCallback = async () => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');
    const state = params.get('state');
    const error = params.get('error');
    setDetail(`code=${code ? code.substring(0, 10) + '...' : 'MISSING'}, state=${state || 'MISSING'}, error=${error || 'none'}, redirectUri=${getSpotifyRedirectUri()}`);
    if (error) { setStatus('error'); setMessage(`Spotify hat die Verbindung abgelehnt: ${error}`); return; }
    if (!code || !state) { setStatus('error'); setMessage('Ungültige Callback-Parameter (code oder state fehlt).'); return; }
    if (!appParams.token) {
      sessionStorage.setItem('spotify_callback_code', code);
      sessionStorage.setItem('spotify_callback_state', state);
      setStatus('needs_login');
      setMessage('Du musst als Admin eingeloggt sein, um den Spotify Provider zu verbinden.');
      return;
    }
    await doExchange(code, state);
  };

  const doExchange = async (code, state) => {
    setStatus('loading');
    setMessage('Verbinde mit Spotify...');
    let provider = null;
    try {
      const providers = await base44.entities.Provider.list();
      provider = providers.find(p => p.id === state);
      if (provider) setAccountName(provider.name || provider.displayName || 'Spotify Provider');
      if (!provider || !provider.clientId) {
        setStatus('error');
        setMessage('Provider hat keine Spotify Client ID. Bitte Provider bearbeiten und erneut versuchen.');
        return;
      }

      const tokenData = await exchangeSpotifyCodeWithPkce({
        code,
        state,
        provider,
        redirectUri: getSpotifyRedirectUri(),
      });
      const profile = await fetchSpotifyMe(tokenData.access_token);

      await base44.entities.Provider.update(state, {
        status: 'connected',
        authStatus: 'connected',
        tokenStatus: 'valid',
        oauthFlow: 'pkce',
        accessToken: tokenData.access_token,
        refreshToken: tokenData.refresh_token || provider.refreshToken || '',
        tokenExpiresAt: getTokenExpiryIso(tokenData.expires_in),
        scope: tokenData.scope || provider.scope || '',
        lastError: '',
        redirectUri: getSpotifyRedirectUri(),
        connectedAt: new Date().toISOString(),
        spotifyUserEmail: profile.email || provider.spotifyUserEmail || '',
        spotifyUserId: profile.id || provider.spotifyUserId || '',
        spotifyDisplayName: profile.display_name || provider.spotifyDisplayName || '',
      }).catch(() => {});
      setStatus('success');
      setMessage('Spotify Provider erfolgreich verbunden.');
      setTimeout(() => navigate('/spotify-accounts'), 1800);
    } catch (e) {
      if (provider?.id) await base44.entities.Provider.update(provider.id, { status: 'error', authStatus: 'error', lastError: e.message }).catch(() => {});
      setStatus('error');
      setMessage(`Fehler: ${e.message}`);
    }
  };

  const handleLoginAndRetry = () => base44.auth.redirectToLogin(window.location.href);

  return (
    <div className="min-h-screen aurora-bg flex items-center justify-center p-6">
      <div className="glass-card rounded-2xl p-10 max-w-md w-full text-center space-y-5">
        {status === 'loading' && <><RefreshCw className="w-12 h-12 text-primary animate-spin mx-auto" /><h2 className="text-xl font-bold">Spotify verbinden...</h2><p className="text-muted-foreground text-sm">{message || 'Token wird ausgetauscht.'}</p>{detail && <p className="text-xs text-muted-foreground/50 font-mono break-all">{detail}</p>}</>}
        {status === 'needs_login' && <><LogIn className="w-12 h-12 text-yellow-400 mx-auto" /><h2 className="text-xl font-bold text-yellow-400">Login erforderlich</h2><p className="text-sm text-muted-foreground">{message}</p><Button className="w-full bg-primary" onClick={handleLoginAndRetry}><LogIn className="w-4 h-4 mr-2" /> Einloggen & Verbinden</Button>{detail && <p className="text-xs text-muted-foreground/50 font-mono break-all">{detail}</p>}</>}
        {status === 'success' && <><CheckCircle2 className="w-12 h-12 text-green-400 mx-auto" /><h2 className="text-xl font-bold text-green-400">Verbindung erfolgreich</h2>{accountName && <p className="text-muted-foreground text-sm">Provider: <strong>{accountName}</strong></p>}<p className="text-sm text-muted-foreground">{message}</p><Button variant="outline" className="w-full" onClick={() => navigate('/spotify-accounts')}>Jetzt weiterleiten</Button></>}
        {status === 'error' && <><XCircle className="w-12 h-12 text-destructive mx-auto" /><h2 className="text-xl font-bold text-destructive">Verbindung fehlgeschlagen</h2><p className="text-sm text-muted-foreground">{message}</p>{detail && <details className="text-left"><summary className="text-xs text-muted-foreground cursor-pointer">Details</summary><p className="text-xs text-muted-foreground/60 font-mono mt-1 break-all">{detail}</p></details>}<Button className="w-full" onClick={() => navigate('/spotify-accounts')}>Zurück zu Spotify Provider</Button></>}
      </div>
    </div>
  );
}
