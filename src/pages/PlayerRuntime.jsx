import { useCallback, useEffect, useRef, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { AlertCircle, CheckCircle2, LogOut, Music2, Pause, Play, RefreshCw, SkipBack, SkipForward, Volume2, Wifi, WifiOff } from 'lucide-react';
import { toast } from 'sonner';
import { getPlayerProviderId } from '@/lib/playerAssignments';
import { formatMs, nowIso } from '@/lib/studioSoundSetRuntime';

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function readPlayer() {
  try { return JSON.parse(localStorage.getItem('player')) || null; }
  catch { return null; }
}

function normalizePlayer(player) {
  const providerId = getPlayerProviderId(player || {}, {});
  return {
    ...(player || {}),
    providerId,
    apiCredentialSetId: providerId,
    spotifyAccountId: providerId,
    role: 'player',
    isActive: true,
  };
}

async function getAccessToken(player) {
  const providerId = getPlayerProviderId(player || {}, {});
  if (!providerId) throw new Error('Dieser Player hat keine API-Verbindung. Erstelle im Admin einen neuen Player-Link oder weise dem Player eine API-Verbindung zu.');
  const res = await base44.functions.invoke('spotifyAccountControl', {
    action: 'getAccessToken',
    accountId: providerId,
    providerId,
    playerId: player.id,
  });
  if (!res?.data?.success || !res.data.accessToken) throw new Error(res?.data?.error || 'Kein Spotify Access Token verfügbar. Verbinde den Provider im Admin neu.');
  return res.data.accessToken;
}

function getTrackFromState(state) {
  return state?.track_window?.current_track || null;
}

export default function PlayerRuntime() {
  const [player, setPlayer] = useState(null);
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

  useEffect(() => {
    const stored = normalizePlayer(readPlayer());
    if (stored?.id) setPlayer(stored);
  }, []);

  useEffect(() => {
    if (window.Spotify) {
      sdkLoadedRef.current = true;
      return;
    }
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

  const persistState = useCallback(async (patch = {}) => {
    if (!player?.id) return;
    const track = getTrackFromState(state);
    const data = {
      isOnline: true,
      lastSeen: nowIso(),
      lastHeartbeatAt: nowIso(),
      sdkLoaded: true,
      sdkReady,
      sdkConnected,
      spotifyDeviceId: deviceId,
      providerId: getPlayerProviderId(player, {}),
      apiCredentialSetId: getPlayerProviderId(player, {}),
      spotifyAccountId: getPlayerProviderId(player, {}),
      isPlaying: state ? !state.paused : false,
      progressMs: state?.position || 0,
      currentTrackDuration: track?.duration_ms || 0,
      durationMs: track?.duration_ms || 0,
      currentTrackName: track?.name || '',
      currentTrackArtist: track?.artists?.map((a) => a.name).join(', ') || '',
      currentTrackAlbum: track?.album?.name || '',
      currentTrackCoverUrl: track?.album?.images?.[0]?.url || '',
      currentTrackUri: track?.uri || '',
      volume,
      ...patch,
    };
    try {
      await base44.entities.Player.update(player.id, data);
      setHeartbeatOk(true);
    } catch (e) {
      setHeartbeatOk(false);
    }
  }, [player, sdkReady, sdkConnected, deviceId, state, volume]);

  const refreshState = useCallback(async () => {
    if (!spotifyPlayerRef.current) return null;
    const s = await spotifyPlayerRef.current.getCurrentState();
    setState(s);
    await persistState({ lastManualRefreshAt: nowIso() });
    return s;
  }, [persistState]);

  const initPlayer = useCallback(async () => {
    if (!player?.id) return;
    setError('');
    setStatus('loading');
    try {
      let waited = 0;
      while (!window.Spotify && waited < 8000) { await sleep(200); waited += 200; }
      if (!window.Spotify) throw new Error('Spotify Web Playback SDK konnte nicht geladen werden.');

      const firstToken = await getAccessToken(player);
      const spotifyPlayer = new window.Spotify.Player({
        name: `StudioSoundSet - ${player.name || 'Player'}`,
        getOAuthToken: async (cb) => {
          try { cb(await getAccessToken(player)); }
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
        try {
          await base44.functions.invoke('spotifyAccountControl', {
            action: 'transferPlayback',
            accountId: getPlayerProviderId(player, {}),
            providerId: getPlayerProviderId(player, {}),
            playerId: player.id,
            deviceId: device_id,
          });
        } catch {}
        await sleep(600);
        const s = await spotifyPlayer.getCurrentState();
        setState(s);
      });

      spotifyPlayer.addListener('not_ready', () => {
        setSdkReady(false);
        setSdkConnected(false);
        setStatus('offline');
        setError('Player temporär getrennt. Seite geöffnet lassen oder neu laden.');
      });
      spotifyPlayer.addListener('player_state_changed', (s) => setState(s));
      spotifyPlayer.addListener('initialization_error', ({ message }) => { setError(`Spotify Init Fehler: ${message}`); setStatus('error'); });
      spotifyPlayer.addListener('authentication_error', ({ message }) => { setError(`Spotify Auth Fehler: ${message}. Provider neu verbinden.`); setStatus('error'); });
      spotifyPlayer.addListener('account_error', ({ message }) => { setError(`Spotify Premium erforderlich: ${message}`); setStatus('error'); });
      spotifyPlayer.addListener('playback_error', ({ message }) => setError(`Playback Fehler: ${message}`));

      const connected = await spotifyPlayer.connect();
      if (!connected) throw new Error('Spotify hat player.connect() abgelehnt.');
      spotifyPlayerRef.current = spotifyPlayer;
      setSdkConnected(true);
    } catch (e) {
      setError(e.message);
      setStatus('error');
      await persistState({ lastError: e.message, sdkReady: false, sdkConnected: false });
    }
  }, [player, volume, persistState]);

  useEffect(() => {
    if (player?.id) initPlayer();
    return () => { if (spotifyPlayerRef.current) spotifyPlayerRef.current.disconnect(); };
  }, [player?.id]);

  useEffect(() => {
    if (!player?.id) return;
    const id = setInterval(() => persistState(), 3000);
    return () => clearInterval(id);
  }, [player?.id, persistState]);

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
      if (!spotifyPlayerRef.current || !sdkReady) throw new Error('Player ist noch nicht bereit.');
      await spotifyPlayerRef.current.setVolume(next / 100);
      const actual = Math.round((await spotifyPlayerRef.current.getVolume()) * 100);
      setVolume(actual);
      await persistState({ volume: actual });
    } catch (e) { setError(e.message); toast.error(e.message); }
  };

  const logout = () => {
    localStorage.removeItem('player');
    localStorage.removeItem('playerSessionToken');
    window.location.reload();
  };

  if (!player?.id) {
    return <div className="min-h-screen aurora-bg flex items-center justify-center p-6"><div className="bento-panel p-6 max-w-sm text-center"><AlertCircle className="w-8 h-8 text-yellow-400 mx-auto mb-3" /><p className="font-bold">Kein Player geladen</p><p className="text-sm text-muted-foreground mt-1">Öffne den Player-Link aus dem Admin-Bereich erneut.</p></div></div>;
  }

  const track = getTrackFromState(state);
  const isPlaying = state ? !state.paused : false;
  const progressMs = state?.position || 0;
  const durationMs = track?.duration_ms || 0;
  const progress = durationMs ? Math.min(100, (progressMs / durationMs) * 100) : 0;

  return (
    <div className="min-h-screen aurora-bg flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md mb-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center"><Music2 className="w-5 h-5 text-primary" /></div>
          <div><p className="font-black gradient-text">StudioSoundSet Player</p><p className="text-xs text-muted-foreground">{player.name || 'Player'}</p></div>
        </div>
        <Button variant="ghost" size="sm" onClick={logout} className="gap-2"><LogOut className="w-4 h-4" />Logout</Button>
      </div>

      <div className="w-full max-w-md space-y-4">
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="bento-panel p-3 flex items-center gap-2">{sdkReady ? <Wifi className="w-4 h-4 text-green-400" /> : <WifiOff className="w-4 h-4 text-yellow-400" />}<span className={sdkReady ? 'text-green-400 font-semibold' : 'text-yellow-300'}>{sdkReady ? 'Player ready' : status === 'loading' ? 'Verbinde...' : 'Nicht bereit'}</span></div>
          <div className="bento-panel p-3 flex items-center gap-2">{heartbeatOk ? <CheckCircle2 className="w-4 h-4 text-green-400" /> : <RefreshCw className="w-4 h-4 text-primary animate-spin" />}<span className="text-muted-foreground">Heartbeat {heartbeatOk ? 'OK' : 'wartet'}</span></div>
        </div>

        {error && <div className="bento-panel border-red-500/20 bg-red-500/5 p-3 flex gap-2"><AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" /><p className="text-xs text-red-300">{error}</p></div>}

        <div className="bento-panel p-6 space-y-6">
          <div className="text-center space-y-4">
            <div className="mx-auto w-56 h-56 rounded-2xl overflow-hidden bg-muted/20 flex items-center justify-center shadow-2xl">
              {track?.album?.images?.[0]?.url ? <img src={track.album.images[0].url} alt="cover" className="w-full h-full object-cover" /> : <Music2 className="w-20 h-20 text-muted-foreground/20" />}
            </div>
            <div><p className="font-black text-xl truncate">{track?.name || 'Keine Wiedergabe'}</p><p className="text-sm text-muted-foreground truncate">{track?.artists?.map(a => a.name).join(', ') || 'Wähle eine Playlist im Admin'}</p></div>
          </div>

          <div className="space-y-1"><div className="h-2 bg-muted rounded-full overflow-hidden"><div className="h-full bg-primary rounded-full" style={{ width: `${progress}%` }} /></div><div className="flex justify-between text-xs text-muted-foreground"><span>{formatMs(progressMs)}</span><span>{durationMs ? formatMs(durationMs) : '--:--'}</span></div></div>

          <div className="flex items-center justify-center gap-6">
            <button onClick={() => run('prev')} disabled={!sdkReady} className="text-muted-foreground hover:text-foreground disabled:opacity-30"><SkipBack className="w-7 h-7" /></button>
            <button onClick={() => run(isPlaying ? 'pause' : 'resume')} disabled={!sdkReady} className={`w-16 h-16 rounded-full flex items-center justify-center disabled:opacity-30 ${isPlaying ? 'bg-white text-black' : 'bg-primary text-white'}`}>{isPlaying ? <Pause className="w-7 h-7" /> : <Play className="w-7 h-7 ml-0.5" />}</button>
            <button onClick={() => run('next')} disabled={!sdkReady} className="text-muted-foreground hover:text-foreground disabled:opacity-30"><SkipForward className="w-7 h-7" /></button>
          </div>

          <Button variant="outline" className="w-full gap-2" onClick={refreshState} disabled={!sdkReady}><RefreshCw className="w-4 h-4" /> Refresh State</Button>

          <div className="space-y-3 rounded-xl border border-border/40 bg-background/40 p-4"><div className="flex items-center justify-between text-sm font-semibold"><span>Interne Player-Lautstärke</span><span>{volume}%</span></div><div className="flex items-center gap-3"><Volume2 className="w-4 h-4 text-muted-foreground" /><input type="range" min={0} max={100} value={volume} onChange={(e) => setVolume(Number(e.target.value))} onMouseUp={(e) => setSdkVolume(e.currentTarget.value)} onTouchEnd={(e) => setSdkVolume(e.currentTarget.value)} className="w-full" /></div><div className="grid grid-cols-4 gap-2">{[25, 50, 75, 100].map(v => <Button key={v} variant="outline" size="sm" onClick={() => setSdkVolume(v)}>{v}%</Button>)}</div></div>
        </div>

        <div className="bento-panel p-3 text-center text-xs text-muted-foreground">Bitte stelle die Gerätelautstärke auf 100 %. StudioSoundSet regelt die interne Player-Lautstärke.</div>
      </div>
    </div>
  );
}
