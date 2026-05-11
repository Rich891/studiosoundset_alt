import { useState, useEffect, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import { Play, Pause, SkipForward, SkipBack, Volume2, Monitor, RefreshCw, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

export default function SpotifyPlayer({ provider }) {
  const [playback, setPlayback] = useState(null);
  const [devices, setDevices] = useState([]);
  const [volume, setVolume] = useState(50);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState(null);

  const invoke = useCallback(async (action, extra = {}) => {
    return base44.functions.invoke('spotifyControl', { providerId: provider.id, action, ...extra });
  }, [provider.id]);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [pbRes, devRes] = await Promise.all([
        invoke('getCurrentPlayback'),
        invoke('getDevices'),
      ]);
      setPlayback(pbRes.data?.playback || null);
      setDevices(devRes.data?.devices || []);
      if (pbRes.data?.playback?.device?.volume_percent !== undefined) {
        setVolume(pbRes.data.playback.device.volume_percent);
      }
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [invoke]);

  useEffect(() => {
    refresh();
    const interval = setInterval(refresh, 30000);
    return () => clearInterval(interval);
  }, [refresh]);

  const handleAction = async (action, extra = {}) => {
    setActionLoading(true);
    try {
      await invoke(action, extra);
      setTimeout(refresh, 800);
    } catch (e) {
      toast.error('Fehler: ' + e.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleVolumeChange = async (val) => {
    setVolume(val);
    try {
      await invoke('setVolume', { volume: val });
    } catch (e) {
      toast.error('Lautstärke konnte nicht gesetzt werden');
    }
  };

  const handleTransfer = async (deviceId) => {
    setActionLoading(true);
    try {
      await invoke('transferPlayback', { deviceId });
      toast.success('Wiedergabe übertragen!');
      setTimeout(refresh, 1000);
    } catch (e) {
      toast.error('Fehler: ' + e.message);
    } finally {
      setActionLoading(false);
    }
  };

  const track = playback?.item;
  const isPlaying = playback?.is_playing;
  const progressMs = playback?.progress_ms || 0;
  const durationMs = track?.duration_ms || 1;
  const progressPct = Math.round((progressMs / durationMs) * 100);

  if (loading) {
    return (
      <div className="glass-card rounded-2xl p-6 flex items-center justify-center gap-3 h-48">
        <RefreshCw className="w-5 h-5 text-primary animate-spin" />
        <span className="text-muted-foreground text-sm">Lade Wiedergabe...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="glass-card rounded-2xl p-6 flex items-center gap-3">
        <AlertCircle className="w-5 h-5 text-destructive" />
        <div>
          <p className="text-sm font-medium text-destructive">Verbindungsfehler</p>
          <p className="text-xs text-muted-foreground">{error}</p>
        </div>
        <Button variant="outline" size="sm" className="ml-auto" onClick={refresh}>Retry</Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Now Playing Card */}
      <div className="glass-card rounded-2xl p-6 space-y-5">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
            🎵 {provider.name}
          </h3>
          <button onClick={refresh} className="text-muted-foreground hover:text-foreground transition-colors">
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>

        {!track ? (
          <div className="text-center py-6">
            <p className="text-muted-foreground text-sm">Keine aktive Wiedergabe.</p>
            <p className="text-xs text-muted-foreground mt-1">Starte Spotify auf einem Gerät und wähle dann ein Gerät unten.</p>
          </div>
        ) : (
          <>
            {/* Track Info */}
            <div className="flex items-center gap-4">
              {track.album?.images?.[0]?.url && (
                <img
                  src={track.album.images[0].url}
                  alt={track.album.name}
                  className="w-16 h-16 rounded-xl shadow-lg"
                />
              )}
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-foreground truncate">{track.name}</p>
                <p className="text-sm text-muted-foreground truncate">
                  {track.artists?.map(a => a.name).join(', ')}
                </p>
                <p className="text-xs text-muted-foreground truncate">{track.album?.name}</p>
              </div>
              <div className={cn(
                'w-2 h-2 rounded-full',
                isPlaying ? 'bg-green-400 animate-pulse' : 'bg-muted-foreground'
              )} />
            </div>

            {/* Progress Bar */}
            <div className="space-y-1">
              <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary rounded-full transition-all"
                  style={{ width: `${progressPct}%` }}
                />
              </div>
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>{formatMs(progressMs)}</span>
                <span>{formatMs(durationMs)}</span>
              </div>
            </div>

            {/* Controls */}
            <div className="flex items-center justify-center gap-4">
              <Button
                variant="ghost" size="icon"
                onClick={() => handleAction('previous')}
                disabled={actionLoading}
              >
                <SkipBack className="w-5 h-5" />
              </Button>
              <Button
                size="icon"
                className={cn('w-12 h-12 rounded-full', isPlaying ? 'bg-muted hover:bg-muted/80' : 'bg-primary hover:bg-primary/90')}
                onClick={() => handleAction(isPlaying ? 'pause' : 'play')}
                disabled={actionLoading}
              >
                {isPlaying
                  ? <Pause className="w-5 h-5" />
                  : <Play className="w-5 h-5 ml-0.5" />
                }
              </Button>
              <Button
                variant="ghost" size="icon"
                onClick={() => handleAction('next')}
                disabled={actionLoading}
              >
                <SkipForward className="w-5 h-5" />
              </Button>
            </div>

            {/* Volume */}
            <div className="flex items-center gap-3">
              <Volume2 className="w-4 h-4 text-muted-foreground flex-shrink-0" />
              <Slider
                value={[volume]}
                onValueChange={([v]) => handleVolumeChange(v)}
                min={0} max={100}
                className="flex-1"
              />
              <span className="text-xs text-muted-foreground w-8 text-right">{volume}%</span>
            </div>
          </>
        )}
      </div>

      {/* Devices */}
      {devices.length > 0 && (
        <div className="glass-card rounded-2xl p-4 space-y-3">
          <div className="flex items-center gap-2">
            <Monitor className="w-4 h-4 text-muted-foreground" />
            <h4 className="text-sm font-medium">Verfügbare Geräte</h4>
          </div>
          <div className="space-y-2">
            {devices.map(device => (
              <button
                key={device.id}
                onClick={() => handleTransfer(device.id)}
                disabled={device.is_active || actionLoading}
                className={cn(
                  'w-full flex items-center gap-3 p-3 rounded-xl border text-left transition-all text-sm',
                  device.is_active
                    ? 'border-green-500/40 bg-green-500/5 cursor-default'
                    : 'border-border hover:border-primary/40 hover:bg-primary/5 cursor-pointer'
                )}
              >
                <div className={cn('w-2 h-2 rounded-full flex-shrink-0', device.is_active ? 'bg-green-400' : 'bg-muted-foreground')} />
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{device.name}</p>
                  <p className="text-xs text-muted-foreground">{device.type} · {device.volume_percent}%</p>
                </div>
                {device.is_active && <span className="text-xs text-green-400 flex-shrink-0">Aktiv</span>}
                {!device.is_active && <span className="text-xs text-muted-foreground flex-shrink-0">Aktivieren →</span>}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function formatMs(ms) {
  const totalSec = Math.floor(ms / 1000);
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  return `${min}:${sec.toString().padStart(2, '0')}`;
}