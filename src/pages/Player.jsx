import { useState, useEffect, useRef, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import {
  Play, Pause, SkipForward, SkipBack, Volume2, VolumeX,
  Music2, RefreshCw, AlertCircle, Wifi, WifiOff, List,
  ChevronDown, Shuffle, Repeat
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';
import { Link } from 'react-router-dom';

const invoke = (fn, payload) => base44.functions.invoke(fn, payload);

function formatMs(ms) {
  const s = Math.floor(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

export default function Player() {
  const [selectedAccountId, setSelectedAccountId] = useState('');
  const [playerReady, setPlayerReady] = useState(false);
  const [playerState, setPlayerState] = useState(null);
  const [volume, setVolume] = useState(0.5);
  const [deviceId, setDeviceId] = useState(null);
  const [error, setError] = useState('');
  const [status, setStatus] = useState('idle'); // idle | loading | ready | error
  const [showPlaylists, setShowPlaylists] = useState(false);
  const [loadingPlaylist, setLoadingPlaylist] = useState(null);

  const playerRef = useRef(null);
  const sdkReadyRef = useRef(false);

  const { data: accounts = [] } = useQuery({
    queryKey: ['spotifyAccounts'],
    queryFn: () => base44.entities.SpotifyAccount.list(),
  });
  const { data: playlists = [] } = useQuery({
    queryKey: ['playlists'],
    queryFn: () => base44.entities.Playlist.list('-lastSyncAt'),
  });

  const connectedAccounts = accounts.filter(a => a.authStatus === 'connected');

  // Auto-select first connected account
  useEffect(() => {
    if (!selectedAccountId && connectedAccounts.length > 0) {
      setSelectedAccountId(connectedAccounts[0].id);
    }
  }, [connectedAccounts, selectedAccountId]);

  // Load Spotify Web Playback SDK script
  useEffect(() => {
    if (window.Spotify) { sdkReadyRef.current = true; return; }
    const script = document.createElement('script');
    script.src = 'https://sdk.scdn.co/spotify-player.js';
    script.async = true;
    document.body.appendChild(script);
    window.onSpotifyWebPlaybackSDKReady = () => { sdkReadyRef.current = true; };
    return () => { document.body.removeChild(script); };
  }, []);

  // Initialize player when account selected
  const initPlayer = useCallback(async () => {
    if (!selectedAccountId) return;
    setStatus('loading');
    setError('');

    // Disconnect existing
    if (playerRef.current) {
      playerRef.current.disconnect();
      playerRef.current = null;
    }

    try {
      const res = await invoke('spotifyAccountControl', { action: 'getAccessToken', accountId: selectedAccountId });
      if (!res.data?.success || !res.data?.accessToken) {
        throw new Error('Kein Token verfügbar. Verbinde den Account zuerst.');
      }
      const accessToken = res.data.accessToken;

      // Wait for SDK
      let waited = 0;
      while (!sdkReadyRef.current && waited < 5000) {
        await new Promise(r => setTimeout(r, 200));
        waited += 200;
      }
      if (!sdkReadyRef.current || !window.Spotify) {
        throw new Error('Spotify SDK konnte nicht geladen werden.');
      }

      const player = new window.Spotify.Player({
        name: 'StudioSoundSet Player',
        getOAuthToken: async (cb) => {
          // Refresh token on demand
          const r = await invoke('spotifyAccountControl', { action: 'getAccessToken', accountId: selectedAccountId });
          cb(r.data?.accessToken || accessToken);
        },
        volume: volume,
      });

      player.addListener('ready', ({ device_id }) => {
        console.log('Spotify Player ready, device_id:', device_id);
        setDeviceId(device_id);
        setPlayerReady(true);
        setStatus('ready');
        // Auto-transfer to this browser device
        invoke('spotifyAccountControl', { action: 'transferPlayback', accountId: selectedAccountId, deviceId: device_id })
          .catch(e => console.warn('Auto-transfer failed:', e));
        toast.success('Player bereit! Wähle eine Playlist zum Abspielen.');
      });

      player.addListener('not_ready', () => {
        setPlayerReady(false);
        setStatus('error');
        setError('Verbindung unterbrochen.');
      });

      player.addListener('player_state_changed', (state) => {
        setPlayerState(state);
      });

      player.addListener('initialization_error', ({ message }) => {
        setError('Init Fehler: ' + message);
        setStatus('error');
      });

      player.addListener('authentication_error', ({ message }) => {
        setError('AUTH_SCOPE_ERROR:' + message);
        setStatus('error');
      });

      player.addListener('account_error', ({ message }) => {
        setError('Account Fehler (Spotify Premium benötigt): ' + message);
        setStatus('error');
      });

      await player.connect();
      playerRef.current = player;
    } catch (e) {
      setError(e.message);
      setStatus('error');
    }
  }, [selectedAccountId, volume]);

  useEffect(() => {
    if (selectedAccountId) initPlayer();
    return () => {
      if (playerRef.current) { playerRef.current.disconnect(); playerRef.current = null; }
    };
  }, [selectedAccountId]);

  // Controls
  const togglePlay = () => playerRef.current?.togglePlay();
  const nextTrack = () => playerRef.current?.nextTrack();
  const prevTrack = () => playerRef.current?.previousTrack();

  const handleVolume = async (val) => {
    const v = Number(val) / 100;
    setVolume(v);
    await playerRef.current?.setVolume(v);
  };

  const playPlaylist = async (pl) => {
    if (!deviceId || !playerReady) { toast.error('Player nicht bereit.'); return; }
    if (!pl.providerPlaylistUri) { toast.error('Keine Spotify URI für diese Playlist.'); return; }
    setLoadingPlaylist(pl.id);
    try {
      // 1. Transfer playback to this browser device first
      await invoke('spotifyAccountControl', {
        action: 'transferPlayback',
        accountId: selectedAccountId,
        deviceId: deviceId,
      });
      // Short wait for transfer to take effect
      await new Promise(r => setTimeout(r, 600));

      // 2. Play the playlist on this device
      const res = await invoke('spotifyAccountControl', {
        action: 'playPlaylist',
        accountId: selectedAccountId,
        contextUri: pl.providerPlaylistUri,
        deviceId: deviceId,
      });
      if (res.data?.success) {
        toast.success(`"${pl.name}" gestartet`);
        setShowPlaylists(false);
      } else {
        toast.error(res.data?.error || 'Fehler beim Starten.');
      }
    } catch (e) {
      toast.error(e.message);
    } finally {
      setLoadingPlaylist(null);
    }
  };

  const track = playerState?.track_window?.current_track;
  const isPlaying = playerState ? !playerState.paused : false;
  const posMs = playerState?.position || 0;
  const durMs = track?.duration_ms || 1;
  const progressPct = Math.min(100, (posMs / durMs) * 100);
  const volPct = Math.round(volume * 100);

  const accountPlaylists = playlists.filter(p =>
    !selectedAccountId || p.spotifyAccountId === selectedAccountId
  );

  return (
    <div className="min-h-screen aurora-bg flex flex-col items-center justify-center p-4">
      {/* Header */}
      <div className="w-full max-w-sm mb-6 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center">
            <Music2 className="w-4 h-4 text-primary" />
          </div>
          <span className="font-black text-sm gradient-text">StudioSoundSet</span>
        </div>
        <Link to="/dashboard">
          <Button variant="ghost" size="sm" className="text-xs text-muted-foreground gap-1.5">
            Admin Hub →
          </Button>
        </Link>
      </div>

      {/* Account Selector */}
      {connectedAccounts.length > 1 && (
        <div className="w-full max-w-sm mb-4 flex gap-2 flex-wrap">
          {connectedAccounts.map(acc => (
            <button
              key={acc.id}
              onClick={() => setSelectedAccountId(acc.id)}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${
                selectedAccountId === acc.id
                  ? 'bg-primary text-white border-primary'
                  : 'border-border text-muted-foreground hover:border-primary/50'
              }`}
            >
              {acc.displayName}
            </button>
          ))}
        </div>
      )}

      {connectedAccounts.length === 0 && (
        <div className="w-full max-w-sm bento-panel p-5 text-center">
          <AlertCircle className="w-8 h-8 text-yellow-400 mx-auto mb-3" />
          <p className="font-bold mb-1">Kein Account verbunden</p>
          <p className="text-sm text-muted-foreground mb-4">Verbinde zuerst einen Spotify Premium Account.</p>
          <Link to="/spotify-accounts">
            <Button className="bg-primary">Zu Spotify Accounts</Button>
          </Link>
        </div>
      )}

      {selectedAccountId && (
        <div className="w-full max-w-sm space-y-4">
          {/* Status Bar */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {status === 'ready' ? (
                <><Wifi className="w-4 h-4 text-green-400" /><span className="text-xs text-green-400 font-semibold">Player aktiv</span></>
              ) : status === 'loading' ? (
                <><RefreshCw className="w-4 h-4 text-primary animate-spin" /><span className="text-xs text-muted-foreground">Verbinde...</span></>
              ) : status === 'error' ? (
                <><WifiOff className="w-4 h-4 text-red-400" /><span className="text-xs text-red-400">Fehler</span></>
              ) : null}
            </div>
            <Button variant="ghost" size="sm" className="h-7 text-xs gap-1" onClick={initPlayer}>
              <RefreshCw className="w-3 h-3" /> Neu verbinden
            </Button>
          </div>

          {error && (
            <div className="bento-panel border-red-500/20 bg-red-500/5 p-3 flex flex-col gap-2">
              <div className="flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-red-300">
                  {error.startsWith('AUTH_SCOPE_ERROR:')
                    ? 'Token-Berechtigungen fehlen (streaming). Account muss neu verbunden werden.'
                    : error}
                </p>
              </div>
              {error.startsWith('AUTH_SCOPE_ERROR:') && (
                <Link to="/spotify-accounts">
                  <Button size="sm" className="w-full bg-red-500 hover:bg-red-600 text-white text-xs h-8">
                    → Jetzt Account neu verbinden
                  </Button>
                </Link>
              )}
            </div>
          )}

          {/* Main Player Card */}
          <div className="bento-panel p-6 space-y-6">
            {/* Album Art + Track */}
            <div className="text-center space-y-4">
              <div className="relative mx-auto w-48 h-48">
                {track?.album?.images?.[0]?.url ? (
                  <img
                    src={track.album.images[0].url}
                    alt={track.album.name}
                    className="w-full h-full rounded-2xl shadow-2xl object-cover"
                  />
                ) : (
                  <div className="w-full h-full rounded-2xl bg-muted/20 flex items-center justify-center">
                    <Music2 className="w-16 h-16 text-muted-foreground/20" />
                  </div>
                )}
                {isPlaying && (
                  <div className="absolute bottom-2 right-2 flex items-end gap-0.5 h-5">
                    {[1,2,3].map(i => (
                      <div key={i} className="eq-bar w-1.5 bg-green-400 rounded-full" style={{ '--delay': `${i * 0.2}s`, height: '100%' }} />
                    ))}
                  </div>
                )}
              </div>
              <div>
                <p className="font-bold text-lg truncate">{track?.name || 'Keine Wiedergabe'}</p>
                <p className="text-sm text-muted-foreground truncate">
                  {track?.artists?.map(a => a.name).join(', ') || 'Wähle eine Playlist'}
                </p>
                {track?.album?.name && (
                  <p className="text-xs text-muted-foreground/60 truncate mt-0.5">{track.album.name}</p>
                )}
              </div>
            </div>

            {/* Progress */}
            <div className="space-y-1">
              <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary rounded-full transition-all duration-1000"
                  style={{ width: `${progressPct}%` }}
                />
              </div>
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>{formatMs(posMs)}</span>
                <span>{formatMs(durMs)}</span>
              </div>
            </div>

            {/* Controls */}
            <div className="flex items-center justify-center gap-6">
              <button
                onClick={prevTrack}
                disabled={!playerReady}
                className="text-muted-foreground hover:text-foreground disabled:opacity-30 transition-colors"
              >
                <SkipBack className="w-6 h-6" />
              </button>
              <button
                onClick={togglePlay}
                disabled={!playerReady}
                className={`w-14 h-14 rounded-full flex items-center justify-center transition-all shadow-lg disabled:opacity-30 ${
                  isPlaying
                    ? 'bg-white text-black hover:bg-white/90'
                    : 'bg-primary text-white hover:bg-primary/90'
                }`}
              >
                {isPlaying ? <Pause className="w-6 h-6" /> : <Play className="w-6 h-6 ml-0.5" />}
              </button>
              <button
                onClick={nextTrack}
                disabled={!playerReady}
                className="text-muted-foreground hover:text-foreground disabled:opacity-30 transition-colors"
              >
                <SkipForward className="w-6 h-6" />
              </button>
            </div>

            {/* Volume */}
            <div className="flex items-center gap-3">
              <VolumeX className="w-4 h-4 text-muted-foreground flex-shrink-0" />
              <div className="flex-1">
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={volPct}
                  onChange={e => handleVolume(e.target.value)}
                  className="w-full h-2 rounded-full appearance-none cursor-pointer"
                  style={{
                    background: `linear-gradient(to right, hsl(var(--primary)) ${volPct}%, hsl(var(--border)) ${volPct}%)`,
                    WebkitAppearance: 'none',
                  }}
                />
              </div>
              <Volume2 className="w-4 h-4 text-muted-foreground flex-shrink-0" />
              <span className="text-xs text-muted-foreground w-8 text-right">{volPct}%</span>
            </div>
          </div>

          {/* Playlist Button */}
          <button
            onClick={() => setShowPlaylists(!showPlaylists)}
            className="w-full bento-panel p-4 flex items-center gap-3 hover:border-primary/40 transition-all"
          >
            <List className="w-5 h-5 text-primary" />
            <span className="font-semibold flex-1 text-left">Playlists ({accountPlaylists.length})</span>
            <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform ${showPlaylists ? 'rotate-180' : ''}`} />
          </button>

          <AnimatePresence>
            {showPlaylists && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="overflow-hidden"
              >
                <div className="bento-panel divide-y divide-border/30 max-h-80 overflow-y-auto">
                  {accountPlaylists.length === 0 ? (
                    <div className="p-6 text-center text-sm text-muted-foreground">
                      Keine Playlists importiert. <Link to="/playlists" className="text-primary underline">Jetzt importieren</Link>
                    </div>
                  ) : (
                    accountPlaylists.map(pl => (
                      <button
                        key={pl.id}
                        onClick={() => playPlaylist(pl)}
                        disabled={loadingPlaylist === pl.id || !playerReady}
                        className="w-full flex items-center gap-3 p-3 hover:bg-primary/5 transition-colors text-left disabled:opacity-50"
                      >
                        {pl.coverUrl ? (
                          <img src={pl.coverUrl} alt={pl.name} className="w-10 h-10 rounded-lg flex-shrink-0 object-cover" />
                        ) : (
                          <div className="w-10 h-10 bg-muted/30 rounded-lg flex items-center justify-center flex-shrink-0">
                            <Music2 className="w-4 h-4 text-muted-foreground" />
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-sm truncate">{pl.name}</p>
                          <p className="text-xs text-muted-foreground">{pl.importedTracks || pl.totalTracks || 0} Songs</p>
                        </div>
                        {loadingPlaylist === pl.id ? (
                          <RefreshCw className="w-4 h-4 animate-spin text-primary flex-shrink-0" />
                        ) : (
                          <Play className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                        )}
                      </button>
                    ))
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Info */}
          {status !== 'ready' && (
            <p className="text-xs text-muted-foreground text-center">
              Spotify Premium wird für den Browser-Player benötigt.
            </p>
          )}
        </div>
      )}
    </div>
  );
}