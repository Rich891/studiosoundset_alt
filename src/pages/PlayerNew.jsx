import { useState, useEffect, useRef, useCallback } from 'react';
import PlayerLogin from '@/pages/PlayerLogin';
import {
  Play, Pause, SkipForward, SkipBack, Volume2, VolumeX,
  Music2, RefreshCw, AlertCircle, Wifi, WifiOff, List,
  ChevronDown, LogOut, CheckCircle2, ShieldCheck
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';
import {
  COMMAND,
  COMMAND_STATUS,
  formatMs,
  nowIso,
  bootstrapPublicPlayer,
  pollPublicPlayerCommands,
  sendPublicPlayerCommandResult,
  listPublicPlayerPlaylists,
  publicPlayerRuntime,
  syncPlayerStatusFromSdk,
  spotifyCommandError,
} from '@/lib/studioSoundSetRuntime';

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function getStoredPlayer() {
  try {
    return JSON.parse(localStorage.getItem('player'));
  } catch {
    return null;
  }
}

function getStoredSessionToken(player) {
  return player?.sessionToken || player?.setupToken || localStorage.getItem('playerSessionToken') || '';
}

function mergePlayerFromUrl(storedPlayer) {
  const params = new URLSearchParams(window.location.search);
  const playerId = params.get('playerId') || params.get('id');
  const sessionToken = params.get('sessionToken') || params.get('setupToken') || params.get('token');
  if (!playerId && !storedPlayer) return null;

  const merged = {
    ...(storedPlayer || {}),
    ...(playerId ? { id: playerId } : {}),
  };

  const mappings = {
    name: 'name',
    email: 'email',
    password: 'passwordHash',
    providerId: 'providerId',
    zoneId: 'zoneId',
  };

  Object.entries(mappings).forEach(([param, field]) => {
    const value = params.get(param);
    if (value !== null && value !== '') merged[field] = value;
  });

  if (sessionToken) {
    merged.sessionToken = sessionToken;
    localStorage.setItem('playerSessionToken', sessionToken);
  } else if (storedPlayer?.sessionToken || storedPlayer?.setupToken) {
    localStorage.setItem('playerSessionToken', storedPlayer.sessionToken || storedPlayer.setupToken);
  }

  if (!merged.name) merged.name = 'StudioSoundSet Player';
  if (!merged.role) merged.role = 'player';
  if (merged.id) localStorage.setItem('player', JSON.stringify(merged));
  return merged.id ? merged : storedPlayer;
}

export default function PlayerNew() {
  const [player, setPlayer] = useState(null);
  const [provider, setProvider] = useState(null);
  const [zone, setZone] = useState(null);
  const [playlists, setPlaylists] = useState([]);
  const [loading, setLoading] = useState(true);
  const [bootstrapping, setBootstrapping] = useState(false);
  const [playerReady, setPlayerReady] = useState(false);
  const [sdkConnected, setSdkConnected] = useState(false);
  const [playerState, setPlayerState] = useState(null);
  const [volume, setVolume] = useState(0.5);
  const [deviceId, setDeviceId] = useState(null);
  const [error, setError] = useState('');
  const [status, setStatus] = useState('idle');
  const [showPlaylists, setShowPlaylists] = useState(false);
  const [loadingPlaylist, setLoadingPlaylist] = useState(null);
  const [lastCommand, setLastCommand] = useState(null);
  const [lastCommandResult, setLastCommandResult] = useState(null);
  const [heartbeatOk, setHeartbeatOk] = useState(false);
  const [runtimeReady, setRuntimeReady] = useState(false);

  const playerRef = useRef(null);
  const sdkReadyRef = useRef(false);
  const processingRef = useRef(false);
  const deviceIdRef = useRef(null);

  useEffect(() => {
    const storedPlayer = getStoredPlayer();
    const mergedPlayer = mergePlayerFromUrl(storedPlayer);
    if (mergedPlayer?.id) setPlayer(mergedPlayer);
    setLoading(false);
  }, []);

  const loadPlaylists = useCallback(async (currentPlayer = player) => {
    if (!currentPlayer?.id || !getStoredSessionToken(currentPlayer)) return;
    try {
      const result = await listPublicPlayerPlaylists(currentPlayer);
      setPlaylists(result.playlists || []);
    } catch (e) {
      console.warn('Playlist load failed:', e);
    }
  }, [player]);

  const bootstrapRuntime = useCallback(async (currentPlayer) => {
    if (!currentPlayer?.id || !getStoredSessionToken(currentPlayer)) {
      setError('Dieser Player-Link enthält keine gültige Runtime Session. Öffne den aktuellen Player-Link oder QR-Code aus dem Admin.');
      return;
    }
    setBootstrapping(true);
    setError('');
    try {
      const result = await bootstrapPublicPlayer(currentPlayer);
      const merged = {
        ...currentPlayer,
        ...(result.player || {}),
        sessionToken: getStoredSessionToken(currentPlayer),
      };
      setPlayer(merged);
      setProvider(result.provider || null);
      setZone(result.zone || null);
      setVolume(Number.isFinite(Number(result.player?.volume)) ? Number(result.player.volume) / 100 : 0.5);
      localStorage.setItem('player', JSON.stringify(merged));
      setRuntimeReady(true);
      await loadPlaylists(merged);
    } catch (e) {
      setRuntimeReady(false);
      setError(e.message || 'publicPlayerRuntime bootstrap failed.');
    } finally {
      setBootstrapping(false);
    }
  }, [loadPlaylists]);

  useEffect(() => {
    if (player?.id) bootstrapRuntime(player);
  }, [player?.id]);

  useEffect(() => {
    if (window.Spotify) {
      sdkReadyRef.current = true;
      return;
    }
    const script = document.createElement('script');
    script.src = 'https://sdk.scdn.co/spotify-player.js';
    script.async = true;
    document.body.appendChild(script);
    window.onSpotifyWebPlaybackSDKReady = () => {
      sdkReadyRef.current = true;
    };
    return () => {
      window.onSpotifyWebPlaybackSDKReady = null;
      if (script.parentNode) script.parentNode.removeChild(script);
    };
  }, []);

  const syncStatus = useCallback(async (extra = {}) => {
    if (!player?.id) return null;
    const result = await syncPlayerStatusFromSdk({
      sdkPlayer: playerRef.current,
      player,
      spotifyDeviceId: deviceIdRef.current || deviceId,
      sdkReady: playerReady,
      sdkConnected,
      extra,
    });
    if (result?.state) setPlayerState(result.state);
    setHeartbeatOk(true);
    return result;
  }, [player, deviceId, playerReady, sdkConnected]);

  const reportRuntimeStatus = useCallback(async (payload) => {
    if (!player?.id) return;
    await publicPlayerRuntime('heartbeat', {
      playerId: player.id,
      sessionToken: getStoredSessionToken(player),
      payload,
    });
  }, [player]);

  const getSdkAccessToken = useCallback(async () => {
    const result = await publicPlayerRuntime('getAccessToken', {
      playerId: player?.id,
      sessionToken: getStoredSessionToken(player),
    });
    if (!result.accessToken) throw spotifyCommandError('SPOTIFY_NOT_CONNECTED', 'Kein Spotify Token verfügbar. Verbinde den Provider erneut.');
    return result.accessToken;
  }, [player]);

  const initPlayer = useCallback(async () => {
    if (!player?.id || !runtimeReady || !provider?.id) return;
    setStatus('loading');
    setError('');

    if (playerRef.current) {
      playerRef.current.disconnect();
      playerRef.current = null;
    }

    try {
      const initialToken = await getSdkAccessToken();
      let waited = 0;
      while (!sdkReadyRef.current && waited < 8000) {
        await sleep(200);
        waited += 200;
      }
      if (!window.Spotify) throw spotifyCommandError('SDK_NOT_READY', 'Spotify SDK konnte nicht geladen werden.');

      const spotifyPlayer = new window.Spotify.Player({
        name: `StudioSoundSet - ${player.name}`,
        getOAuthToken: async (cb) => {
          try {
            cb(await getSdkAccessToken());
          } catch {
            cb(initialToken);
          }
        },
        volume,
      });

      spotifyPlayer.addListener('ready', async ({ device_id }) => {
        deviceIdRef.current = device_id;
        setDeviceId(device_id);
        setPlayerReady(true);
        setSdkConnected(true);
        setStatus('ready');
        toast.success('Player bereit.');
        await reportRuntimeStatus({
          sdkReady: true,
          sdkConnected: true,
          spotifyDeviceId: device_id,
          lastError: '',
          volume: Math.round(volume * 100),
        });
        await sleep(700);
        await syncPlayerStatusFromSdk({ sdkPlayer: spotifyPlayer, player, spotifyDeviceId: device_id, sdkReady: true, sdkConnected: true });
      });

      spotifyPlayer.addListener('not_ready', async () => {
        setPlayerReady(false);
        setSdkConnected(false);
        setStatus('error');
        setError('Player temporär getrennt. Öffne diese Seite erneut oder tippe Neu verbinden.');
        await reportRuntimeStatus({ sdkReady: false, sdkConnected: false, lastError: 'Player temporarily disconnected' });
      });

      spotifyPlayer.addListener('player_state_changed', async (state) => {
        setPlayerState(state);
        await syncPlayerStatusFromSdk({
          sdkPlayer: spotifyPlayer,
          player,
          spotifyDeviceId: deviceIdRef.current,
          sdkReady: true,
          sdkConnected: true,
        });
      });

      spotifyPlayer.addListener('initialization_error', async ({ message }) => {
        setError('Init Fehler: ' + message);
        setStatus('error');
        await reportRuntimeStatus({ sdkReady: false, sdkConnected: false, lastError: 'Init Fehler: ' + message });
      });
      spotifyPlayer.addListener('authentication_error', async ({ message }) => {
        setError('Spotify Auth abgelaufen. Bitte Provider erneut verbinden. ' + message);
        setStatus('error');
        await reportRuntimeStatus({ sdkReady: false, sdkConnected: false, lastError: 'Spotify Auth abgelaufen. ' + message });
      });
      spotifyPlayer.addListener('account_error', async ({ message }) => {
        setError('Spotify Premium ist für den Player erforderlich. ' + message);
        setStatus('error');
        await reportRuntimeStatus({ sdkReady: false, sdkConnected: false, lastError: 'Spotify Premium erforderlich. ' + message });
      });
      spotifyPlayer.addListener('playback_error', async ({ message }) => {
        setError('Spotify Playback Fehler: ' + message);
        await reportRuntimeStatus({ lastError: 'Spotify Playback Fehler: ' + message });
      });

      const connected = await spotifyPlayer.connect();
      if (!connected) throw spotifyCommandError('SDK_NOT_READY', 'player.connect() wurde von Spotify abgelehnt.');
      playerRef.current = spotifyPlayer;
      setSdkConnected(true);
    } catch (e) {
      setError(e.humanMessage || e.message);
      setStatus('error');
      await reportRuntimeStatus({ lastError: e.humanMessage || e.message, sdkReady: false, sdkConnected: false }).catch(() => {});
    }
  }, [player, provider?.id, runtimeReady, volume, getSdkAccessToken, reportRuntimeStatus]);

  useEffect(() => {
    if (player?.id && provider?.id && runtimeReady) initPlayer();
    return () => {
      if (playerRef.current) {
        playerRef.current.disconnect();
        playerRef.current = null;
      }
    };
  }, [player?.id, provider?.id, runtimeReady]);

  useEffect(() => {
    if (!player?.id) return;
    const interval = setInterval(async () => {
      try {
        await syncStatus({ heartbeatSource: 'player-ui' });
      } catch (e) {
        setHeartbeatOk(false);
        console.error('Heartbeat failed:', e);
      }
    }, 3000);
    return () => clearInterval(interval);
  }, [player?.id, syncStatus]);

  const refreshState = useCallback(async () => {
    const result = await syncStatus({ lastManualRefreshAt: nowIso() });
    if (!result?.state) throw spotifyCommandError('STATE_NOT_AVAILABLE', 'Spotify hat noch keinen aktiven Playback State. Starte eine Playlist auf diesem Player.');
    return result.state;
  }, [syncStatus]);

  const executeSdkCommand = useCallback(async (type, payload = {}) => {
    if (!playerRef.current || !playerReady) throw spotifyCommandError('SDK_NOT_READY', 'Player ist noch nicht SDK Ready.');

    if (type === COMMAND.GET_STATE) {
      const state = await refreshState();
      return { humanMessage: 'State aktualisiert.', stateSummary: state.track_window?.current_track?.name || 'No track' };
    }

    if (type === COMMAND.PAUSE) {
      await playerRef.current.pause();
      await sleep(700);
      const state = await refreshState();
      if (!state.paused) throw spotifyCommandError('PLAYBACK_START_FAILED', 'Pause wurde von Spotify nicht bestätigt.');
      return { humanMessage: 'Player pausiert.' };
    }

    if (type === COMMAND.RESUME) {
      await playerRef.current.resume();
      await sleep(900);
      const state = await refreshState();
      if (state.paused) throw spotifyCommandError('PLAYBACK_START_FAILED', 'Resume wurde von Spotify nicht bestätigt.');
      return { humanMessage: 'Player spielt weiter.' };
    }

    if (type === COMMAND.SKIP_NEXT) {
      const before = await playerRef.current.getCurrentState();
      await playerRef.current.nextTrack();
      await sleep(1200);
      const after = await refreshState();
      if (!after.track_window?.current_track) throw spotifyCommandError('STATE_NOT_AVAILABLE', 'Skip Next wurde nicht durch neuen Playback State bestätigt.');
      return { humanMessage: 'Nächster Track gestartet.', beforeTrack: before?.track_window?.current_track?.uri, afterTrack: after.track_window.current_track.uri };
    }

    if (type === COMMAND.SKIP_PREVIOUS) {
      await playerRef.current.previousTrack();
      await sleep(1200);
      const state = await refreshState();
      if (!state.track_window?.current_track) throw spotifyCommandError('STATE_NOT_AVAILABLE', 'Skip Previous wurde nicht durch Playback State bestätigt.');
      return { humanMessage: 'Vorheriger Track gestartet.' };
    }

    if (type === COMMAND.SET_VOLUME) {
      const raw = payload.volume ?? payload.volumePercent ?? 50;
      const target = Math.max(0, Math.min(100, Number(raw)));
      await playerRef.current.setVolume(target / 100);
      await sleep(250);
      const actual = Math.round((await playerRef.current.getVolume()) * 100);
      setVolume(actual / 100);
      await syncStatus({ volume: actual });
      if (Math.abs(actual - target) > 3) throw spotifyCommandError('VOLUME_NOT_CONFIRMED', `Spotify bestätigte ${actual}% statt ${target}%.`, `target=${target}, actual=${actual}`);
      return { humanMessage: `Interne Player-Lautstärke auf ${actual}% gesetzt.`, actualVolume: actual };
    }

    if (type === COMMAND.PLAY_PLAYLIST) {
      const currentDeviceId = deviceIdRef.current || deviceId;
      if (!currentDeviceId) throw spotifyCommandError('NO_SPOTIFY_DEVICE_ID', 'Der Player hat noch keine Spotify Device ID.');
      const contextUri = payload.contextUri || payload.providerPlaylistUri || payload.playlistUri;
      if (!contextUri) throw spotifyCommandError('PLAYBACK_START_FAILED', 'Keine Spotify Playlist URI im Command.');
      const result = await publicPlayerRuntime('playPlaylist', {
        playerId: player.id,
        sessionToken: getStoredSessionToken(player),
        payload: {
          contextUri,
          deviceId: currentDeviceId,
          offset: payload.trackUri ? { uri: payload.trackUri } : undefined,
        },
      });
      if (!result.success) throw spotifyCommandError('PLAYBACK_START_FAILED', result.error || 'Playlist konnte nicht gestartet werden.');
      await sleep(2500);
      const state = await refreshState();
      if (!state.track_window?.current_track && state.paused) throw spotifyCommandError('PLAYBACK_START_FAILED', 'Spotify meldet nach Start keinen aktiven Track.');
      return { humanMessage: 'Playlist gestartet.', currentTrack: state.track_window?.current_track?.name || '' };
    }

    throw spotifyCommandError('UNKNOWN_COMMAND', `Unbekannter Command: ${type}`);
  }, [playerReady, refreshState, syncStatus, deviceId, player]);

  useEffect(() => {
    if (!player?.id || !runtimeReady) return;
    const interval = setInterval(async () => {
      if (processingRef.current) return;
      processingRef.current = true;
      try {
        const runtime = await pollPublicPlayerCommands(player);
        const command = runtime.command;
        if (!command) return;

        const commandType = command.type || command.command;
        setLastCommand(commandType);

        try {
          const result = await executeSdkCommand(commandType, command.payload || {});
          await sendPublicPlayerCommandResult(player, {
            commandId: command.id,
            status: COMMAND_STATUS.SUCCESS,
            result,
            humanMessage: result.humanMessage || 'Command confirmed by Player.',
          });
          setLastCommandResult({ status: COMMAND_STATUS.SUCCESS, message: result.humanMessage });
        } catch (e) {
          await sendPublicPlayerCommandResult(player, {
            commandId: command.id,
            status: COMMAND_STATUS.FAILED,
            errorCode: e.errorCode || 'PLAYER_COMMAND_FAILED',
            humanMessage: e.humanMessage || e.message,
            technicalMessage: e.technicalMessage || e.stack || e.message,
            suggestedFix: e.errorCode === 'STATE_NOT_AVAILABLE' ? 'Starte zuerst eine Playlist auf diesem Player oder tippe Refresh State.' : 'Player öffnen, Spotify verbinden und SDK Ready abwarten.',
          });
          setLastCommandResult({ status: COMMAND_STATUS.FAILED, message: e.humanMessage || e.message });
        }
      } catch (e) {
        console.warn('Command polling failed:', e);
      } finally {
        processingRef.current = false;
      }
    }, 2000);
    return () => clearInterval(interval);
  }, [player, runtimeReady, executeSdkCommand]);

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

  const handleVolume = async (val) => {
    const target = Number(val);
    setVolume(target / 100);
    await runLocalControl(COMMAND.SET_VOLUME, { volume: target });
  };

  const playPlaylist = async (pl) => {
    setLoadingPlaylist(pl.id);
    await runLocalControl(COMMAND.PLAY_PLAYLIST, { contextUri: pl.providerPlaylistUri, playlistId: pl.id });
    setLoadingPlaylist(null);
    setShowPlaylists(false);
  };

  const handleLogout = () => {
    localStorage.removeItem('playerSessionToken');
    localStorage.removeItem('player');
    window.location.reload();
  };

  if (loading) {
    return <div className="min-h-screen aurora-bg flex items-center justify-center"><RefreshCw className="w-8 h-8 text-primary animate-spin" /></div>;
  }

  if (!player) {
    return <PlayerLogin onLoginSuccess={() => setPlayer(mergePlayerFromUrl(getStoredPlayer()))} />;
  }

  const track = playerState?.track_window?.current_track;
  const isPlaying = playerState ? !playerState.paused : false;
  const posMs = playerState?.position || 0;
  const durMs = track?.duration_ms || 0;
  const progressPct = durMs ? Math.min(100, (posMs / durMs) * 100) : 0;
  const volPct = Math.round(volume * 100);
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
            <p className="text-xs text-muted-foreground">{player.name}{zone?.name ? ` · ${zone.name}` : ''}</p>
          </div>
        </div>
        <Button variant="ghost" size="sm" onClick={handleLogout} className="h-8 gap-1">
          <LogOut className="w-3 h-3" />
          <span className="text-xs">Logout</span>
        </Button>
      </div>

      <div className="w-full max-w-md space-y-4">
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="bento-panel p-3 flex items-center gap-2">
            {status === 'ready' ? <Wifi className="w-4 h-4 text-green-400" /> : <WifiOff className="w-4 h-4 text-yellow-400" />}
            <span className={status === 'ready' ? 'text-green-400 font-semibold' : 'text-yellow-300'}>{status === 'ready' ? 'Player ready' : status === 'loading' ? 'Verbinde...' : 'Nicht bereit'}</span>
          </div>
          <div className="bento-panel p-3 flex items-center gap-2">
            {heartbeatOk ? <CheckCircle2 className="w-4 h-4 text-green-400" /> : <RefreshCw className="w-4 h-4 text-primary animate-spin" />}
            <span className="text-muted-foreground">Heartbeat {heartbeatOk ? 'OK' : 'wartet'}</span>
          </div>
          <div className="bento-panel p-3 flex items-center gap-2">
            <ShieldCheck className={hasSession && runtimeReady ? 'w-4 h-4 text-green-400' : 'w-4 h-4 text-yellow-400'} />
            <span className="text-muted-foreground">Runtime {hasSession && runtimeReady ? 'OK' : bootstrapping ? 'lädt' : 'fehlt'}</span>
          </div>
          <div className="bento-panel p-3 flex items-center gap-2">
            <Music2 className={provider?.id ? 'w-4 h-4 text-green-400' : 'w-4 h-4 text-yellow-400'} />
            <span className="text-muted-foreground">Provider {provider?.id ? 'OK' : 'fehlt'}</span>
          </div>
        </div>

        {!hasSession && (
          <div className="bento-panel border-yellow-500/20 bg-yellow-500/5 p-3 flex gap-2">
            <AlertCircle className="w-4 h-4 text-yellow-400 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-yellow-200">Dieser Link enthält keine Runtime Session. Öffne im Admin den aktuellen Player-Link oder QR-Code, nicht einen alten gespeicherten Link.</p>
          </div>
        )}

        {runtimeReady && !provider?.id && (
          <div className="bento-panel border-yellow-500/20 bg-yellow-500/5 p-3 flex gap-2">
            <AlertCircle className="w-4 h-4 text-yellow-400 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-yellow-200">Dieser Player hat keinen Provider zugewiesen. Im Admin beim Player einen Spotify Provider auswählen und speichern.</p>
          </div>
        )}

        {error && (
          <div className="bento-panel border-red-500/20 bg-red-500/5 p-3 flex gap-2">
            <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-red-300">{error}</p>
          </div>
        )}

        <div className="bento-panel p-6 space-y-6">
          <div className="text-center space-y-4">
            <div className="relative mx-auto w-56 h-56">
              {track?.album?.images?.[0]?.url ? (
                <img src={track.album.images[0].url} alt={track.album.name} className="w-full h-full rounded-2xl shadow-2xl object-cover" />
              ) : (
                <div className="w-full h-full rounded-2xl bg-muted/20 flex items-center justify-center">
                  <Music2 className="w-20 h-20 text-muted-foreground/20" />
                </div>
              )}
            </div>
            <div>
              <p className="font-black text-xl truncate">{track?.name || 'Keine Wiedergabe'}</p>
              <p className="text-sm text-muted-foreground truncate">{track?.artists?.map(a => a.name).join(', ') || 'Wähle eine Playlist'}</p>
              {track?.album?.name && <p className="text-xs text-muted-foreground truncate mt-1">{track.album.name}</p>}
            </div>
          </div>

          <div className="space-y-1">
            <div className="h-2 bg-muted rounded-full overflow-hidden">
              <div className="h-full bg-primary rounded-full transition-all duration-1000" style={{ width: `${progressPct}%` }} />
            </div>
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>{formatMs(posMs)}</span>
              <span>{durMs ? formatMs(durMs) : '--:--'}</span>
            </div>
          </div>

          <div className="flex items-center justify-center gap-6">
            <button onClick={() => runLocalControl(COMMAND.SKIP_PREVIOUS)} disabled={!playerReady} className="text-muted-foreground hover:text-foreground disabled:opacity-30" title="Previous">
              <SkipBack className="w-7 h-7" />
            </button>
            <button onClick={() => runLocalControl(isPlaying ? COMMAND.PAUSE : COMMAND.RESUME)} disabled={!playerReady} className={`w-16 h-16 rounded-full flex items-center justify-center transition-all disabled:opacity-30 ${isPlaying ? 'bg-white text-black hover:bg-white/90' : 'bg-primary text-white hover:bg-primary/90'}`} title={isPlaying ? 'Pause' : 'Play'}>
              {isPlaying ? <Pause className="w-7 h-7" /> : <Play className="w-7 h-7 ml-0.5" />}
            </button>
            <button onClick={() => runLocalControl(COMMAND.SKIP_NEXT)} disabled={!playerReady} className="text-muted-foreground hover:text-foreground disabled:opacity-30" title="Next">
              <SkipForward className="w-7 h-7" />
            </button>
          </div>

          <Button variant="outline" className="w-full gap-2" onClick={() => runLocalControl(COMMAND.GET_STATE)} disabled={!playerReady}>
            <RefreshCw className="w-4 h-4" /> Refresh State
          </Button>

          <div className="space-y-3 rounded-xl border border-border/40 bg-background/40 p-4">
            <div className="flex items-center justify-between text-sm font-semibold">
              <span>Interne Player-Lautstärke</span>
              <span>{volPct}%</span>
            </div>
            <div className="flex items-center gap-3">
              <VolumeX className="w-4 h-4 text-muted-foreground flex-shrink-0" />
              <input type="range" min={0} max={100} value={volPct} onChange={e => setVolume(Number(e.target.value) / 100)} onPointerUp={e => handleVolume(e.currentTarget.value)} className="w-full h-2 rounded-full" style={{ background: `linear-gradient(to right, hsl(var(--primary)) ${volPct}%, hsl(var(--border)) ${volPct}%)` }} />
              <Volume2 className="w-4 h-4 text-muted-foreground flex-shrink-0" />
            </div>
            <div className="grid grid-cols-4 gap-2">
              {[25, 50, 75, 100].map((value) => <Button key={value} variant="outline" size="sm" onClick={() => handleVolume(value)}>{value}%</Button>)}
            </div>
          </div>
        </div>

        <div className="bento-panel p-3 text-center text-xs text-muted-foreground">
          Bitte stelle die Gerätelautstärke auf 100 %. StudioSoundSet regelt die interne Player-Lautstärke, soweit Spotify Web Playback SDK und Gerät dies zulassen.
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
                  <div className="p-6 text-center text-sm text-muted-foreground">Keine importierten Playlists für diesen Player.</div>
                ) : playlists.map(pl => (
                  <button key={pl.id} onClick={() => playPlaylist(pl)} disabled={loadingPlaylist === pl.id || !playerReady} className="w-full flex items-center gap-3 p-3 hover:bg-primary/5 transition-colors text-left disabled:opacity-50">
                    {pl.coverUrl ? <img src={pl.coverUrl} alt={pl.name} className="w-12 h-12 rounded-lg flex-shrink-0 object-cover" /> : <div className="w-12 h-12 bg-muted/30 rounded-lg flex items-center justify-center flex-shrink-0"><Music2 className="w-4 h-4 text-muted-foreground" /></div>}
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm truncate">{pl.name}</p>
                      <p className="text-xs text-muted-foreground">{pl.importedTracks || 0} Songs</p>
                    </div>
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
