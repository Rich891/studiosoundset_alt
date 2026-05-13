import { useState, useEffect, useRef, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { motion } from 'framer-motion';
import {
  Radio, RefreshCw, AlertCircle, Play, Pause, SkipForward, SkipBack,
  Volume2, ListMusic, Wifi, WifiOff, Music2
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';

const invoke = (fn, payload) => base44.functions.invoke(fn, payload);

function formatMs(ms) {
  const s = Math.floor(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

function PlayerDeviceCard({ playerUser, playerDevice, account, playlists }) {
  const [actionLoading, setActionLoading] = useState(false);
  const queryClient = useQueryClient();
  const tickerRef = useRef(null);
  const [localProgress, setLocalProgress] = useState(playerDevice?.progressMs || 0);

  // Merge device data (PlayerDevice hat Precedence für Status)
  const device = {
    id: playerUser.id,
    name: playerUser.deviceName,
    spotifyAccountId: playerUser.spotifyAccountId,
    ...playerDevice, // PlayerDevice Status überschreibt
  };

  const accountPlaylists = playlists.filter(p => p.spotifyAccountId === account?.id);

  const startTicker = useCallback((startMs) => {
    if (tickerRef.current) clearInterval(tickerRef.current);
    let ms = startMs;
    tickerRef.current = setInterval(() => {
      ms += 1000;
      const dur = device.currentTrackDuration || 1;
      setLocalProgress(Math.min(ms, dur));
    }, 1000);
  }, [device.currentTrackDuration]);

  const stopTicker = useCallback(() => {
    if (tickerRef.current) {
      clearInterval(tickerRef.current);
      tickerRef.current = null;
    }
  }, []);

  useEffect(() => {
    setLocalProgress(device.progressMs || 0);
    if (device.isPlaying) {
      startTicker(device.progressMs || 0);
    } else {
      stopTicker();
    }
    return () => stopTicker();
  }, [device.progressMs, device.isPlaying, startTicker, stopTicker]);

  const sendCommand = async (command, payload = {}) => {
    setActionLoading(true);
    try {
      const res = await invoke('playerDeviceCommand', {
        playerDeviceId: device.id,
        command,
        payload,
      });

      if (res.data?.success) {
        toast.success(`${command} ausgeführt`);
        setTimeout(() => {
          queryClient.invalidateQueries({ queryKey: ['playerDevices', 'playerUsers'] });
        }, 500);
      } else {
        toast.error(res.data?.error || 'Fehler');
      }
    } catch (e) {
      toast.error(e.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handlePlayPlaylist = async (playlistId) => {
    const pl = accountPlaylists.find(p => p.id === playlistId);
    if (!pl?.providerPlaylistUri) {
      toast.error('Keine Spotify URI für diese Playlist.');
      return;
    }
    await sendCommand('playPlaylist', { contextUri: pl.providerPlaylistUri });
  };

  const handleVolume = async (val) => {
    const num = Number(val);
    setLocalProgress(num);
    await sendCommand('setVolume', { volume: num });
  };

  // Online = lastSeen < 10s alt
  const isOnline = playerDevice?.lastSeen && 
    (Date.now() - new Date(playerDevice.lastSeen).getTime()) < 10000;

  const dur = device.currentTrackDuration || 1;
  const pct = Math.min(100, Math.round((localProgress / dur) * 100));

  return (
    <div className="bento-panel overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-border/30 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div 
            className="w-3 h-3 rounded-full flex-shrink-0" 
            style={{ background: isOnline ? '#22c55e' : '#fbbf24' }} 
          />
          <div>
            <p className="font-bold text-sm">{device.name}</p>
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              {isOnline ? (
                <>
                  <Wifi className="w-3 h-3 text-green-400" /> Online
                </>
              ) : (
                <>
                  <WifiOff className="w-3 h-3 text-yellow-400" /> Offline
                </>
              )}
            </p>
          </div>
        </div>
        <button
          onClick={() => {
            queryClient.invalidateQueries({ queryKey: ['playerDevices', 'playerUsers'] });
            toast.success('Aktualisiert');
          }}
          className="text-muted-foreground hover:text-foreground transition-colors"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      <div className="p-5 space-y-4">
        {/* Not playing */}
        {!device.currentTrackName ? (
          <div className="py-4 space-y-4 text-center">
            <p className="text-muted-foreground text-sm">Keine aktive Wiedergabe</p>
            {accountPlaylists.length > 0 && (
              <div className="flex items-center gap-2">
                <ListMusic className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                <Select onValueChange={handlePlayPlaylist} disabled={actionLoading}>
                  <SelectTrigger className="flex-1 h-9 text-xs bg-muted/30 border-border/50">
                    <SelectValue placeholder="Playlist starten..." />
                  </SelectTrigger>
                  <SelectContent>
                    {accountPlaylists.map(pl => (
                      <SelectItem key={pl.id} value={pl.id}>{pl.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="flex items-center gap-3">
              <Volume2 className="w-4 h-4 text-muted-foreground flex-shrink-0" />
              <input
                type="range"
                min={0}
                max={100}
                value={device.volume || 50}
                onChange={e => handleVolume(e.target.value)}
                className="flex-1 h-2 rounded-full"
                style={{ background: `linear-gradient(to right, hsl(var(--primary)) ${device.volume}%, hsl(var(--border)) ${device.volume}%)`, WebkitAppearance: 'none' }}
              />
              <span className="text-xs text-muted-foreground w-8 text-right">{device.volume}%</span>
            </div>
          </div>
        ) : (
          <>
            {/* Now playing */}
            <div className="flex items-center gap-4">
              {device.currentTrackCoverUrl ? (
                <img src={device.currentTrackCoverUrl} alt="cover" className="w-16 h-16 rounded-xl shadow-lg flex-shrink-0 object-cover" />
              ) : (
                <div className="w-16 h-16 rounded-xl bg-muted/20 flex items-center justify-center flex-shrink-0">
                  <Music2 className="w-8 h-8 text-muted-foreground/30" />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="font-bold truncate text-sm">{device.currentTrackName}</p>
                <p className="text-xs text-muted-foreground truncate">{device.currentTrackArtist}</p>
                <p className="text-xs text-muted-foreground truncate">{device.currentTrackAlbum}</p>
              </div>
              <div className={`w-2 h-2 rounded-full flex-shrink-0 ${device.isPlaying ? 'bg-green-400 animate-pulse' : 'bg-muted-foreground'}`} />
            </div>

            {/* Progress */}
            <div className="space-y-1">
              <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${pct}%` }} />
              </div>
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>{formatMs(localProgress)}</span>
                <span>{formatMs(dur)}</span>
              </div>
            </div>

            {/* Controls */}
            <div className="flex items-center justify-center gap-3">
              <Button variant="ghost" size="icon" onClick={() => sendCommand('previous')} disabled={actionLoading}>
                <SkipBack className="w-5 h-5" />
              </Button>
              <Button
                size="icon"
                className={`w-11 h-11 rounded-full ${device.isPlaying ? 'bg-muted hover:bg-muted/80' : 'bg-primary hover:bg-primary/90'}`}
                onClick={() => sendCommand(device.isPlaying ? 'pause' : 'resume')}
                disabled={actionLoading}
              >
                {device.isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5 ml-0.5" />}
              </Button>
              <Button variant="ghost" size="icon" onClick={() => sendCommand('next')} disabled={actionLoading}>
                <SkipForward className="w-5 h-5" />
              </Button>
            </div>

            {/* Playlist select */}
            {accountPlaylists.length > 0 && (
              <div className="flex items-center gap-2">
                <ListMusic className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                <Select onValueChange={handlePlayPlaylist}>
                  <SelectTrigger className="flex-1 h-8 text-xs bg-muted/30 border-border/50">
                    <SelectValue placeholder="Playlist abspielen..." />
                  </SelectTrigger>
                  <SelectContent>
                    {accountPlaylists.map(pl => (
                      <SelectItem key={pl.id} value={pl.id}>{pl.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Volume */}
            <div className="flex items-center gap-3">
              <Volume2 className="w-4 h-4 text-muted-foreground flex-shrink-0" />
              <input
                type="range"
                min={0}
                max={100}
                value={device.volume || 50}
                onChange={e => handleVolume(e.target.value)}
                className="flex-1 h-2 rounded-full"
                style={{ background: `linear-gradient(to right, hsl(var(--primary)) ${device.volume}%, hsl(var(--border)) ${device.volume}%)`, WebkitAppearance: 'none' }}
              />
              <span className="text-xs text-muted-foreground w-8 text-right">{device.volume}%</span>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default function NowPlaying() {
  const [debug, setDebug] = useState(false);

  const { data: playerUsers = [] } = useQuery({
    queryKey: ['playerUsers'],
    queryFn: () => base44.entities.PlayerUser.list('-lastLoginAt'),
    refetchInterval: 3000, // Sehr aggressives Refresh
  });

  const { data: playerDevices = [] } = useQuery({
    queryKey: ['playerDevices'],
    queryFn: () => base44.entities.PlayerDevice.list(),
    refetchInterval: 3000, // Sehr aggressives Refresh
  });

  const { data: accounts = [] } = useQuery({
    queryKey: ['spotifyAccounts'],
    queryFn: () => base44.entities.SpotifyAccount.list(),
  });

  const { data: playlists = [] } = useQuery({
    queryKey: ['playlists'],
    queryFn: () => base44.entities.Playlist.list(),
  });

  // Debug-Log
  useEffect(() => {
    if (debug) {
      console.log('🔍 NOWPLAYING DEBUG:', {
        playerUsersCount: playerUsers.length,
        playerDevicesCount: playerDevices.length,
        playerUsers: playerUsers.map(pu => ({ id: pu.id, name: pu.deviceName, spotifyId: pu.spotifyAccountId })),
        playerDevices: playerDevices.map(pd => ({ id: pd.id, userId: pd.userId, lastSeen: pd.lastSeen, isPlaying: pd.isPlaying })),
      });
    }
  }, [playerUsers, playerDevices, debug]);

  // Vereinfachte Merging-Logik
  const devices = playerUsers.map(pu => ({
    playerUser: pu,
    playerDevice: playerDevices.find(pd => pd.userId === pu.id) || {},
  }));

  return (
    <div className="p-4 lg:p-8 space-y-6 max-w-7xl mx-auto">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl lg:text-3xl font-black flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center">
                <Radio className="w-5 h-5 text-rose-400" />
              </div>
              Now Playing
            </h1>
            <p className="text-sm text-muted-foreground mt-1 ml-14">Live Player Control ({playerUsers.length} Players, {playerDevices.length} Devices)</p>
          </div>
          <Button variant="outline" size="sm" onClick={() => setDebug(!debug)}>
            {debug ? '🔍 Debug OFF' : '🔍 Debug ON'}
          </Button>
        </div>
      </motion.div>

      {debug && (
        <div className="bento-panel p-4 bg-muted/20 text-xs space-y-2 font-mono">
          <p>PlayerUsers: {JSON.stringify(playerUsers.map(p => ({ id: p.id.slice(0, 8), name: p.deviceName, userId: p.id })))}</p>
          <p>PlayerDevices: {JSON.stringify(playerDevices.map(p => ({ id: p.id.slice(0, 8), userId: p.userId?.slice(0, 8), lastSeen: p.lastSeen?.slice(-8) })))}</p>
        </div>
      )}

      {devices.length === 0 ? (
        <div className="bento-panel border-dashed border-primary/20 p-16 text-center">
          <Radio className="w-16 h-16 text-muted-foreground/20 mx-auto mb-4" />
          <h3 className="text-xl font-bold mb-2">Keine Player vorhanden</h3>
          <p className="text-muted-foreground text-sm">Erstelle zuerst einen Player in der Geräteverwaltung.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-5">
          {devices.map(({ playerUser, playerDevice }, i) => {
            const account = accounts.find(a => a.id === playerUser.spotifyAccountId);
            return (
              <motion.div 
                key={playerUser.id} 
                initial={{ opacity: 0, y: 15 }} 
                animate={{ opacity: 1, y: 0 }} 
                transition={{ delay: i * 0.07 }}
              >
                {account ? (
                  <PlayerDeviceCard 
                    playerUser={playerUser} 
                    playerDevice={playerDevice} 
                    account={account} 
                    playlists={playlists} 
                  />
                ) : (
                  <div className="bento-panel p-5 text-center">
                    <AlertCircle className="w-8 h-8 text-yellow-400 mx-auto mb-2" />
                    <p className="text-sm font-bold">{playerUser.deviceName}</p>
                    <p className="text-xs text-muted-foreground mt-1">Kein Spotify Account verbunden</p>
                  </div>
                )}
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}