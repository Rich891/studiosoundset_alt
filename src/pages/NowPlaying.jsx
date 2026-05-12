import { useState, useEffect, useRef, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { motion } from 'framer-motion';
import {
  Radio, RefreshCw, AlertCircle, Play, Pause, SkipForward, SkipBack,
  Volume2, CheckCircle2, XCircle, Monitor, Smartphone, Tablet
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

const invoke = (fn, payload) => base44.functions.invoke(fn, payload);

function formatMs(ms) {
  const s = Math.floor(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

function ZonePlayer({ zone, account }) {
  const [playback, setPlayback] = useState(null);
  const [devices, setDevices] = useState([]);
  const [volume, setVolume] = useState(zone.defaultVolume || 50);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState(null);
  const [statusDetail, setStatusDetail] = useState('');
  const [localProgress, setLocalProgress] = useState(0);
  const tickerRef = useRef(null);
  const pbRef = useRef(null);
  const volDebounce = useRef(null);

  const startTicker = useCallback((startMs) => {
    if (tickerRef.current) clearInterval(tickerRef.current);
    let ms = startMs;
    tickerRef.current = setInterval(() => {
      ms += 1000;
      const dur = pbRef.current?.item?.duration_ms || 1;
      setLocalProgress(Math.min(ms, dur));
    }, 1000);
  }, []);
  const stopTicker = useCallback(() => { if (tickerRef.current) { clearInterval(tickerRef.current); tickerRef.current = null; } }, []);

  const refresh = useCallback(async (initial = false) => {
    if (!account || account.authStatus !== 'connected') {
      setError(account ? 'Account nicht verbunden.' : 'Kein Spotify Account zugewiesen.');
      setStatusDetail(account ? 'Gehe zu Spotify Accounts und verbinde diesen Account.' : 'Weise dieser Zone einen Spotify Account zu.');
      if (initial) setLoading(false);
      return;
    }

    if (initial) setLoading(true);
    setError(null);
    try {
      const [pbRes, devRes] = await Promise.all([
        invoke('spotifyAccountControl', { action: 'getPlaybackState', accountId: account.id }),
        invoke('spotifyAccountControl', { action: 'getDevices', accountId: account.id }),
      ]);

      const pb = pbRes.data?.playback;
      const devList = devRes.data?.devices || [];
      setPlayback(pb || null);
      pbRef.current = pb || null;
      setDevices(devList);

      if (pb?.device?.volume_percent !== undefined) setVolume(pb.device.volume_percent);
      const prog = pb?.progress_ms || 0;
      setLocalProgress(prog);
      if (pb?.is_playing) startTicker(prog);
      else stopTicker();

      if (!pb) setStatusDetail('Keine aktive Wiedergabe. Öffne Spotify auf dem Gerät.');
    } catch (e) {
      setError(e.message);
      stopTicker();
    } finally {
      if (initial) setLoading(false);
    }
  }, [account, startTicker, stopTicker]);

  useEffect(() => {
    refresh(true);
    const interval = setInterval(() => refresh(false), 30000);
    return () => { clearInterval(interval); stopTicker(); };
  }, [refresh, stopTicker]);

  const handleAction = async (action, extra = {}) => {
    setActionLoading(true);
    try {
      const activeDeviceId = playback?.device?.id;
      const res = await invoke('spotifyAccountControl', { action, accountId: account.id, deviceId: activeDeviceId, ...extra });
      if (res.data?.error) toast.error(res.data.error);
      else setTimeout(() => refresh(false), 800);
    } catch (e) {
      toast.error(e?.response?.data?.error || e.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleVolume = (val) => {
    const num = Number(val);
    setVolume(num);
    if (volDebounce.current) clearTimeout(volDebounce.current);
    volDebounce.current = setTimeout(async () => {
      try {
        const res = await invoke('spotifyAccountControl', { action: 'setVolume', accountId: account.id, volume: num, deviceId: playback?.device?.id });
        if (res.data?.error) toast.error(res.data.error);
      } catch (e) { toast.error(e.message); }
    }, 400);
  };

  const track = playback?.item;
  const isPlaying = playback?.is_playing;
  const dur = track?.duration_ms || 1;
  const pct = Math.min(100, Math.round((localProgress / dur) * 100));

  const activeDevice = devices.find(d => d.is_active);
  const deviceName = playback?.device?.name || activeDevice?.name;

  return (
    <div className="bento-panel overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-border/30 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: zone.color || '#6366f1' }} />
          <div>
            <p className="font-bold text-sm">{zone.name}</p>
            {account && <p className="text-xs text-muted-foreground">{account.displayName} {account.authStatus !== 'connected' && '⚠ nicht verbunden'}</p>}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {deviceName && <span className="text-xs text-muted-foreground px-2 py-1 bg-muted/30 rounded-full">{deviceName}</span>}
          <button onClick={() => refresh(false)} className="text-muted-foreground hover:text-foreground transition-colors">
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="p-5 space-y-4">
        {/* Error state */}
        {error && (
          <div className="flex items-start gap-3 p-3 bg-red-500/10 border border-red-500/20 rounded-xl">
            <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm text-red-400 font-semibold">{error}</p>
              {statusDetail && <p className="text-xs text-muted-foreground mt-0.5">{statusDetail}</p>}
            </div>
          </div>
        )}

        {/* Loading */}
        {loading && !error && (
          <div className="flex items-center justify-center gap-2 h-24">
            <RefreshCw className="w-5 h-5 text-primary animate-spin" />
            <span className="text-sm text-muted-foreground">Lade Wiedergabe...</span>
          </div>
        )}

        {/* No playback */}
        {!loading && !error && !track && (
          <div className="text-center py-6">
            <p className="text-muted-foreground text-sm">Keine aktive Wiedergabe.</p>
            {statusDetail && <p className="text-xs text-muted-foreground mt-1">{statusDetail}</p>}
            {devices.length > 0 && (
              <p className="text-xs text-muted-foreground mt-2">{devices.length} Gerät(e) für diesen Account gefunden.</p>
            )}
          </div>
        )}

        {/* Now playing */}
        {!loading && !error && track && (
          <>
            <div className="flex items-center gap-4">
              {track.album?.images?.[0]?.url && (
                <img src={track.album.images[0].url} alt="cover" className="w-16 h-16 rounded-xl shadow-lg flex-shrink-0" />
              )}
              <div className="flex-1 min-w-0">
                <p className="font-bold truncate">{track.name}</p>
                <p className="text-sm text-muted-foreground truncate">{track.artists?.map(a => a.name).join(', ')}</p>
                <p className="text-xs text-muted-foreground truncate">{track.album?.name}</p>
              </div>
              <div className={`w-2 h-2 rounded-full flex-shrink-0 ${isPlaying ? 'bg-green-400 animate-pulse' : 'bg-muted-foreground'}`} />
            </div>

            {/* Progress */}
            <div className="space-y-1">
              <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${pct}%` }} />
              </div>
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>{formatMs(localProgress)}</span><span>{formatMs(dur)}</span>
              </div>
            </div>

            {/* Controls */}
            <div className="flex items-center justify-center gap-3">
              <Button variant="ghost" size="icon" onClick={() => handleAction('previous')} disabled={actionLoading}><SkipBack className="w-5 h-5" /></Button>
              <Button size="icon" className={`w-11 h-11 rounded-full ${isPlaying ? 'bg-muted hover:bg-muted/80' : 'bg-primary hover:bg-primary/90'}`}
                onClick={() => handleAction(isPlaying ? 'pause' : 'resume')} disabled={actionLoading}>
                {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5 ml-0.5" />}
              </Button>
              <Button variant="ghost" size="icon" onClick={() => handleAction('next')} disabled={actionLoading}><SkipForward className="w-5 h-5" /></Button>
            </div>

            {/* Volume */}
            <div className="flex items-center gap-3">
              <Volume2 className="w-4 h-4 text-muted-foreground flex-shrink-0" />
              <input type="range" min={0} max={100} value={volume} onChange={e => handleVolume(e.target.value)}
                className="flex-1 h-2 rounded-full appearance-none cursor-pointer"
                style={{ background: `linear-gradient(to right, hsl(var(--primary)) ${volume}%, hsl(var(--border)) ${volume}%)`, WebkitAppearance: 'none' }} />
              <span className="text-xs text-muted-foreground w-8 text-right">{volume}%</span>
            </div>
          </>
        )}
      </div>

      {/* Device list */}
      {devices.length > 0 && (
        <div className="px-5 pb-4 border-t border-border/20 pt-3 space-y-1.5">
          <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">Geräte</p>
          {devices.map(d => (
            <div key={d.id} className={`flex items-center gap-2 text-xs py-1.5 px-2 rounded-lg ${d.is_active ? 'bg-green-500/10 text-green-300' : 'text-muted-foreground'}`}>
              <div className={`w-1.5 h-1.5 rounded-full ${d.is_active ? 'bg-green-400' : 'bg-muted-foreground'}`} />
              <span className="flex-1 truncate">{d.name}</span>
              <span className="text-muted-foreground">{d.type}</span>
              {d.volume_percent !== undefined && <span>{d.volume_percent}%</span>}
              {!d.is_active && (
                <button className="text-primary hover:text-primary/80 font-semibold" onClick={() => handleAction('transferPlayback', { deviceId: d.id })}>
                  Aktivieren
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function NowPlaying() {
  const { data: zones = [] } = useQuery({ queryKey: ['zones'], queryFn: () => base44.entities.Zone.filter({ isActive: true }) });
  const { data: accounts = [] } = useQuery({ queryKey: ['spotifyAccounts'], queryFn: () => base44.entities.SpotifyAccount.list() });

  return (
    <div className="p-4 lg:p-8 space-y-6 max-w-7xl mx-auto">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-2xl lg:text-3xl font-black flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center">
            <Radio className="w-5 h-5 text-rose-400" />
          </div>
          Now Playing
        </h1>
        <p className="text-sm text-muted-foreground mt-1 ml-14">Echtzeit-Steuerung pro Zone — jede Zone hat ihren eigenen Spotify Account.</p>
      </motion.div>

      {zones.length === 0 ? (
        <div className="bento-panel border-dashed border-primary/20 p-16 text-center">
          <Radio className="w-16 h-16 text-muted-foreground/20 mx-auto mb-4" />
          <h3 className="text-xl font-bold mb-2">Keine Zonen angelegt</h3>
          <p className="text-muted-foreground text-sm">Erstelle zuerst Zonen und verbinde Spotify Accounts.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-5">
          {zones.map((zone, i) => {
            const account = accounts.find(a => a.id === zone.spotifyAccountId);
            return (
              <motion.div key={zone.id} initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.07 }}>
                <ZonePlayer zone={zone} account={account} />
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}