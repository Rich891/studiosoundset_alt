import { useCallback, useEffect, useRef, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import {
  AlertCircle, CheckCircle2, LogOut, Music2, Pause, Play,
  RefreshCw, SkipBack, SkipForward, Volume2, Wifi, WifiOff
} from 'lucide-react';
import { toast } from 'sonner';
import { formatMs, nowIso } from '@/lib/studioSoundSetRuntime';
import {
  SPOTIFY_SCOPES,
  randomString,
  createCodeChallenge,
  getTokenExpiryIso,
  tokenLooksUsable,
} from '@/lib/spotifyPkceAuth';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const TOKEN_URL = 'https://accounts.spotify.com/api/token';
const PKCE_VERIFIER_KEY = 'sss_player_pkce_verifier';

// ---------- localStorage token helpers ----------

function getAuthKey(playerId) {
  return `sss_player_spotify_auth_${playerId}`;
}

function readLocalAuth(playerId) {
  try { return JSON.parse(localStorage.getItem(getAuthKey(playerId))) || null; }
  catch { return null; }
}

function saveLocalAuth(playerId, data) {
  localStorage.setItem(getAuthKey(playerId), JSON.stringify(data));
}

function clearLocalAuth(playerId) {
  localStorage.removeItem(getAuthKey(playerId));
}

// ---------- PKCE helpers ----------

async function startSpotifyPkce(clientId, playerId) {
  const verifier = randomString(96);
  const challenge = await createCodeChallenge(verifier);
  sessionStorage.setItem(PKCE_VERIFIER_KEY, JSON.stringify({ verifier, playerId }));

  const redirectUri = `${window.location.origin}/player-new`;
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: clientId,
    scope: SPOTIFY_SCOPES,
    redirect_uri: redirectUri,
    state: `player_${playerId}`,
    code_challenge_method: 'S256',
    code_challenge: challenge,
    show_dialog: 'true',
  });
  window.location.href = `https://accounts.spotify.com/authorize?${params.toString()}`;
}

async function exchangeCode({ code, clientId, redirectUri }) {
  const raw = sessionStorage.getItem(PKCE_VERIFIER_KEY);
  if (!raw) throw new Error('PKCE Verifier fehlt. Starte Spotify Connect erneut.');
  const { verifier } = JSON.parse(raw);

  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri,
      client_id: clientId,
      code_verifier: verifier,
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error_description || data.error || `Token Exchange Error ${res.status}`);
  sessionStorage.removeItem(PKCE_VERIFIER_KEY);
  return data;
}

async function refreshToken({ refreshToken: rt, clientId }) {
  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: rt,
      client_id: clientId,
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error_description || data.error || `Token Refresh Error ${res.status}`);
  return data;
}

// ---------- Main component ----------

function readStoredPlayer() {
  try { return JSON.parse(localStorage.getItem('player')) || null; }
  catch { return null; }
}

function getTrackFromState(s) {
  return s?.track_window?.current_track || null;
}

export default function PlayerRuntime({ exchangeCode: pendingCode, exchangeRedirectUri }) {
  const player = readStoredPlayer();
  const playerId = player?.id;
  const clientId = player?.spotifyClientId || player?.clientId || '';

  const [auth, setAuth] = useState(() => readLocalAuth(playerId));
  const [exchanging, setExchanging] = useState(!!pendingCode);
  const [exchangeError, setExchangeError] = useState('');

  const [status, setStatus] = useState('idle');
  const [error, setError] = useState('');
  const [sdkReady, setSdkReady] = useState(false);
  const [sdkConnected, setSdkConnected] = useState(false);
  const [deviceId, setDeviceId] = useState('');
  const [state, setState] = useState(null);
  const [volume, setVolume] = useState(50);
  const [heartbeatOk, setHeartbeatOk] = useState(false);

  const spotifyPlayerRef = useRef(null);
  const sdkLoadedRef = useRef(false);

  // --- Exchange OAuth code on mount if coming back from Spotify ---
  useEffect(() => {
    if (!pendingCode || !clientId) { setExchanging(false); return; }
    (async () => {
      try {
        const data = await exchangeCode({
          code: pendingCode,
          clientId,
          redirectUri: exchangeRedirectUri || `${window.location.origin}/player-new`,
        });
        const newAuth = {
          accessToken: data.access_token,
          refreshToken: data.refresh_token,
          expiresAt: getTokenExpiryIso(data.expires_in),
        };
        saveLocalAuth(playerId, newAuth);
        setAuth(newAuth);
        // Clean URL
        window.history.replaceState({}, '', '/player-new');
      } catch (e) {
        setExchangeError(e.message);
      } finally {
        setExchanging(false);
      }
    })();
  }, []);

  // --- Load Spotify Web Playback SDK script ---
  useEffect(() => {
    if (window.Spotify) { sdkLoadedRef.current = true; return; }
    const script = document.createElement('script');
    script.src = 'https://sdk.scdn.co/spotify-player.js';
    script.async = true;
    document.body.appendChild(script);
    window.onSpotifyWebPlaybackSDKReady = () => { sdkLoadedRef.current = true; };
    return () => {
      window.onSpotifyWebPlaybackSDKReady = null;
      if (script.parentNode) script.parentNode.removeChild(script);
    };
  }, []);

  // --- Get a fresh access token (refresh if needed) ---
  const getAccessToken = useCallback(async () => {
    let current = readLocalAuth(playerId);
    if (!current?.accessToken) throw new Error('Kein Spotify Token. Bitte Spotify verbinden.');

    const expiresAt = current.expiresAt ? new Date(current.expiresAt).getTime() : 0;
    const needsRefresh = expiresAt > 0 && Date.now() > expiresAt - 60000;

    if (needsRefresh && current.refreshToken && clientId) {
      try {
        const data = await refreshToken({ refreshToken: current.refreshToken, clientId });
        current = {
          accessToken: data.access_token,
          refreshToken: data.refresh_token || current.refreshToken,
          expiresAt: getTokenExpiryIso(data.expires_in),
        };
        saveLocalAuth(playerId, current);
        setAuth(current);
      } catch (e) {
        clearLocalAuth(playerId);
        setAuth(null);
        throw new Error('Spotify Token abgelaufen. Bitte Spotify neu verbinden.');
      }
    }
    return current.accessToken;
  }, [playerId, clientId]);

  // --- Persist heartbeat to Player entity ---
  const persistState = useCallback(async (patch = {}) => {
    if (!playerId) return;
    const track = getTrackFromState(state);
    const data = {
      isOnline: true,
      lastSeen: nowIso(),
      sdkReady,
      sdkConnected,
      spotifyDeviceId: deviceId,
      isPlaying: state ? !state.paused : false,
      progressMs: state?.position || 0,
      currentTrackDuration: track?.duration_ms || 0,
      currentTrackName: track?.name || '',
      currentTrackArtist: track?.artists?.map((a) => a.name).join(', ') || '',
      currentTrackAlbum: track?.album?.name || '',
      currentTrackCoverUrl: track?.album?.images?.[0]?.url || '',
      volume,
      ...patch,
    };
    try {
      await base44.entities.Player.update(playerId, data);
      setHeartbeatOk(true);
    } catch {
      setHeartbeatOk(false);
    }
  }, [playerId, sdkReady, sdkConnected, deviceId, state, volume]);

  // --- Refresh playback state ---
  const refreshState = useCallback(async () => {
    if (!spotifyPlayerRef.current) return;
    const s = await spotifyPlayerRef.current.getCurrentState();
    setState(s);
    await persistState({ lastManualRefreshAt: nowIso() });
  }, [persistState]);

  // --- Initialize Spotify Web Playback SDK ---
  const initPlayer = useCallback(async () => {
    if (!playerId || !auth?.accessToken) return;
    setError('');
    setStatus('loading');
    try {
      let waited = 0;
      while (!window.Spotify && waited < 8000) { await sleep(200); waited += 200; }
      if (!window.Spotify) throw new Error('Spotify Web Playback SDK konnte nicht geladen werden.');

      const firstToken = await getAccessToken();

      const spotifyPlayer = new window.Spotify.Player({
        name: `StudioSoundSet - ${player.name || 'Player'}`,
        getOAuthToken: async (cb) => {
          try { cb(await getAccessToken()); }
          catch { cb(firstToken); }
        },
        volume: Math.max(0, Math.min(1, volume / 100)),
      });

      spotifyPlayer.addListener('ready', async ({ device_id }) => {
        setDeviceId(device_id);
        setSdkReady(true);
        setSdkConnected(true);
        setStatus('ready');
        toast.success('Player bereit.');
        await sleep(600);
        const s = await spotifyPlayer.getCurrentState();
        setState(s);
      });

      spotifyPlayer.addListener('not_ready', () => {
        setSdkReady(false);
        setSdkConnected(false);
        setStatus('offline');
        setError('Player temporär getrennt. Seite offen lassen oder neu laden.');
      });
      spotifyPlayer.addListener('player_state_changed', (s) => setState(s));
      spotifyPlayer.addListener('initialization_error', ({ message }) => { setError(`Init Fehler: ${message}`); setStatus('error'); });
      spotifyPlayer.addListener('authentication_error', ({ message }) => {
        setError(`Auth Fehler: ${message}`);
        setStatus('error');
        clearLocalAuth(playerId);
        setAuth(null);
      });
      spotifyPlayer.addListener('account_error', ({ message }) => { setError(`Spotify Premium erforderlich: ${message}`); setStatus('error'); });
      spotifyPlayer.addListener('playback_error', ({ message }) => setError(`Playback Fehler: ${message}`));

      const connected = await spotifyPlayer.connect();
      if (!connected) throw new Error('Spotify hat player.connect() abgelehnt.');
      spotifyPlayerRef.current = spotifyPlayer;
    } catch (e) {
      setError(e.message);
      setStatus('error');
      await persistState({ lastError: e.message, sdkReady: false });
    }
  }, [playerId, auth?.accessToken, player, volume, getAccessToken, persistState]);

  // Init when auth becomes available
  useEffect(() => {
    if (auth?.accessToken && !exchanging) {
      initPlayer();
    }
    return () => { if (spotifyPlayerRef.current) spotifyPlayerRef.current.disconnect(); };
  }, [auth?.accessToken, exchanging]);

  // Heartbeat
  useEffect(() => {
    if (!playerId) return;
    const id = setInterval(() => persistState(), 3000);
    return () => clearInterval(id);
  }, [playerId, persistState]);

  const run = async (action) => {
    try {
      if (!spotifyPlayerRef.current || !sdkReady) throw new Error('Player ist noch nicht bereit.');
      if (action === 'pause') await spotifyPlayerRef.current.pause();
      if (action === 'resume') await spotifyPlayerRef.current.resume();
      if (action === 'next') await spotifyPlayerRef.current.nextTrack();
      if (action === 'prev') await spotifyPlayerRef.current.previousTrack();
      await sleep(800);
      await refreshState();
    } catch (e) { setError(e.message); toast.error(e.message); }
  };

  const setSdkVolume = async (value) => {
    const next = Number(value);
    setVolume(next);
    try {
      if (spotifyPlayerRef.current && sdkReady) {
        await spotifyPlayerRef.current.setVolume(next / 100);
        const actual = Math.round((await spotifyPlayerRef.current.getVolume()) * 100);
        setVolume(actual);
        await persistState({ volume: actual });
      }
    } catch (e) { toast.error(e.message); }
  };

  const logout = () => {
    if (playerId) clearLocalAuth(playerId);
    localStorage.removeItem('player');
    localStorage.removeItem('playerSessionToken');
    window.location.reload();
  };

  // --- No player stored ---
  if (!playerId) {
    return (
      <div className="min-h-screen aurora-bg flex items-center justify-center p-6">
        <div className="bento-panel p-6 max-w-sm text-center">
          <AlertCircle className="w-8 h-8 text-yellow-400 mx-auto mb-3" />
          <p className="font-bold">Kein Player geladen</p>
          <p className="text-sm text-muted-foreground mt-1">Öffne den Player-Link aus dem Admin-Bereich erneut.</p>
        </div>
      </div>
    );
  }

  // --- Exchanging OAuth code ---
  if (exchanging) {
    return (
      <div className="min-h-screen aurora-bg flex items-center justify-center">
        <div className="flex flex-col items-center gap-3 text-muted-foreground">
          <RefreshCw className="w-8 h-8 text-primary animate-spin" />
          <p className="text-sm">Spotify wird verbunden...</p>
        </div>
      </div>
    );
  }

  // --- Exchange error ---
  if (exchangeError) {
    return (
      <div className="min-h-screen aurora-bg flex items-center justify-center p-6">
        <div className="bento-panel p-6 max-w-sm text-center space-y-4">
          <AlertCircle className="w-8 h-8 text-red-400 mx-auto" />
          <p className="font-bold text-red-300">Spotify Connect Fehler</p>
          <p className="text-sm text-muted-foreground">{exchangeError}</p>
          <Button onClick={() => { setExchangeError(''); setAuth(null); }}>Erneut versuchen</Button>
        </div>
      </div>
    );
  }

  // --- No Spotify token: show connect screen ---
  if (!auth?.accessToken) {
    return (
      <div className="min-h-screen aurora-bg flex flex-col items-center justify-center p-6 gap-6">
        <div className="w-16 h-16 rounded-2xl bg-green-500/10 border border-green-500/20 flex items-center justify-center">
          <Music2 className="w-8 h-8 text-green-400" />
        </div>
        <div className="text-center space-y-2">
          <h1 className="text-2xl font-black gradient-text">StudioSoundSet Player</h1>
          <p className="text-sm text-muted-foreground">{player.name || 'Player'}</p>
        </div>
        {!clientId ? (
          <div className="bento-panel p-5 max-w-sm text-center">
            <AlertCircle className="w-6 h-6 text-yellow-400 mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">Spotify Client ID fehlt. Öffne den Player-Link erneut aus dem Admin-Bereich.</p>
          </div>
        ) : (
          <Button
            size="lg"
            className="bg-green-500 hover:bg-green-600 text-black font-bold px-8 py-6 text-lg rounded-2xl gap-3"
            onClick={() => startSpotifyPkce(clientId, playerId)}
          >
            <Music2 className="w-6 h-6" />
            Spotify auf diesem Player verbinden
          </Button>
        )}
        <Button variant="ghost" size="sm" onClick={logout} className="text-muted-foreground">
          <LogOut className="w-4 h-4 mr-2" /> Logout
        </Button>
      </div>
    );
  }

  // --- Player UI ---
  const track = getTrackFromState(state);
  const isPlaying = state ? !state.paused : false;
  const progressMs = state?.position || 0;
  const durationMs = track?.duration_ms || 0;
  const progress = durationMs ? Math.min(100, (progressMs / durationMs) * 100) : 0;

  return (
    <div className="min-h-screen aurora-bg flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md mb-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center">
            <Music2 className="w-5 h-5 text-primary" />
          </div>
          <div>
            <p className="font-black gradient-text">StudioSoundSet Player</p>
            <p className="text-xs text-muted-foreground">{player.name || 'Player'}</p>
          </div>
        </div>
        <Button variant="ghost" size="sm" onClick={logout} className="gap-2">
          <LogOut className="w-4 h-4" />Logout
        </Button>
      </div>

      <div className="w-full max-w-md space-y-4">
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="bento-panel p-3 flex items-center gap-2">
            {sdkReady ? <Wifi className="w-4 h-4 text-green-400" /> : <WifiOff className="w-4 h-4 text-yellow-400" />}
            <span className={sdkReady ? 'text-green-400 font-semibold' : 'text-yellow-300'}>
              {sdkReady ? 'Player ready' : status === 'loading' ? 'Verbinde...' : 'Nicht bereit'}
            </span>
          </div>
          <div className="bento-panel p-3 flex items-center gap-2">
            {heartbeatOk ? <CheckCircle2 className="w-4 h-4 text-green-400" /> : <RefreshCw className="w-4 h-4 text-primary animate-spin" />}
            <span className="text-muted-foreground">Heartbeat {heartbeatOk ? 'OK' : 'wartet'}</span>
          </div>
        </div>

        {error && (
          <div className="bento-panel border-red-500/20 bg-red-500/5 p-3 flex gap-2">
            <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-red-300">{error}</p>
          </div>
        )}

        <div className="bento-panel p-6 space-y-6">
          <div className="text-center space-y-4">
            <div className="mx-auto w-56 h-56 rounded-2xl overflow-hidden bg-muted/20 flex items-center justify-center shadow-2xl">
              {track?.album?.images?.[0]?.url
                ? <img src={track.album.images[0].url} alt="cover" className="w-full h-full object-cover" />
                : <Music2 className="w-20 h-20 text-muted-foreground/20" />
              }
            </div>
            <div>
              <p className="font-black text-xl truncate">{track?.name || 'Keine Wiedergabe'}</p>
              <p className="text-sm text-muted-foreground truncate">
                {track?.artists?.map(a => a.name).join(', ') || 'Wähle eine Playlist im Admin'}
              </p>
            </div>
          </div>

          <div className="space-y-1">
            <div className="h-2 bg-muted rounded-full overflow-hidden">
              <div className="h-full bg-primary rounded-full" style={{ width: `${progress}%` }} />
            </div>
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>{formatMs(progressMs)}</span>
              <span>{durationMs ? formatMs(durationMs) : '--:--'}</span>
            </div>
          </div>

          <div className="flex items-center justify-center gap-6">
            <button onClick={() => run('prev')} disabled={!sdkReady} className="text-muted-foreground hover:text-foreground disabled:opacity-30">
              <SkipBack className="w-7 h-7" />
            </button>
            <button
              onClick={() => run(isPlaying ? 'pause' : 'resume')}
              disabled={!sdkReady}
              className={`w-16 h-16 rounded-full flex items-center justify-center disabled:opacity-30 ${isPlaying ? 'bg-white text-black' : 'bg-primary text-white'}`}
            >
              {isPlaying ? <Pause className="w-7 h-7" /> : <Play className="w-7 h-7 ml-0.5" />}
            </button>
            <button onClick={() => run('next')} disabled={!sdkReady} className="text-muted-foreground hover:text-foreground disabled:opacity-30">
              <SkipForward className="w-7 h-7" />
            </button>
          </div>

          <Button variant="outline" className="w-full gap-2" onClick={refreshState} disabled={!sdkReady}>
            <RefreshCw className="w-4 h-4" /> Refresh State
          </Button>

          <div className="space-y-3 rounded-xl border border-border/40 bg-background/40 p-4">
            <div className="flex items-center justify-between text-sm font-semibold">
              <span>Interne Player-Lautstärke</span><span>{volume}%</span>
            </div>
            <div className="flex items-center gap-3">
              <Volume2 className="w-4 h-4 text-muted-foreground" />
              <input type="range" min={0} max={100} value={volume}
                onChange={(e) => setVolume(Number(e.target.value))}
                onMouseUp={(e) => setSdkVolume(e.currentTarget.value)}
                onTouchEnd={(e) => setSdkVolume(e.currentTarget.value)}
                className="w-full"
              />
            </div>
            <div className="grid grid-cols-4 gap-2">
              {[25, 50, 75, 100].map(v => (
                <Button key={v} variant="outline" size="sm" onClick={() => setSdkVolume(v)}>{v}%</Button>
              ))}
            </div>
          </div>
        </div>

        <div className="bento-panel p-3 text-center text-xs text-muted-foreground">
          Bitte stelle die Gerätelautstärke auf 100 %. StudioSoundSet regelt die interne Player-Lautstärke.
        </div>
      </div>
    </div>
  );
}