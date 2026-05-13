import { useState, useEffect, useRef, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import PlayerLogin from '@/pages/PlayerLogin';
import {
  Play, Pause, SkipForward, SkipBack, Volume2, VolumeX,
  Music2, RefreshCw, AlertCircle, Wifi, WifiOff, List,
  ChevronDown, LogOut
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';
import { Link } from 'react-router-dom';

const invoke = (fn, payload) => base44.functions.invoke(fn, payload);

// Sync player state to PlayerDevice
async function syncPlayerStatus(state, playerUser) {
  if (!state || !playerUser) return;
  
  try {
    const track = state.track_window?.current_track;
    const contextUri = state.track_window?.current_context?.uri;
    const updateData = {
      isPlaying: !state.paused,
      progressMs: state.position || 0,
      volume: Math.round((state.device?.volume_percent || 0)),
      lastStatusUpdate: new Date().toISOString(),
      lastSeen: new Date().toISOString(),
      isPaired: true,
      isActive: true,
      userId: playerUser.id, // KRITISCH: userId muss PlayerUser.id sein!
    };
    
    if (track) {
      updateData.currentTrackName = track.name || '';
      updateData.currentTrackArtist = track.artists?.[0]?.name || '';
      updateData.currentTrackAlbum = track.album?.name || '';
      updateData.currentTrackCoverUrl = track.album?.images?.[0]?.url || '';
      updateData.currentTrackUri = track.uri || '';
      updateData.currentTrackDuration = track.duration_ms || 0;
    }
    
    if (contextUri) {
      updateData.currentPlaylistUri = contextUri;
    }
    
    // Finde PlayerDevice via playerUser.id
    const devices = await base44.entities.PlayerDevice.list();
    const device = devices.find(d => d.userId === playerUser.id);
    
    if (device) {
      await base44.entities.PlayerDevice.update(device.id, updateData);
    }
  } catch (error) {
    console.error('Failed to sync player status:', error);
  }
}

function formatMs(ms) {
  const s = Math.floor(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

export default function PlayerNew() {
  const [playerUser, setPlayerUser] = useState(null);
  const [loading, setLoading] = useState(true);
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

  // Check session on mount
  useEffect(() => {
    const sessionToken = localStorage.getItem('playerSessionToken');
    const storedUser = localStorage.getItem('playerUser');

    if (sessionToken && storedUser) {
      try {
        setPlayerUser(JSON.parse(storedUser));
      } catch (e) {
        localStorage.removeItem('playerSessionToken');
        localStorage.removeItem('playerUser');
      }
    }
    setLoading(false);
  }, []);

  // Load playlists für diesen Spotify Account
  const { data: playlists = [] } = useQuery({
    queryKey: ['playlists', playerUser?.spotifyAccountId],
    queryFn: () => {
      if (!playerUser?.spotifyAccountId) return [];
      return base44.entities.Playlist.filter({ spotifyAccountId: playerUser.spotifyAccountId });
    },
    enabled: !!playerUser,
  });

  // Load Spotify Web Playback SDK
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
      document.body.removeChild(script);
    };
  }, []);

  // Init Player
  const initPlayer = useCallback(async () => {
    if (!playerUser) return;
    setStatus('loading');
    setError('');

    if (playerRef.current) {
      playerRef.current.disconnect();
      playerRef.current = null;
    }

    try {
      const res = await invoke('spotifyAccountControl', {
        action: 'getAccessToken',
        accountId: playerUser.spotifyAccountId,
      });

      if (!res.data?.success || !res.data?.accessToken) {
        throw new Error('Kein Token verfügbar.');
      }

      const accessToken = res.data.accessToken;

      let waited = 0;
      while (!sdkReadyRef.current && waited < 5000) {
        await new Promise(r => setTimeout(r, 200));
        waited += 200;
      }

      if (!window.Spotify) {
        throw new Error('Spotify SDK konnte nicht geladen werden.');
      }

      const player = new window.Spotify.Player({
        name: `${playerUser.deviceName} Player`,
        getOAuthToken: async (cb) => {
          const r = await invoke('spotifyAccountControl', {
            action: 'getAccessToken',
            accountId: playerUser.spotifyAccountId,
          });
          cb(r.data?.accessToken || accessToken);
        },
        volume: volume,
      });

      player.addListener('ready', async ({ device_id }) => {
        setDeviceId(device_id);
        setPlayerReady(true);
        setStatus('ready');
        toast.success('Player bereit!');
        
        // Markiere Device als gekoppelt und aktiv
        try {
          const devices = await base44.entities.PlayerDevice.list();
          const device = devices.find(d => d.userId === playerUser.id);
          if (device) {
            await base44.entities.PlayerDevice.update(device.id, {
              isPaired: true,
              isActive: true,
              userId: playerUser.id, // Stelle sicher dass userId korrekt ist
              lastSeen: new Date().toISOString(),
            });
          }
        } catch (e) {
          console.error('Failed to mark device as paired:', e);
        }
        
        invoke('spotifyAccountControl', {
          action: 'transferPlayback',
          accountId: playerUser.spotifyAccountId,
          deviceId: device_id,
        }).catch(e => console.warn('Auto-transfer failed:', e));
      });

      player.addListener('not_ready', () => {
        setPlayerReady(false);
        setStatus('error');
        setError('Verbindung unterbrochen.');
      });

      player.addListener('player_state_changed', (state) => {
        setPlayerState(state);
        // Sync status to PlayerDevice
        syncPlayerStatus(state, playerUser);
      });

      player.addListener('initialization_error', ({ message }) => {
        setError('Init Fehler: ' + message);
        setStatus('error');
      });

      player.addListener('authentication_error', ({ message }) => {
        setError('Token-Fehler: ' + message);
        setStatus('error');
      });

      player.addListener('account_error', ({ message }) => {
        setError('Account Fehler: ' + message);
        setStatus('error');
      });

      await player.connect();
      playerRef.current = player;
    } catch (e) {
      setError(e.message);
      setStatus('error');
    }
  }, [playerUser]);

  useEffect(() => {
    if (playerUser) initPlayer();
    return () => {
      if (playerRef.current) {
        playerRef.current.disconnect();
        playerRef.current = null;
      }
    };
  }, [playerUser]);

  // Controls
  const togglePlay = async () => {
    playerRef.current?.togglePlay();
    await new Promise(r => setTimeout(r, 500));
    const state = playerRef.current?.getState?.();
    if (state) await syncPlayerStatus(state, playerUser);
  };
  
  const nextTrack = async () => {
    playerRef.current?.nextTrack();
    await new Promise(r => setTimeout(r, 500));
    const state = playerRef.current?.getState?.();
    if (state) await syncPlayerStatus(state, playerUser);
  };
  
  const prevTrack = async () => {
    playerRef.current?.previousTrack();
    await new Promise(r => setTimeout(r, 500));
    const state = playerRef.current?.getState?.();
    if (state) await syncPlayerStatus(state, playerUser);
  };

  const handleVolume = async (val) => {
    const v = Number(val) / 100;
    setVolume(v);
    await playerRef.current?.setVolume(v);
    // Sync volume to PlayerDevice
    try {
      const devices = await base44.entities.PlayerDevice.list();
      const device = devices.find(d => d.userId === playerUser.id);
      if (device) {
        await base44.entities.PlayerDevice.update(device.id, {
          volume: Math.round(v * 100),
          isPaired: true,
          isActive: true,
          userId: playerUser.id,
          lastSeen: new Date().toISOString(),
        });
      }
    } catch (e) {
      console.error('Volume sync failed:', e);
    }
  };

  const playPlaylist = async (pl) => {
    if (!playerReady) {
      toast.error('Player nicht bereit.');
      return;
    }
    if (!pl.providerPlaylistUri) {
      toast.error('Keine Spotify URI.');
      return;
    }
    if (!deviceId) {
      toast.error('Device ID fehlt.');
      return;
    }

    setLoadingPlaylist(pl.id);
    try {
      const res = await invoke('spotifyAccountControl', {
        action: 'playPlaylist',
        accountId: playerUser.spotifyAccountId,
        contextUri: pl.providerPlaylistUri,
        deviceId: deviceId,
      });

      if (res.data?.success) {
        toast.success(`▶ "${pl.name}"`);
        setShowPlaylists(false);
        // Sync status nach Playlist-Start
        await new Promise(r => setTimeout(r, 800));
        const state = playerRef.current?.getState?.();
        if (state) await syncPlayerStatus(state, playerUser);
      } else {
        toast.error(res.data?.error || 'Starten fehlgeschlagen.');
      }
    } catch (e) {
      toast.error(e.message);
    } finally {
      setLoadingPlaylist(null);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('playerSessionToken');
    localStorage.removeItem('playerUser');
    window.location.reload();
  };

  if (loading) {
    return (
      <div className="min-h-screen aurora-bg flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
          <p className="text-sm text-muted-foreground">Lade...</p>
        </div>
      </div>
    );
  }

  if (!playerUser) {
    return <PlayerLogin onLoginSuccess={() => {
      const user = JSON.parse(localStorage.getItem('playerUser'));
      setPlayerUser(user);
    }} />;
  }

  const track = playerState?.track_window?.current_track;
  const isPlaying = playerState ? !playerState.paused : false;
  const posMs = playerState?.position || 0;
  const durMs = track?.duration_ms || 1;
  const progressPct = Math.min(100, (posMs / durMs) * 100);
  const volPct = Math.round(volume * 100);

  return (
    <div className="min-h-screen aurora-bg flex flex-col items-center justify-center p-4">
      {/* Header */}
      <div className="w-full max-w-sm mb-6 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center">
            <Music2 className="w-4 h-4 text-primary" />
          </div>
          <div>
            <p className="font-black text-xs gradient-text">StudioSoundSet</p>
            <p className="text-[10px] text-muted-foreground">{playerUser.deviceName}</p>
          </div>
        </div>
        <Button variant="ghost" size="sm" onClick={handleLogout} className="h-8 gap-1">
          <LogOut className="w-3 h-3" />
          <span className="text-xs">Logout</span>
        </Button>
      </div>

      {playerUser && (
        <div className="w-full max-w-sm space-y-4">
          {/* Status */}
          <div className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-2">
              {status === 'ready' ? (
                <>
                  <Wifi className="w-4 h-4 text-green-400" />
                  <span className="text-green-400 font-semibold">Player aktiv</span>
                </>
              ) : status === 'loading' ? (
                <>
                  <RefreshCw className="w-4 h-4 text-primary animate-spin" />
                  <span className="text-muted-foreground">Verbinde...</span>
                </>
              ) : status === 'error' ? (
                <>
                  <WifiOff className="w-4 h-4 text-red-400" />
                  <span className="text-red-400">Fehler</span>
                </>
              ) : null}
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 text-xs gap-1"
              onClick={initPlayer}
            >
              <RefreshCw className="w-3 h-3" /> Neu verbinden
            </Button>
          </div>

          {error && (
            <div className="bento-panel border-red-500/20 bg-red-500/5 p-3 flex gap-2">
              <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-red-300">{error}</p>
            </div>
          )}

          {/* Player Card */}
          <div className="bento-panel p-6 space-y-6">
            {/* Album Art */}
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
                    {[1, 2, 3].map(i => (
                      <div
                        key={i}
                        className="eq-bar w-1.5 bg-green-400 rounded-full"
                        style={{ '--delay': `${i * 0.2}s`, height: '100%' }}
                      />
                    ))}
                  </div>
                )}
              </div>
              <div>
                <p className="font-bold text-lg truncate">{track?.name || 'Keine Wiedergabe'}</p>
                <p className="text-sm text-muted-foreground truncate">
                  {track?.artists?.map(a => a.name).join(', ') || 'Wähle eine Playlist'}
                </p>
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
                className="text-muted-foreground hover:text-foreground disabled:opacity-30"
              >
                <SkipBack className="w-6 h-6" />
              </button>
              <button
                onClick={togglePlay}
                disabled={!playerReady}
                className={`w-14 h-14 rounded-full flex items-center justify-center transition-all disabled:opacity-30 ${
                  isPlaying
                    ? 'bg-white text-black hover:bg-white/90'
                    : 'bg-primary text-white hover:bg-primary/90'
                }`}
              >
                {isPlaying ? (
                  <Pause className="w-6 h-6" />
                ) : (
                  <Play className="w-6 h-6 ml-0.5" />
                )}
              </button>
              <button
                onClick={nextTrack}
                disabled={!playerReady}
                className="text-muted-foreground hover:text-foreground disabled:opacity-30"
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
                  className="w-full h-2 rounded-full"
                  style={{
                    background: `linear-gradient(to right, hsl(var(--primary)) ${volPct}%, hsl(var(--border)) ${volPct}%)`,
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
            <span className="font-semibold flex-1 text-left">Playlists ({playlists.length})</span>
            <ChevronDown
              className={`w-4 h-4 text-muted-foreground transition-transform ${
                showPlaylists ? 'rotate-180' : ''
              }`}
            />
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
                  {playlists.length === 0 ? (
                    <div className="p-6 text-center text-sm text-muted-foreground">
                      Keine Playlists verfügbar
                    </div>
                  ) : (
                    playlists.map(pl => (
                      <button
                        key={pl.id}
                        onClick={() => playPlaylist(pl)}
                        disabled={loadingPlaylist === pl.id || !playerReady}
                        className="w-full flex items-center gap-3 p-3 hover:bg-primary/5 transition-colors text-left disabled:opacity-50"
                      >
                        {pl.coverUrl ? (
                          <img
                            src={pl.coverUrl}
                            alt={pl.name}
                            className="w-10 h-10 rounded-lg flex-shrink-0 object-cover"
                          />
                        ) : (
                          <div className="w-10 h-10 bg-muted/30 rounded-lg flex items-center justify-center flex-shrink-0">
                            <Music2 className="w-4 h-4 text-muted-foreground" />
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-sm truncate">{pl.name}</p>
                          <p className="text-xs text-muted-foreground">{pl.importedTracks || 0} Songs</p>
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
        </div>
      )}
    </div>
  );
}