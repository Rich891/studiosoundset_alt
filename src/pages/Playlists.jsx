import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Link } from 'react-router-dom';
import { Plus, Music2, RefreshCw, MoreVertical, Trash2, ExternalLink, List, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';
import StatusBadge from '@/components/ui/StatusBadge';
import PageHeader from '@/components/ui/PageHeader';
import PlaylistDetailModal from '@/components/playlists/PlaylistDetailModal';
import { toast } from 'sonner';
import { format } from 'date-fns';

const energyColors = {
  low: 'bg-blue-500/10 text-blue-400',
  medium: 'bg-green-500/10 text-green-400',
  high: 'bg-orange-500/10 text-orange-400',
  very_high: 'bg-red-500/10 text-red-400',
};

const energyLabels = {
  low: 'Niedrig',
  medium: 'Mittel',
  high: 'Hoch',
  very_high: 'Sehr hoch',
};

export default function Playlists() {
  const [selectedPlaylist, setSelectedPlaylist] = useState(null);
  const queryClient = useQueryClient();

  const { data: playlists = [], isLoading } = useQuery({
    queryKey: ['playlists'],
    queryFn: () => base44.entities.Playlist.list(),
  });

  const { data: providers = [] } = useQuery({
    queryKey: ['providers'],
    queryFn: () => base44.entities.Provider.list(),
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.Playlist.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['playlists'] });
      toast.success('Playlist gelöscht.');
    },
  });

  const getProvider = (id) => providers.find(p => p.id === id);

  return (
    <div className="p-6 space-y-6">
      <PageHeader
        title="Playlists"
        subtitle="Playlists importieren, verwalten und in Zonen einsetzen"
        actions={
          <Link to="/playlists/import">
            <Button className="bg-primary hover:bg-primary/90">
              <Download className="w-4 h-4 mr-2" /> Playlist importieren
            </Button>
          </Link>
        }
      />

      {isLoading ? (
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
          {[1,2,3,4].map(i => <div key={i} className="glass-card rounded-xl h-64 animate-pulse" />)}
        </div>
      ) : playlists.length === 0 ? (
        <Card className="glass-card border-dashed border-primary/30">
          <CardContent className="p-12 text-center">
            <Music2 className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">Noch keine Playlists importiert</h3>
            <p className="text-muted-foreground text-sm mb-6">
              Importiere Playlists von deinem Musikprovider, um sie in Kalenderblöcken zu verwenden.
            </p>
            <Link to="/playlists/import">
              <Button className="bg-primary hover:bg-primary/90">
                <Download className="w-4 h-4 mr-2" /> Playlist importieren
              </Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
          {playlists.map(playlist => {
            const provider = getProvider(playlist.providerId);
            return (
              <Card 
                key={playlist.id} 
                className="glass-card hover:border-primary/30 transition-all cursor-pointer group overflow-hidden"
                onClick={() => setSelectedPlaylist(playlist)}
              >
                {/* Cover */}
                <div className="relative aspect-square overflow-hidden">
                  {playlist.coverUrl ? (
                    <img src={playlist.coverUrl} alt={playlist.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                  ) : (
                    <div className="w-full h-full bg-gradient-to-br from-primary/30 to-purple-500/20 flex items-center justify-center">
                      <Music2 className="w-10 h-10 text-primary/60" />
                    </div>
                  )}
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors" />
                  <div className="absolute top-2 right-2">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild onClick={e => e.stopPropagation()}>
                        <Button variant="ghost" size="icon" className="w-7 h-7 bg-black/40 hover:bg-black/60 text-white">
                          <MoreVertical className="w-3.5 h-3.5" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={e => { e.stopPropagation(); setSelectedPlaylist(playlist); }}>
                          <List className="w-4 h-4 mr-2" /> Songs anzeigen
                        </DropdownMenuItem>
                        {playlist.externalUrl && (
                          <DropdownMenuItem asChild>
                            <a href={playlist.externalUrl} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()}>
                              <ExternalLink className="w-4 h-4 mr-2" /> Extern öffnen
                            </a>
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuItem className="text-destructive" onClick={e => { e.stopPropagation(); deleteMutation.mutate(playlist.id); }}>
                          <Trash2 className="w-4 h-4 mr-2" /> Löschen
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>

                <CardContent className="p-3 space-y-2">
                  <div>
                    <h3 className="font-semibold text-sm text-foreground truncate">{playlist.name}</h3>
                    <p className="text-xs text-muted-foreground">{playlist.totalTracks} Songs · {provider?.name || 'Unbekannt'}</p>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {playlist.energyLevel && (
                      <span className={`text-xs px-1.5 py-0.5 rounded-full ${energyColors[playlist.energyLevel]}`}>
                        {energyLabels[playlist.energyLevel]}
                      </span>
                    )}
                    {playlist.licenseStatus && (
                      <StatusBadge status={playlist.licenseStatus} className="text-xs" />
                    )}
                  </div>
                  {playlist.lastImportedAt && (
                    <p className="text-xs text-muted-foreground">
                      Sync: {format(new Date(playlist.lastImportedAt), 'dd.MM.yy')}
                    </p>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {selectedPlaylist && (
        <PlaylistDetailModal 
          playlist={selectedPlaylist}
          onClose={() => setSelectedPlaylist(null)}
        />
      )}
    </div>
  );
}