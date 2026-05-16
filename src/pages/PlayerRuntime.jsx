import { useCallback, useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  AlertCircle, CheckCircle2, ChevronDown, List, LogOut, Music2, Pause, Play,
  RefreshCw, ShieldCheck, SkipBack, SkipForward, Volume2, VolumeX, Wifi, WifiOff
} from 'lucide-react';
import { toast } from 'sonner';
import { AnimatePresence, motion } from 'framer-motion';
import {
  COMMAND,
  COMMAND_STATUS,
  PLAYER_COMMAND_POLL_INTERVAL_MS,
  PLAYER_HEARTBEAT_INTERVAL_MS,
  formatMs,
  nowIso,
  bootstrapPublicPlayer,
  listPublicPlayerPlaylists,
  pollPublicPlayerCommands,
  publicPlayerRuntime,
  sendPublicPlayerCommandResult,
  syncPlayerStatusFromSdk,
  spotifyCommandError,
} from '@/lib/studioSoundSetRuntime';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function readStoredPlayer() {
  try { return JSON.parse(localStorage.getItem('player')) || null; }
  catch { return null; }
}

function getStoredSessionToken(player) {
  return player?.sessionToken || player?.setupToken || localStorage.getItem('playerSessionToken') || '';
}

function getTrackFromState(state) {
  return state?.track_window?.current_track || null;
}

function mergePlayerSession(current, patch) {
  if (!patch) return current;
  return {
    ...current,
    ...patch,
    sessionToken: getStoredSessionToken(current) || patch.sessionToken || patch.setupToken || '',
    setupToken: current?.setupToken || patch.setupToken || getStoredSessionToken(current) || '',
  };
}

export default function PlayerRuntime() {
  const [player, setPlayer] = useState(() => readStoredPlayer());
  const [provider, setProvider] = useState(null);
  const [zone, setZone] = useState(null);
  const [playlists, setPlaylists] = useState([]);
  const [showPlaylists, setShowPlaylists] = useState(false);
  const [loadingPlaylist, setLoadingPlaylist] = useState(null);

  const [bootstrapping, setBootstrapping] = useState(true);
  const [runtimeReady, setRuntimeReady] = useState(false);
  const [status, setStatus] = useState('idle');
  const [error, setError] = useState('');
  const [sdkReady, setSdkReady] = useState(false);
  const [sdkConnected, setSdkConnected] = useState(false);
  const [deviceId, setDeviceId] = useState('');
  const [state, setState] = useState(null);
  const [displayProgressMs, setDisplayProgressMs] = useState(0);
  const [volume, setVolume] = useState(50);
  const [heartbeatOk, setHeartbeatOk] = useState(false);
  const [lastCommand, setLastCommand] = useState(null);
  const [lastCommandResult, setLastCommandResult] = useState(null);

  const spotifyPlayerRef = useRef(null);
  const sdkLoadedRef = useRef(false);
  const processingRef = useRef(false);
  const heartbeatInFlightRef = useRef(false);
  const stateSyncTimerRef = useRef(null);
  const deviceIdRef = useRef('');

  const loadPlaylists = useCallback(async (currentPlayer = player) => {
    if (!currentPlayer?.id || !getStoredSessionToken(currentPlayer)) return;
    try {
      const result = await listPublicPlayerPlaylists(currentPlayer);
      setPlaylists(result.playlists || []);
    } catch (e) {
      console.warn('Playlist load failed:', e);
    }
  }, [player]);

  const updatePlayerFromRuntime = useCallback((runtimePlayer) => {
    if (!runtimePlayer) return;
    setPlayer((current) => {
      const merged = mergePlayerSession(current, runtimePlayer);
      localStorage.setItem('player', JSON.stringify(merged));
      return merged;
    });
  }, []);

  const bootstrapRuntime = useCallback(async () => {
    const stored = readStoredPlayer();
    setPlayer(stored);
    if (!stored?.id) {
      setBootstrapping(false);
      setRuntimeReady(false);
      setError('Kein Player geladen. Oeffne den Player-Link aus dem Admin erneut.');
      return;
    }
    if (!getStoredSessionToken(stored)) {
      setBootstrapping(false);
      setRuntimeReady(false);
      setError('Runtime Session fehlt. Oeffne den aktuellen Player-Link oder QR-Code aus dem Admin.');
      return;
    }

    setBootstrapping(true);
    setError('');
    try {
      const result = await bootstrapPublicPlayer(stored);
      const merged = mergePlayerSession(stored, result.player || {});
      localStorage.setItem('player', JSON.stringify(merged));
      setPlayer(merged);
      setProvider(result.provider || null);
      setZone(result.zone || null);
      setVolume(Number.isFinite(Number(result.player?.volume)) ? Number(result.player.volume) : 50);
      setRuntimeReady(true);
      await loadPlaylists(merged);
    } catch (e) {
      setRuntimeReady(false);
      setError(e.message || 'publicPlayerRuntime bootstrap failed.');
    } finally {
      setBootstrapping(false);
    }
  }, [loadPlaylists]);

  useEffect(() => { bootstrapRuntime(); }, []);

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

  const reportRuntimeStatus = useCallback(async (payload) => {
    if (!player?.id) return null;
    const result = await publicPlayerRuntime('heartbeat', {
      playerId: player.id,
      sessionToken: getStoredSessionToken(player),
      payload,
    });
    updatePlayerFromRuntime(result.player);
    setHeartbeatOk(true);
    return result;
  }, [player, updatePlayerFromRuntime]);

  const getAccessToken = useCallback(async () => {
    const result = await publicPlayerRuntime('getAccessToken', {
      playerId: player?.id,
      sessionToken: getStoredSessionToken(player),
    });
    if (!result.accessToken) throw spotifyCommandError('SPOTIFY_NOT_CONNECTED', 'Kein Spotify Token verfuegbar. Verbinde den Provider im Admin erneut.');
    return result.accessToken;
  }, [player]);

  const syncStatus = useCallback(async (extra = {}, options = {}) => {
    if (!player?.id) return null;
    if (heartbeatInFlightRef.current && !options.force) return { state, skipped: true };
    heartbeatInFlightRef.current = true;
    try {
      const result = await syncPlayerStatusFromSdk({
        sdkPlayer: spotifyPlayerRef.current,
        player,
        spotifyDeviceId: deviceIdRef.current || deviceId,
        sdkReady,
        sdkConnected,
        extra,
      });
      if (result?.state) {
        setState(result.state);
        setDisplayProgressMs(result.state.position || 0);
      }
      updatePlayerFromRuntime(result?.runtime?.player);
      setHeartbeatOk(true);
      setError((current) => current?.includes('Heartbeat') ? '' : current);
      return result;
    } catch (e) {
      setHeartbeatOk(false);
      throw e;
    } finally {
      heartbeatInFlightRef.current = false;
    }
  }, [player, deviceId, sdkReady, sdkConnected, state, updatePlayerFromRuntime]);

  const scheduleStateSync = useCallback((sdkState) => {
    if (sdkState) {
      setState(sdkState);
      setDisplayProgressMs(sdkState.position || 0);
    }
    if (stateSyncTimerRef.current) return;
    stateSyncTimerRef.current = setTimeout(async () => {
      stateSyncTimerRef.current = null;
      try { await syncStatus({ heartbeatSource: 'sdk-state-change' }); }
      catch (e) { console.warn('State sync failed:', e); }
    }, 600);
  }, [syncStatus]);

  const refreshState = useCallback(async () => {
    const result = await syncStatus({ lastManualRefreshAt: nowIso() }, { force: true });
    if (!result?.state) throw spotifyCommandError('STATE_NOT_AVAILABLE', 'Spotify hat noch keinen aktiven Playback State. Starte eine Playlist auf diesem Player.');
    return result.state;
  }, [syncStatus]);

  const initPlayer = useCallback(async () => {
    if (!player?.id || !runtimeReady || !provider?.id) return;
    setError('');
    setStatus('loading');

    if (spotifyPlayerRef.current) {
      spotifyPlayerRef.current.disconnect();
      spotifyPlayerRef.current = null;
    }

    try {
      const firstToken = await getAccessToken();
      let waited = 0;
      while (!window.Spotify && waited < 8000) { await sleep(200); waited += 200; }
      if (!window.Spotify) throw spotifyCommandError('SDK_NOT_READY', 'Spotify Web Playback SDK konnte nicht geladen werden.');

      const spotifyPlayer = new window.Spotify.Player({
        name: `StudioSoundSet - ${player.name || 'Player'}`,
        getOAuthToken: async (cb) => {
          try { cb(await getAccessToken()); }
          catch { cb(firstToken); }
        },
        volume: Math.max(0, Math.min(1, volume / 100)),
      });

      spotifyPlayer.addListener('ready', async ({ device_id }) => {
        deviceIdRef.current = device_id;
        setDeviceId(device_id);
        setSdkReady(true);
        setSdkConnected(true);
        setStatus('ready');
        toast.success('Player bereit.');
        await reportRuntimeStatus({ sdkReady: true, sdkConnected: true, spotifyDeviceId: device_id, lastError: '', volume });
        await sleep(700);
        const result = await syncPlayerStatusFromSdk({ sdkPlayer: spotifyPlayer, player, spotifyDeviceId: device_id, sdkReady: true, sdkConnected: true, extra: { volume } });
        updatePlayerFromRuntime(result?.runtime?.player);
      });

      spotifyPlayer.addListener('not_ready', async () => {
        setSdkReady(false);
        setSdkConnected(false);
        setStatus('offline');
        setError('Player temporaer getrennt. Seite offen lassen oder neu laden.');
        await reportRuntimeStatus({ sdkReady: false, sdkConnected: false, lastError: 'Player temporarily disconnected' });
      });
      spotifyPlayer.addListener('player_state_changed', (sdkState) => {
        scheduleStateSync(sdkState);
      });
      spotifyPlayer.addListener('initialization_error', async ({ message }) => {
        setError(`Init Fehler: ${message}`);
        setStatus('error');
        await reportRuntimeStatus({ sdkReady: false, sdkConnected: false, lastError: `Init Fehler: ${message}` });
      });
      spotifyPlayer.addListener('authentication_error', async ({ message }) => {
        setError(`Auth Fehler: ${message}. Provider im Admin neu verbinden.`);
        setStatus('error');
        await reportRuntimeStatus({ sdkReady: false, sdkConnected: false, lastError: `Auth Fehler: ${message}` });
      });
      spotifyPlayer.addListener('account_error', async ({ message }) => {
        setError(`Spotify Premium erforderlich: ${message}`);
        setStatus('error');
        await reportRuntimeStatus({ sdkReady: false, sdkConnected: false, lastError: `Spotify Premium erforderlich: ${message}` });
      });
      spotifyPlayer.addListener('playback_error', async ({ message }) => {
        setError(`Playback Fehler: ${message}`);
        await reportRuntimeStatus({ lastError: `Playback Fehler: ${message}` });
      });

      const connected = await spotifyPlayer.connect();
      if (!connected) throw spotifyCommandError('SDK_NOT_READY', 'Spotify hat player.connect() abgelehnt.');
      spotifyPlayerRef.current = spotifyPlayer;
      setSdkConnected(true);
    } catch (e) {
      setError(e.humanMessage || e.message);
      setStatus('error');
      await reportRuntimeStatus({ lastError: e.humanMessage || e.message, sdkReady: false, sdkConnected: false }).catch(() => {});
    }
  }, [player, runtimeReady, provider?.id, volume, getAccessToken, reportRuntimeStatus, scheduleStateSync, updatePlayerFromRuntime]);

  useEffect(() => {
    if (runtimeReady && provider?.id) initPlayer();
    return () => { if (spotifyPlayerRef.current) spotifyPlayerRef.current.disconnect(); };
  }, [runtimeReady, provider?.id]);

  useEffect(() => {
    if (!player?.id || !runtimeReady) return;
    const id = setInterval(async () => {
      try { await syncStatus({ heartbeatSource: 'player-runtime' }); }
      catch (e) { setHeartbeatOk(false); console.error('Heartbeat failed:', e); }
    }, PLAYER_HEARTBEAT_INTERVAL_MS);
    return () => clearInterval(id);
  }, [player?.id, runtimeReady, syncStatus]);

  useEffect(() => {
    const track = getTrackFromState(state);
    setDisplayProgressMs(state?.position || 0);
    if (!state || state.paused || !track?.duration_ms) return;
    const startedAt = Date.now();
    const base = state.position || 0;
    const id = setInterval(() => {
      setDisplayProgressMs(Math.min(track.duration_ms, base + Date.now() - startedAt));
    }, 500);
    return () => clearInterval(id);
  }, [state]);

  const executeSdkCommand = useCallback(async (type, payload = {}) => {
    if (!spotifyPlayerRef.current || !sdkReady) throw spotifyCommandError('SDK_NOT_READY', 'Player ist noch nicht SDK Ready.');

    if (type === COMMAND.GET_STATE) {
      const current = await refreshState();
      return { humanMessage: 'State aktualisiert.', stateSummary: current.track_window?.current_track?.name || 'No track' };
    }
    if (type === COMMAND.PAUSE) {
      await spotifyPlayerRef.current.pause();
      await sleep(700);
      const current = await refreshState();
      if (!current.paused) throw spotifyCommandError('PLAYBACK_START_FAILED', 'Pause wurde von Spotify nicht bestaetigt.');
      return { humanMessage: 'Player pausiert.' };
    }
    if (type === COMMAND.RESUME) {
      await spotifyPlayerRef.current.resume();
      await sleep(900);
      const current = await refreshState();
      if (current.paused) throw spotifyCommandError('PLAYBACK_START_FAILED', 'Resume wurde von Spotify nicht bestaetigt.');
      return { humanMessage: 'Player spielt weiter.' };
    }
    if (type === COMMAND.SKIP_NEXT) {
      const before = await spotifyPlayerRef.current.getCurrentState();
      await spotifyPlayerRef.current.nextTrack();
      await sleep(1200);
      const after = await refreshState();
      if (!after.track_window?.current_track) throw spotifyCommandError('STATE_NOT_AVAILABLE', 'Skip Next wurde nicht durch Playback State bestaetigt.');
      return { humanMessage: 'Naechster Track gestartet.', beforeTrack: before?.track_window?.current_track?.uri, afterTrack: after.track_window.current_track.uri };
    }
    if (type === COMMAND.SKIP_PREVIOUS) {
      await spotifyPlayerRef.current.previousTrack();
      await sleep(1200);
      const current = await refreshState();
      if (!current.track_window?.current_track) throw spotifyCommandError('STATE_NOT_AVAILABLE', 'Skip Previous wurde nicht durch Playback State bestaetigt.');
      return { humanMessage: 'Vorheriger Track gestartet.' };
    }
    if (type === COMMAND.SET_VOLUME) {
      const raw = payload.volume ?? payload.volumePercent ?? 50;
      const target = Math.max(0, Math.min(100, Number(raw)));
      await spotifyPlayerRef.current.setVolume(target / 100);
      await sleep(250);
      const actual = Math.round((await spotifyPlayerRef.current.getVolume()) * 100);
      setVolume(actual);
      await syncStatus({ volume: actual }, { force: true });
      if (Math.abs(actual - target) > 3) throw spotifyCommandError('VOLUME_NOT_CONFIRMED', `Spotify bestaetigte ${actual}% statt ${target}%.`, `target=${target}, actual=${actual}`);
      return { humanMessage: `Interne Player-Lautstaerke auf ${actual}% gesetzt.`, actualVolume: actual };
    }
    if (type === COMMAND.PLAY_PLAYLIST) {
      const currentDeviceId = deviceIdRef.current || deviceId;
      if (!currentDeviceId) throw spotifyCommandError('NO_SPOTIFY_DEVICE_ID', 'Der Player hat noch keine Spotify Device ID.');
      const contextUri = payload.contextUri || payload.providerPlaylistUri || payload.playlistUri;
      if (!contextUri) throw spotifyCommandError('PLAYBACK_START_FAILED', 'Keine Spotify Playlist URI im Command.');
      await publicPlayerRuntime('playPlaylist', {
        playerId: player.id,
        sessionToken: getStoredSessionToken(player),
        payload: { contextUri, deviceId: currentDeviceId, offset: payload.trackUri ? { uri: payload.trackUri } : undefined },
      });
      await sleep(2500);
      const current = await refreshState();
      if (!current.track_window?.current_track && current.paused) throw spotifyCommandError('PLAYBACK_START_FAILED', 'Spotify meldet nach Start keinen aktiven Track.');
      return { humanMessage: 'Playlist gestartet.', currentTrack: current.track_window?.current_track?.name || '' };
    }

    throw spotifyCommandError('UNKNOWN_COMMAND', `Unbekannter Command: ${type}`);
  }, [sdkReady, refreshState, syncStatus, deviceId, player]);

  useEffect(() => {
    if (!player?.id || !runtimeReady) return;
    const interval = setInterval(async () => {
      if (processingRef.current) return;
      processingRef.current = true;
      try {
        const runtime = await pollPublicPlayerCommands(player);
        updatePlayerFromRuntime(runtime.player);
        const command = runtime.command;
        if (!command) return;
        const commandType = command.type || command.command;
        setLastCommand(commandType);
        try {
          const result = await executeSdkCommand(commandType, command.payload || {});
          const commandResult = await sendPublicPlayerCommandResult(player, { commandId: command.id, status: COMMAND_STATUS.SUCCESS, result, humanMessage: result.humanMessage || 'Command confirmed by Player.' });
          updatePlayerFromRuntime(commandResult.player);
          setLastCommandResult({ status: COMMAND_STATUS.SUCCESS, message: result.humanMessage });
        } catch (e) {
          const commandResult = await sendPublicPlayerCommandResult(player, {
            commandId: command.id,
            status: COMMAND_STATUS.FAILED,
            errorCode: e.errorCode || 'PLAYER_COMMAND_FAILED',
            humanMessage: e.humanMessage || e.message,
            technicalMessage: e.technicalMessage || e.stack || e.message,
            suggestedFix: e.errorCode === 'STATE_NOT_AVAILABLE' ? 'Starte zuerst eine Playlist auf diesem Player oder tippe Refresh State.' : 'Player oeffnen, Provider verbinden und SDK Ready abwarten.',
          });
          updatePlayerFromRuntime(commandResult.player);
          setLastCommandResult({ status: COMMAND_STATUS.FAILED, message: e.humanMessage || e.message });
        }
      } catch (e) {
        console.warn('Command polling failed:', e);
      } finally {
        processingRef.current = false;
      }
    }, PLAYER_COMMAND_POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [player, runtimeReady, executeSdkCommand, updatePlayerFromRuntime]);

  const runLocalControl = async (type, payload = {}) => {
    try {
      const result = await executeSdkCommand(type, payload);
      setLastCommandResult({ status: COMMAND_STATUS.SUCCESS, message: result.humanMessage });
      toast.success(result.humanMessage || 'OK');
    } catch (e) {
      setLastCommandResult({ status: COMMAND_STATUS.FAILED, message: e.humanMessage || e.message });
      setError(e.humanMessage || e.message);
      toast.error(e.humanMessage || e.message);
    }
  };

  const setSdkVolume = async (value) => {
    const target = Number(value);
    setVolume(target);
    await runLocalControl(COMMAND.SET_VOLUME, { volume: target });
  };

  const playPlaylist = async (playlist) => {
    setLoadingPlaylist(playlist.id);
    await runLocalControl(COMMAND.PLAY_PLAYLIST, { contextUri: playlist.providerPlaylistUri, playlistId: playlist.id });
    setLoadingPlaylist(null);
    setShowPlaylists(false);
  };

  const logout = () => {
    localStorage.removeItem('player');
    localStorage.removeItem('playerSessionToken');
    window.location.reload();
  };

  if (bootstrapping) {
    return (
      <div className="min-h-screen aurora-bg flex items-center justify-center">
        <div className="flex flex-col items-center gap-3 text-muted-foreground">
          <RefreshCw className="w-8 h-8 text-primary animate-spin" />
          <p className="text-sm">Player Runtime wird geprueft...</p>
        </div>
      </div>
    );
  }

  if (!player?.id) {
    return (
      <div className="min-h-screen aurora-bg flex items-center justify-center p-6">
        <div className="bento-panel p-6 max-w-sm text-center">
          <AlertCircle className="w-8 h-8 text-yellow-400 mx-auto mb-3" />
          <p className="font-bold">Kein Player geladen</p>
          <p className="text-sm text-muted-foreground mt-1">Oeffne den Player-Link aus dem Admin-Bereich erneut.</p>
        </div>
      </div>
    );
  }

  const track = getTrackFromState(state);
  const isPlaying = state ? !state.paused : false;
  const durationMs = track?.duration_ms || 0;
  const progress = durationMs ? Math.min(100, (displayProgressMs / durationMs) * 100) : 0;
  const hasSession = !!getStoredSessionToken(player);

  return (
    <div className="min-h-screen aurora-bg flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md mb-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center">
            <Music2 className="w-5 h-5 text-primary" />
          </div>
          <div>
            <p className="font-black gradient-text">StudioSoundSet Player</p>
            <p className="text-xs text-muted-foreground">{player.name || 'Player'}{zone?.name ? ` · ${zone.name}` : ''}</p>
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
            <span className={sdkReady ? 'text-green-400 font-semibold' : 'text-yellow-300'}>{sdkReady ? 'Player ready' : status === 'loading' ? 'Verbinde...' : 'Nicht bereit'}</span>
          </div>
          <div className="bento-panel p-3 flex items-center gap-2">
            {heartbeatOk ? <CheckCircle2 className="w-4 h-4 text-green-400" /> : <RefreshCw className="w-4 h-4 text-primary animate-spin" />}
            <span className="text-muted-foreground">Heartbeat {heartbeatOk ? 'OK' : 'wartet'}</span>
          </div>
          <div className="bento-panel p-3 flex items-center gap-2">
            <ShieldCheck className={hasSession && runtimeReady ? 'w-4 h-4 text-green-400' : 'w-4 h-4 text-yellow-400'} />
            <span className="text-muted-foreground">Runtime {hasSession && runtimeReady ? 'OK' : 'fehlt'}</span>
          </div>
          <div className="bento-panel p-3 flex items-center gap-2">
            <Music2 className={provider?.id ? 'w-4 h-4 text-green-400' : 'w-4 h-4 text-yellow-400'} />
            <span className="text-muted-foreground">Provider {provider?.id ? 'OK' : 'fehlt'}</span>
          </div>
        </div>

        {(!hasSession || !runtimeReady || !provider?.id || error) && (
          <div className={`bento-panel p-3 flex gap-2 ${error ? 'border-red-500/20 bg-red-500/5' : 'border-yellow-500/20 bg-yellow-500/5'}`}>
            <AlertCircle className={`w-4 h-4 flex-shrink-0 mt-0.5 ${error ? 'text-red-400' : 'text-yellow-400'}`} />
            <p className={`text-xs ${error ? 'text-red-300' : 'text-yellow-200'}`}>
              {error || (!hasSession ? 'Runtime Session fehlt. Oeffne den aktuellen Player-Link aus dem Admin.' : !provider?.id ? 'Diesem Player ist kein Provider zugewiesen.' : 'Runtime wird initialisiert.')}
            </p>
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
              <p className="text-sm text-muted-foreground truncate">{track?.artists?.map(a => a.name).join(', ') || 'Waehle eine Playlist'}</p>
              {track?.album?.name && <p className="text-xs text-muted-foreground truncate mt-1">{track.album.name}</p>}
            </div>
          </div>

          <div className="space-y-1">
            <div className="h-2 bg-muted rounded-full overflow-hidden">
              <div className="h-full bg-primary rounded-full transition-all duration-500" style={{ width: `${progress}%` }} />
            </div>
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>{formatMs(displayProgressMs)}</span>
              <span>{durationMs ? formatMs(durationMs) : '--:--'}</span>
            </div>
          </div>

          <div className="flex items-center justify-center gap-6">
            <button onClick={() => runLocalControl(COMMAND.SKIP_PREVIOUS)} disabled={!sdkReady} className="text-muted-foreground hover:text-foreground disabled:opacity-30" title="Previous"><SkipBack className="w-7 h-7" /></button>
            <button onClick={() => runLocalControl(isPlaying ? COMMAND.PAUSE : COMMAND.RESUME)} disabled={!sdkReady} className={`w-16 h-16 rounded-full flex items-center justify-center disabled:opacity-30 ${isPlaying ? 'bg-white text-black' : 'bg-primary text-white'}`} title={isPlaying ? 'Pause' : 'Play'}>
              {isPlaying ? <Pause className="w-7 h-7" /> : <Play className="w-7 h-7 ml-0.5" />}
            </button>
            <button onClick={() => runLocalControl(COMMAND.SKIP_NEXT)} disabled={!sdkReady} className="text-muted-foreground hover:text-foreground disabled:opacity-30" title="Next"><SkipForward className="w-7 h-7" /></button>
          </div>

          <Button variant="outline" className="w-full gap-2" onClick={() => runLocalControl(COMMAND.GET_STATE)} disabled={!sdkReady}>
            <RefreshCw className="w-4 h-4" /> Refresh State
          </Button>

          <div className="space-y-3 rounded-xl border border-border/40 bg-background/40 p-4">
            <div className="flex items-center justify-between text-sm font-semibold"><span>Interne Player-Lautstaerke</span><span>{volume}%</span></div>
            <div className="flex items-center gap-3">
              <VolumeX className="w-4 h-4 text-muted-foreground" />
              <input type="range" min={0} max={100} value={volume} onChange={(e) => setVolume(Number(e.target.value))} onPointerUp={(e) => setSdkVolume(e.currentTarget.value)} className="w-full" />
              <Volume2 className="w-4 h-4 text-muted-foreground" />
            </div>
            <div className="grid grid-cols-4 gap-2">
              {[25, 50, 75, 100].map(v => <Button key={v} variant="outline" size="sm" onClick={() => setSdkVolume(v)}>{v}%</Button>)}
            </div>
          </div>
        </div>

        <div className="bento-panel p-3 text-center text-xs text-muted-foreground">
          Bitte stelle die Geraetelautstaerke auf 100 %. StudioSoundSet regelt die interne Player-Lautstaerke, soweit Spotify Web Playback SDK und Geraet dies zulassen.
        </div>

        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="bento-panel p-3"><p className="text-muted-foreground">Letzter Command</p><p className="font-semibold break-all">{lastCommand || '—'}</p></div>
          <div className="bento-panel p-3"><p className="text-muted-foreground">Command Status</p><p className="font-semibold break-all">{lastCommandResult?.status || '—'}</p></div>
        </div>
        {lastCommandResult?.message && <div className="bento-panel p-3 text-xs text-muted-foreground">{lastCommandResult.message}</div>}

        <button onClick={() => setShowPlaylists(!showPlaylists)} className="w-full bento-panel p-4 flex items-center gap-3 hover:border-primary/40 transition-all">
          <List className="w-5 h-5 text-primary" />
          <span className="font-semibold flex-1 text-left">Playlists ({playlists.length})</span>
          <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform ${showPlaylists ? 'rotate-180' : ''}`} />
        </button>

        <AnimatePresence>
          {showPlaylists && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
              <div className="bento-panel divide-y divide-border/30 max-h-96 overflow-y-auto">
                {playlists.length === 0 ? (
                  <div className="p-6 text-center text-sm text-muted-foreground">Keine importierten Playlists fuer diesen Player.</div>
                ) : playlists.map(pl => (
                  <button key={pl.id} onClick={() => playPlaylist(pl)} disabled={loadingPlaylist === pl.id || !sdkReady} className="w-full flex items-center gap-3 p-3 hover:bg-primary/5 transition-colors text-left disabled:opacity-50">
                    {pl.coverUrl ? <img src={pl.coverUrl} alt={pl.name} className="w-12 h-12 rounded-lg flex-shrink-0 object-cover" /> : <div className="w-12 h-12 bg-muted/30 rounded-lg flex items-center justify-center flex-shrink-0"><Music2 className="w-4 h-4 text-muted-foreground" /></div>}
                    <div className="flex-1 min-w-0"><p className="font-semibold text-sm truncate">{pl.name}</p><p className="text-xs text-muted-foreground">{pl.importedTracks || 0} Songs</p></div>
                    {loadingPlaylist === pl.id ? <RefreshCw className="w-4 h-4 animate-spin text-primary flex-shrink-0" /> : <Play className="w-4 h-4 text-muted-foreground flex-shrink-0" />}
                  </button>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
