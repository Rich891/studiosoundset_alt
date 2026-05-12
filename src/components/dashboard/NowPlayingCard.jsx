import { Volume2, Music2, Play, Pause, Loader2 } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';

export default function NowPlayingCard({ zone, device, providers = [] }) {
  const [loading, setLoading] = useState(false);
  const queryClient = useQueryClient();
  const hasTrack = device?.currentTrack;
  const coverUrl = device?.currentCoverUrl;
  const isPlaying = device?.status === 'online' && !!device?.currentTrack;

  const provider = providers.find(p => p.id === device?.providerId);

  const handlePlayPause = async () => {
    if (!device || !provider) {
      toast.error('Kein Provider für dieses Gerät konfiguriert.');
      return;
    }
    setLoading(true);
    try {
      if (device.providerDeviceId) {
        await base44.functions.invoke('spotifyControl', {
          providerId: provider.id,
          action: isPlaying ? 'pause' : 'play',
          deviceId: device.providerDeviceId,
        });
        toast.success(isPlaying ? 'Pause' : 'Wiedergabe gestartet');
        queryClient.invalidateQueries({ queryKey: ['devices'] });
      } else {
        toast.error('Kein Spotify-Gerät verknüpft. Weise der Zone ein Gerät über die Geräteseite zu.');
      }
    } catch (e) {
      toast.error('Fehler: ' + e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="glass-card overflow-hidden relative">
      {/* Background gradient based on zone color */}
      <div 
        className="absolute inset-0 opacity-10"
        style={{ background: `radial-gradient(circle at top right, ${zone.color || '#6366f1'}, transparent 70%)` }}
      />
      <CardContent className="p-4 relative">
        <div className="flex gap-3">
          {/* Cover */}
          <div className="w-16 h-16 rounded-xl flex-shrink-0 overflow-hidden bg-muted">
            {coverUrl ? (
              <img src={coverUrl} alt="Cover" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center"
                style={{ background: `linear-gradient(135deg, ${zone.color || '#6366f1'}40, ${zone.color || '#6366f1'}20)` }}>
                <Music2 className="w-7 h-7 text-muted-foreground" />
              </div>
            )}
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-1">
              <div className="min-w-0">
                <p className="text-sm font-semibold truncate text-foreground">
                  {device?.currentTrack || 'Kein Titel'}
                </p>
                <p className="text-xs text-muted-foreground truncate">
                  {device?.currentArtist || 'Unbekannter Künstler'}
                </p>
              </div>
              <div className="flex items-center gap-1 flex-shrink-0">
                <Volume2 className="w-3 h-3 text-primary" />
                <span className="text-sm font-bold text-primary">{device?.currentVolume ?? '—'}%</span>
              </div>
            </div>
            
            <div className="mt-2 flex items-center gap-2 flex-wrap">
              <span 
                className="text-xs px-2 py-0.5 rounded-full font-medium"
                style={{ background: `${zone.color || '#6366f1'}20`, color: zone.color || '#6366f1' }}
              >
                {zone.name}
              </span>
              <span className={`text-xs px-1.5 py-0.5 rounded-full ${
                device?.status === 'online' ? 'bg-status-green status-green' : 'bg-status-gray status-gray'
              }`}>
                {device ? (device.status === 'online' ? '● Live' : '● Offline') : '● Kein Gerät'}
              </span>
            </div>

            {device?.currentPlaylist && (
              <p className="text-xs text-muted-foreground mt-1 truncate">
                ♪ {device.currentPlaylist}
              </p>
            )}

            {/* Play/Pause Button */}
            {device && provider && (
              <Button
                size="sm"
                className={`mt-3 w-full h-9 gap-2 font-semibold text-xs ${
                  isPlaying
                    ? 'bg-muted/40 border border-border hover:bg-muted/60 text-foreground'
                    : 'bg-primary/15 border border-primary/30 text-primary hover:bg-primary/25'
                }`}
                onClick={handlePlayPause}
                disabled={loading}
              >
                {loading
                  ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  : isPlaying
                    ? <Pause className="w-3.5 h-3.5" />
                    : <Play className="w-3.5 h-3.5" />
                }
                {loading ? 'Wird ausgeführt...' : isPlaying ? 'Pause' : 'Abspielen'}
              </Button>
            )}
            {device && !provider && (
              <p className="text-xs text-muted-foreground mt-2 italic">Kein Provider verknüpft</p>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}