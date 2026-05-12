import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { RefreshCw, AlertCircle } from 'lucide-react';

function formatMs(ms) {
  if (!ms) return '—';
  const s = Math.floor(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

export default function PlaylistTrackList({ playlistId }) {
  const { data: tracks = [], isLoading } = useQuery({
    queryKey: ['tracks', playlistId],
    queryFn: () => base44.entities.PlaylistTrack.filter({ playlistId }, 'sortOrder', 200),
    enabled: !!playlistId,
  });

  if (isLoading) return (
    <div className="flex items-center justify-center gap-2 py-10">
      <RefreshCw className="w-5 h-5 animate-spin text-primary" />
      <span className="text-muted-foreground">Lade Songs...</span>
    </div>
  );

  if (tracks.length === 0) return (
    <div className="flex items-center gap-3 p-4 bg-yellow-500/10 border border-yellow-500/20 rounded-xl">
      <AlertCircle className="w-5 h-5 text-yellow-400 flex-shrink-0" />
      <div>
        <p className="text-sm font-semibold text-yellow-300">Keine Songs importiert</p>
        <p className="text-xs text-muted-foreground mt-0.5">Klicke auf "Sync" um die Tracks erneut zu importieren.</p>
      </div>
    </div>
  );

  return (
    <div className="space-y-1">
      <p className="text-xs text-muted-foreground font-semibold mb-3">{tracks.length} Songs</p>
      {tracks.map((track, i) => (
        <div key={track.id} className="flex items-center gap-3 py-2 px-2 rounded-lg hover:bg-muted/20 transition-all group">
          <span className="text-xs text-muted-foreground w-6 text-right flex-shrink-0">{i + 1}</span>
          {track.coverUrl ? (
            <img src={track.coverUrl} alt="" className="w-9 h-9 rounded flex-shrink-0" />
          ) : (
            <div className="w-9 h-9 bg-muted/30 rounded flex-shrink-0" />
          )}
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold truncate flex items-center gap-1.5">
              {track.name}
              {track.explicit && <span className="text-[10px] bg-muted/40 text-muted-foreground px-1 py-0.5 rounded font-bold">E</span>}
            </p>
            <p className="text-xs text-muted-foreground truncate">{track.artist} · {track.album}</p>
          </div>
          <span className="text-xs text-muted-foreground flex-shrink-0">{formatMs(track.durationMs)}</span>
        </div>
      ))}
    </div>
  );
}