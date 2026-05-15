import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { motion } from 'framer-motion';
import {
  Radio, RefreshCw, AlertCircle, Play, Pause, SkipForward, SkipBack,
  Volume2, ListMusic, Wifi, WifiOff, Music2, CheckCircle2, Clock
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import {
  COMMAND,
  COMMAND_STATUS,
  createPlayerCommand,
  formatMs,
  isPlayerOnline,
  listPlayerCommands,
  markStalePendingCommands,
} from '@/lib/studioSoundSetRuntime';

function PlayerCard({ player, provider, playlists, commands }) {
  const [actionLoading, setActionLoading] = useState(false);
  const [testPlaylistUri, setTestPlaylistUri] = useState('');
  const queryClient = useQueryClient();
  const tickerRef = useRef(null);
  const [localProgress, setLocalProgress] = useState(player?.progressMs || 0);

  const lastCommand = useMemo(() => {
    const list = commands.filter((cmd) => cmd.playerId === player.id);
    return list.sort((a, b) => new Date(b.createdAt || b.created_date || 0) - new Date(a.createdAt || a.created_date || 0))[0];
  }, [commands, player.id]);

  const startTicker = useCallback((startMs) => {
    if (tickerRef.current) clearInterval(tickerRef.current);
    let ms = startMs;
    tickerRef.current = setInterval(() => {
      ms += 1000;
      const dur = player?.currentTrackDuration || player?.durationMs || 1;
      setLocalProgress(Math.min(ms, dur));
    }, 1000);
  }, [player?.currentTrackDuration, player?.durationMs]);

  const stopTicker = useCallback(() => {
    if (tickerRef.current) {
      clearInterval(tickerRef.current);
      tickerRef.current = null;
    }
  }, []);

  useEffect(() => {
    setLocalProgress(player?.progressMs || 0);
    if (player?.isPlaying) startTicker(player?.progressMs || 0);
    else stopTicker();
    return () => stopTicker();
  }, [player?.progressMs, player?.isPlaying, startTicker, stopTicker]);

  const sendCommand = async (type, payload = {}) => {
    setActionLoading(true);
    try {
      if (!isPlayerOnline(player)) {
        toast.error('Player ist offline. Öffne den Player und warte auf Heartbeat.');
      }
      await createPlayerCommand(player, type, payload);
      toast.success(`${type} gesendet. Warte auf Player-Bestätigung.`);
      queryClient.invalidateQueries({ queryKey: ['playerCommands'] });
      setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: ['players'] });
        queryClient.invalidateQueries({ queryKey: ['playerCommands'] });
      }, 2500);
    } catch (e) {
      toast.error(e.message || 'Command konnte nicht erstellt werden.');
    } finally {
      setActionLoading(false);
    }
  };

  const handlePlayPlaylist = async (playlistId) => {
    const pl = playlists.find(p => p.id === playlistId);
    if (!pl?.providerPlaylistUri) return toast.error('Keine Spotify URI für diese Playlist.');
    await sendCommand(COMMAND.PLAY_PLAYLIST, { playlistId: pl.id, contextUri: pl.providerPlaylistUri });
  };

  const handleTestPlaylist = async () => {
    const uri = testPlaylistUri.trim();
    if (!uri) return toast.error('Spotify Playlist URI oder Link eintragen.');
    const contextUri = uri.startsWith('spotify:playlist:') ? uri : uri.includes('/playlist/') ? `spotify:playlist:${uri.split('/playlist/')[1].split('?')[0]}` : uri;
    if (!contextUri.startsWith('spotify:playlist:')) return toast.error('Ungültige Playlist URI.');
    await sendCommand(COMMAND.PLAY_PLAYLIST, { contextUri });
  };

  const online = isPlayerOnline(player);
  const dur = player?.currentTrackDuration || player?.durationMs || 1;
  const pct = Math.min(100, Math.round((localProgress / dur) * 100));
  const coverUrl = player.currentTrackCoverUrl;

  return (
    <div className="bento-panel overflow-hidden">
      <div className="p-4 border-b border-border/30 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: online ? '#22c55e' : '#f97316' }} />
          <div>
            <p className="font-bold text-sm">{player.name}</p>
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              {online ? <><Wifi className="w-3 h-3 text-green-400" /> Online</> : <><WifiOff className="w-3 h-3 text-orange-400" /> Offline</>}
            </p>
          </div>
        </div>
        <button onClick={() => queryClient.invalidateQueries({ queryKey: ['players'] })} className="text-muted-foreground hover:text-foreground transition-colors" title="Refresh">
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      <div className="p-5 space-y-4">
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="bg-background/50 rounded-lg p-2 border border-border/30">SDK Ready: <span className={player.sdkReady ? 'text-green-400' : 'text-yellow-400'}>{player.sdkReady ? 'yes' : 'no'}</span></div>
          <div className="bg-background/50 rounded-lg p-2 border border-border/30">Device: <span className="font-mono">{player.spotifyDeviceId ? 'set' : 'missing'}</span></div>
        </div>

        {!player.currentTrackName ? (
          <div className="py-4 space-y-4 text-center">
            <p className="text-muted-foreground text-sm">Keine aktive Wiedergabe</p>
            <div className="flex items-center gap-2">
              <ListMusic className="w-4 h-4 text-muted-foreground flex-shrink-0" />
              <Select onValueChange={handlePlayPlaylist} disabled={actionLoading || playlists.length === 0}>
                <SelectTrigger className="flex-1 h-9 text-xs bg-muted/30 border-border/50">
                  <SelectValue placeholder="Playlist starten..." />
                </SelectTrigger>
                <SelectContent>{playlists.map(pl => <SelectItem key={pl.id} value={pl.id}>{pl.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
        ) : (
          <>
            <div className="flex items-center gap-4">
              {coverUrl ? <img src={coverUrl} alt="cover" className="w-16 h-16 rounded-xl shadow-lg flex-shrink-0 object-cover" /> : <div className="w-16 h-16 rounded-xl bg-muted/20 flex items-center justify-center flex-shrink-0"><Music2 className="w-8 h-8 text-muted-foreground/30" /></div>}
              <div className="flex-1 min-w-0">
                <p className="font-bold truncate text-sm">{player.currentTrackName}</p>
                <p className="text-xs text-muted-foreground truncate">{player.currentTrackArtist}</p>
                <p className="text-xs text-muted-foreground truncate">{player.currentTrackAlbum}</p>
              </div>
              <div className={`w-2 h-2 rounded-full flex-shrink-0 ${player.isPlaying ? 'bg-green-400 animate-pulse' : 'bg-muted-foreground'}`} />
            </div>

            <div className="space-y-1">
              <div className="h-1.5 bg-muted rounded-full overflow-hidden"><div className="h-full bg-primary rounded-full transition-all" style={{ width: `${pct}%` }} /></div>
              <div className="flex justify-between text-xs text-muted-foreground"><span>{formatMs(localProgress)}</span><span>{formatMs(dur)}</span></div>
            </div>
          </>
        )}

        <div className="grid grid-cols-4 gap-2">
          <Button variant="outline" size="sm" onClick={() => sendCommand(COMMAND.SKIP_PREVIOUS)} disabled={actionLoading} title="Previous"><SkipBack className="w-4 h-4" /></Button>
          <Button variant="outline" size="sm" onClick={() => sendCommand(COMMAND.PAUSE)} disabled={actionLoading} title="Pause"><Pause className="w-4 h-4" /></Button>
          <Button variant="outline" size="sm" onClick={() => sendCommand(COMMAND.RESUME)} disabled={actionLoading} title="Resume"><Play className="w-4 h-4" /></Button>
          <Button variant="outline" size="sm" onClick={() => sendCommand(COMMAND.SKIP_NEXT)} disabled={actionLoading} title="Next"><SkipForward className="w-4 h-4" /></Button>
        </div>

        <div className="grid grid-cols-3 gap-2">
          {[25, 65, 100].map(v => <Button key={v} variant="outline" size="sm" onClick={() => sendCommand(COMMAND.SET_VOLUME, { volume: v })} disabled={actionLoading}><Volume2 className="w-3.5 h-3.5 mr-1" />{v}%</Button>)}
        </div>

        {playlists.length > 0 && (
          <div className="flex items-center gap-2">
            <ListMusic className="w-4 h-4 text-muted-foreground flex-shrink-0" />
            <Select onValueChange={handlePlayPlaylist}>
              <SelectTrigger className="flex-1 h-8 text-xs bg-muted/30 border-border/50"><SelectValue placeholder="Playlist abspielen..." /></SelectTrigger>
              <SelectContent>{playlists.map(pl => <SelectItem key={pl.id} value={pl.id}>{pl.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
        )}

        <div className="flex gap-2">
          <Input value={testPlaylistUri} onChange={(e) => setTestPlaylistUri(e.target.value)} placeholder="spotify:playlist:..." className="h-9 text-xs" />
          <Button variant="outline" size="sm" onClick={handleTestPlaylist} disabled={actionLoading}>Test</Button>
        </div>

        <div className="rounded-lg border border-border/40 bg-background/50 p-3 text-xs space-y-1">
          <p className="flex items-center gap-1 text-muted-foreground"><Clock className="w-3 h-3" /> Letzter Command</p>
          <p className="font-semibold">{lastCommand?.type || lastCommand?.command || player.lastCommand || '—'}</p>
          <p className={lastCommand?.status === COMMAND_STATUS.SUCCESS ? 'text-green-400' : lastCommand?.status === COMMAND_STATUS.FAILED || lastCommand?.status === COMMAND_STATUS.TIMEOUT ? 'text-red-400' : 'text-yellow-300'}>
            {lastCommand?.status || player.lastCommandStatus || '—'}
          </p>
          {(lastCommand?.humanMessage || lastCommand?.errorCode || player.lastError) && <p className="text-muted-foreground break-words">{lastCommand?.errorCode ? `${lastCommand.errorCode}: ` : ''}{lastCommand?.humanMessage || player.lastError}</p>}
        </div>
      </div>
    </div>
  );
}

export default function NowPlaying() {
  const queryClient = useQueryClient();
  const { data: players = [] } = useQuery({ queryKey: ['players'], queryFn: () => base44.entities.Player.list('-lastSeen'), refetchInterval: 3000 });
  const { data: zones = [] } = useQuery({ queryKey: ['zones'], queryFn: () => base44.entities.Zone.list() });
  const { data: providers = [] } = useQuery({ queryKey: ['providers'], queryFn: () => base44.entities.Provider.list() });
  const { data: playlists = [] } = useQuery({ queryKey: ['playlists'], queryFn: () => base44.entities.Playlist.list() });
  const { data: commands = [] } = useQuery({ queryKey: ['playerCommands'], queryFn: () => listPlayerCommands(), refetchInterval: 3000 });

  useEffect(() => {
    players.forEach((player) => markStalePendingCommands(player.id));
    const t = setTimeout(() => queryClient.invalidateQueries({ queryKey: ['playerCommands'] }), 500);
    return () => clearTimeout(t);
  }, [players, queryClient]);

  const onlineCount = players.filter(isPlayerOnline).length;
  const pendingCount = commands.filter((cmd) => cmd.status === COMMAND_STATUS.PENDING || cmd.status === COMMAND_STATUS.PICKED_UP).length;
  const failedCount = commands.filter((cmd) => cmd.status === COMMAND_STATUS.FAILED || cmd.status === COMMAND_STATUS.TIMEOUT).length;

  return (
    <div className="p-4 lg:p-8 space-y-6 max-w-7xl mx-auto">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-2xl lg:text-3xl font-black flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center"><Radio className="w-5 h-5 text-rose-400" /></div>
              Now Playing
            </h1>
            <p className="text-sm text-muted-foreground mt-1 ml-14">Live Player Control mit bestätigten PlayerCommands.</p>
          </div>
        </div>
      </motion.div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bento-panel p-4"><p className="text-xs text-muted-foreground">Players</p><p className="text-2xl font-black">{players.length}</p></div>
        <div className="bento-panel p-4"><p className="text-xs text-muted-foreground">Online</p><p className="text-2xl font-black text-green-400">{onlineCount}</p></div>
        <div className="bento-panel p-4"><p className="text-xs text-muted-foreground">Pending</p><p className="text-2xl font-black text-yellow-300">{pendingCount}</p></div>
        <div className="bento-panel p-4"><p className="text-xs text-muted-foreground">Failed/Timeout</p><p className="text-2xl font-black text-red-400">{failedCount}</p></div>
      </div>

      {players.length === 0 ? (
        <div className="bento-panel border-dashed border-primary/20 p-16 text-center"><Radio className="w-16 h-16 text-muted-foreground/20 mx-auto mb-4" /><h3 className="text-xl font-bold mb-2">Keine Player vorhanden</h3><p className="text-muted-foreground text-sm">Erstelle zuerst Player.</p></div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-5">
          {players.map((player, i) => {
            const zone = zones.find(z => z.id === player.zoneId);
            const provider = providers.find(p => p.id === (player.providerId || player.apiCredentialSetId || player.spotifyAccountId || zone?.providerId));
            const providerId = provider?.id || player.providerId || player.apiCredentialSetId || player.spotifyAccountId || '';
            const playerPlaylists = playlists.filter(p => p.providerId === providerId || p.spotifyAccountId === providerId || p.playerId === player.id);
            return (
              <motion.div key={player.id} initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.07 }}>
                {provider ? <PlayerCard player={player} provider={provider} playlists={playerPlaylists} commands={commands} /> : <div className="bento-panel p-5 text-center"><AlertCircle className="w-8 h-8 text-yellow-400 mx-auto mb-2" /><p className="text-sm font-bold">{player.name}</p><p className="text-xs text-muted-foreground mt-1">Zone oder Provider nicht gefunden</p></div>}
              </motion.div>
            );
          })}
        </div>
      )}

      <div className="bento-panel p-5 space-y-3">
        <h2 className="text-lg font-black flex items-center gap-2"><CheckCircle2 className="w-5 h-5 text-primary" /> Command Log</h2>
        <div className="space-y-2 max-h-96 overflow-y-auto">
          {commands.slice(0, 30).map((cmd) => {
            const player = players.find(p => p.id === cmd.playerId);
            return <div key={cmd.id} className="grid grid-cols-2 md:grid-cols-7 gap-2 rounded-lg bg-background/50 border border-border/30 p-3 text-xs"><span className="font-semibold">{cmd.type || cmd.command}</span><span>{player?.name || cmd.playerId}</span><span>{cmd.status}</span><span>{cmd.createdAt || cmd.created_date}</span><span>{cmd.pickedUpAt || '—'}</span><span>{cmd.completedAt || '—'}</span><span className="text-muted-foreground break-words">{cmd.errorCode || cmd.humanMessage || '—'}</span></div>;
          })}
          {commands.length === 0 && <p className="text-sm text-muted-foreground">Noch keine Commands.</p>}
        </div>
      </div>
    </div>
  );
}
