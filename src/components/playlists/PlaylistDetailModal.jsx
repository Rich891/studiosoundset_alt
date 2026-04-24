import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Music2, ExternalLink, Clock, AlertCircle } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';

function formatDuration(ms) {
  if (!ms) return '—';
  const m = Math.floor(ms / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  return `${m}:${String(s).padStart(2, '0')}`;
}

export default function PlaylistDetailModal({ playlist, onClose }) {
  const { data: tracks = [], isLoading } = useQuery({
    queryKey: ['playlist-tracks', playlist?.id],
    queryFn: () => base44.entities.PlaylistTrack.filter({ playlistId: playlist.id }, 'sortOrder', 200),
    enabled: !!playlist?.id,
  });

  if (!playlist) return null;

  return (
    <Dialog open={!!playlist} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col bg-card border-border">
        <DialogHeader>
          <div className="flex items-start gap-4">
            <div className="w-20 h-20 rounded-xl overflow-hidden flex-shrink-0 bg-muted">
              {playlist.coverUrl ? (
                <img src={playlist.coverUrl} alt={playlist.name} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full bg-gradient-to-br from-primary/30 to-purple-500/20 flex items-center justify-center">
                  <Music2 className="w-8 h-8 text-primary/60" />
                </div>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <DialogTitle className="text-xl">{playlist.name}</DialogTitle>
              {playlist.description && <p className="text-sm text-muted-foreground mt-1">{playlist.description}</p>}
              <div className="flex flex-wrap gap-2 mt-2 text-xs text-muted-foreground">
                <span>{playlist.totalTracks} Songs</span>
                {playlist.ownerName && <span>von {playlist.ownerName}</span>}
              </div>
              {playlist.externalUrl && (
                <a href={playlist.externalUrl} target="_blank" rel="noopener noreferrer"
                  className="text-xs text-primary hover:underline mt-1 inline-flex items-center gap-1">
                  <ExternalLink className="w-3 h-3" /> Extern öffnen
                </a>
              )}
            </div>
          </div>
        </DialogHeader>

        <div className="flex-1 min-h-0">
          <h3 className="text-sm font-semibold mb-3 text-muted-foreground uppercase tracking-wide">
            Songs ({tracks.length})
          </h3>
          {isLoading ? (
            <div className="space-y-2">
              {[1,2,3,4,5].map(i => <div key={i} className="h-12 bg-muted/50 rounded-lg animate-pulse" />)}
            </div>
          ) : tracks.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <AlertCircle className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">Keine Songs importiert.</p>
            </div>
          ) : (
            <ScrollArea className="h-80">
              <div className="space-y-1 pr-4">
                {tracks.map((track, idx) => (
                  <div key={track.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/40 transition-colors">
                    <span className="text-xs text-muted-foreground w-6 text-right flex-shrink-0">{track.sortOrder || idx + 1}</span>
                    {track.albumCoverUrl ? (
                      <img src={track.albumCoverUrl} alt="" className="w-8 h-8 rounded flex-shrink-0 object-cover" />
                    ) : (
                      <div className="w-8 h-8 rounded bg-muted flex-shrink-0 flex items-center justify-center">
                        <Music2 className="w-3.5 h-3.5 text-muted-foreground" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1">
                        <p className="text-sm font-medium truncate">{track.name}</p>
                        {track.explicit && <span className="text-xs bg-muted text-muted-foreground px-1 rounded flex-shrink-0">E</span>}
                      </div>
                      <p className="text-xs text-muted-foreground truncate">{track.artistName} · {track.albumName}</p>
                    </div>
                    <span className="text-xs text-muted-foreground flex-shrink-0 flex items-center gap-1">
                      <Clock className="w-3 h-3" />{formatDuration(track.durationMs)}
                    </span>
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}
        </div>

        <div className="pt-4 border-t border-border flex justify-end">
          <Button variant="outline" onClick={onClose}>Schließen</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}