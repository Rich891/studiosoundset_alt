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

function formatMs(ms) {
  const s = Math.floor(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

function PlayerCard({ player, provider, playlists }) {
  const [actionLoading, setActionLoading] = useState(false);
  const queryClient = useQueryClient();
  const tickerRef = useRef(null);
  const [localProgress, setLocalProgress] = useState(player?.progressMs || 0);

  const startTicker = useCallback((startMs) => {
    if (tickerRef.current) clearInterval(tickerRef.current);
    let ms = startMs;
    tickerRef.current = setInterval(() => {
      ms += 1000;
      const dur = player?.currentTrackDuration || 1;
      setLocalProgress(Math.min(ms, dur));
    }, 1000);
  }, [player?.currentTrackDuration]);

  const stopTicker = useCallback(() => {
    if (tickerRef.current) {
      clearInterval(tickerRef.current);
      tickerRef.current = null;
    }
  }, []);

  useEffect(() => {
    setLocalProgress(player?.progressMs || 0);
    if (player?.isPlaying) {
      startTicker(player?.progressMs || 0);
    } else {
      stopTicker();
    }
    return () => stopTicker();
  }, [player?.progressMs, player?.isPlaying, startTicker, stopTicker]);

  const sendCommand = async (command, payload = {}) => {
    setActionLoading(true);
    try {
      const res = await base44.functions.invoke('playerControl', {
        playerId: player.id,
        command,
        payload,
      });

      if (res.data?.success) {
        toast.success(`${command} ausgeführt`);
        setTimeout(() => {
          queryClient.invalidateQueries({ queryKey: ['players'] });
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
    const pl = playlists.find(p => p.id === playlistId);
    if (!pl?.providerPlaylistUri) {
      toast.error('Keine Spotify URI für diese Playlist.');
      return;
    }
    await sendCommand('playPlaylist', { contextUri: pl.providerPlaylistUri });
  };

  const handleVolume = async (val) => {
    const num = Number(val);
    await sendCommand('setVolume', { volume: num });
  };

  // Online wenn lastSeen < 10s alt
  const isOnline = player?.lastSeen && 
    (Date.now() - new Date(player.lastSeen).getTime()) < 10000;

  const dur = player?.currentTrackDuration || 1;
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
            <p className="font-bold text-sm">{player.name}</p>
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
            queryClient.invalidateQueries({ queryKey: ['players'] });
            toast.success('Aktualisiert');
          }}
          className="text-muted-foreground hover:text-foreground transition-colors"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      <div className="p-5 space-y-4">
        {/* Not playing */}
        {!player.currentTrackName ? (
          <div className="py-4 space-y-4 text-center">
            <p className="text-muted-foreground text-sm">Keine aktive Wiedergabe</p>
            {playlists.length > 0 && (
              <div className="flex items-center gap-2">
                <ListMusic className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                <Select onValueChange={handlePlayPlaylist} disabled={actionLoading}>
                  <SelectTrigger className="flex-1 h-9 text-xs bg-muted/30 border-border/50">
                    <SelectValue placeholder="Playlist starten..." />
                  </SelectTrigger>
                  <SelectContent>
                    {playlists.map(pl => (
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
                value={player.volume || 50}
                onChange={e => handleVolume(e.target.value)}
                className="flex-1 h-2 rounded-full"
                style={{ background: `linear-gradient(to right, hsl(var(--primary)) ${player.volume}%, hsl(var(--border)) ${player.volume}%)`, WebkitAppearance: 'none' }}
              />
              <span className="text-xs text-muted-foreground w-8 text-right">{player.volume}%</span>
            </div>
          </div>
        ) : (
          <>
            {/* Now playing */}
            <div className="flex items-center gap-4">
              {player.currentTrackCoverUrl ? (
                <img src={player.currentTrackCoverUrl} alt="cover" className="w-16 h-16 rounded-xl shadow-lg flex-shrink-0 object-cover" />
              ) : (
                <div className="w-16 h-16 rounded-xl bg-muted/20 flex items-center justify-center flex-shrink-0">
                  <Music2 className="w-8 h-8 text-muted-foreground/30" />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="font-bold truncate text-sm">{player.currentTrackName}</p>
                <p className="text-xs text-muted-foreground truncate">{player.currentTrackArtist}</p>
              </div>
              <div className={`w-2 h-2 rounded-full flex-shrink-0 ${player.isPlaying ? 'bg-green-400 animate-pulse' : 'bg-muted-foreground'}`} />
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
                className={`w-11 h-11 rounded-full ${player.isPlaying ? 'bg-muted hover:bg-muted/80' : 'bg-primary hover:bg-primary/90'}`}
                onClick={() => sendCommand(player.isPlaying ? 'pause' : 'resume')}
                disabled={actionLoading}
              >
                {player.isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5 ml-0.5" />}
              </Button>
              <Button variant="ghost" size="icon" onClick={() => sendCommand('next')} disabled={actionLoading}>
                <SkipForward className="w-5 h-5" />
              </Button>
            </div>

            {/* Playlist select */}
            {playlists.length > 0 && (
              <div className="flex items-center gap-2">
                <ListMusic className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                <Select onValueChange={handlePlayPlaylist}>
                  <SelectTrigger className="flex-1 h-8 text-xs bg-muted/30 border-border/50">
                    <SelectValue placeholder="Playlist abspielen..." />
                  </SelectTrigger>
                  <SelectContent>
                    {playlists.map(pl => (
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
                value={player.volume || 50}
                onChange={e => handleVolume(e.target.value)}
                className="flex-1 h-2 rounded-full"
                style={{ background: `linear-gradient(to right, hsl(var(--primary)) ${player.volume}%, hsl(var(--border)) ${player.volume}%)`, WebkitAppearance: 'none' }}
              />
              <span className="text-xs text-muted-foreground w-8 text-right">{player.volume}%</span>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default function NowPlaying() {
  const { data: players = [] } = useQuery({
    queryKey: ['players'],
    queryFn: () => base44.entities.Player.list('-lastSeen'),
    refetchInterval: 3000,
  });

  const { data: zones = [] } = useQuery({
    queryKey: ['zones'],
    queryFn: () => base44.entities.Zone.list(),
  });

  const { data: providers = [] } = useQuery({
    queryKey: ['providers'],
    queryFn: () => base44.entities.Provider.list(),
  });

  const { data: playlists = [] } = useQuery({
    queryKey: ['playlists'],
    queryFn: () => base44.entities.Playlist.list(),
  });

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
            <p className="text-sm text-muted-foreground mt-1 ml-14">Live Player Control ({players.length} Players)</p>
          </div>
        </div>
      </motion.div>

      {players.length === 0 ? (
        <div className="bento-panel border-dashed border-primary/20 p-16 text-center">
          <Radio className="w-16 h-16 text-muted-foreground/20 mx-auto mb-4" />
          <h3 className="text-xl font-bold mb-2">Keine Player vorhanden</h3>
          <p className="text-muted-foreground text-sm">Erstelle zuerst Player in den Zonen.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-5">
          {players.map((player, i) => {
            const zone = zones.find(z => z.id === player.zoneId);
            const provider = zone ? providers.find(p => p.id === zone.providerId) : null;
            const playerPlaylists = zone ? playlists.filter(p => p.providerId === zone.providerId) : [];

            return (
              <motion.div 
                key={player.id} 
                initial={{ opacity: 0, y: 15 }} 
                animate={{ opacity: 1, y: 0 }} 
                transition={{ delay: i * 0.07 }}
              >
                {provider && zone ? (
                  <PlayerCard 
                    player={player} 
                    provider={provider}
                    playlists={playerPlaylists}
                  />
                ) : (
                  <div className="bento-panel p-5 text-center">
                    <AlertCircle className="w-8 h-8 text-yellow-400 mx-auto mb-2" />
                    <p className="text-sm font-bold">{player.name}</p>
                    <p className="text-xs text-muted-foreground mt-1">Zone oder Provider nicht gefunden</p>
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