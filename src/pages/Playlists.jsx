import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Plus, Music2, Download, Trash2, ExternalLink, List, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import PlaylistDetailModal from '@/components/playlists/PlaylistDetailModal';
import { toast } from 'sonner';
import { format } from 'date-fns';

const energyColors = {
  low: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  medium: 'bg-green-500/10 text-green-400 border-green-500/20',
  high: 'bg-orange-500/10 text-orange-400 border-orange-500/20',
  very_high: 'bg-red-500/10 text-red-400 border-red-500/20',
};
const energyLabels = { low: 'Niedrig', medium: 'Mittel', high: 'Hoch', very_high: 'Sehr hoch' };

export default function Playlists() {
  const [selectedPlaylist, setSelectedPlaylist] = useState(null);
  const queryClient = useQueryClient();

  const { data: playlists = [], isLoading } = useQuery({ queryKey: ['playlists'], queryFn: () => base44.entities.Playlist.list() });
  const { data: providers = [] }            = useQuery({ queryKey: ['providers'], queryFn: () => base44.entities.Provider.list() });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.Playlist.delete(id),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['playlists'] }); toast.success('Playlist gelöscht.'); },
  });

  return (
    <div className="p-4 lg:p-8 space-y-6 max-w-7xl mx-auto">
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl lg:text-3xl font-black text-foreground flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-green-500/10 border border-green-500/20 flex items-center justify-center">
              <Music2 className="w-5 h-5 text-green-400" />
            </div>
            Playlists
          </h1>
          <p className="text-sm text-muted-foreground mt-1 ml-14">Musik importieren und verwalten</p>
        </div>
        <Link to="/playlists/import">
          <Button className="bg-primary hover:bg-primary/90 h-11 px-6 gap-2 font-semibold">
            <Download className="w-4 h-4" /> Playlist importieren
          </Button>
        </Link>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
          {[1,2,3,4].map(i => <div key={i} className="rounded-xl h-64 skeleton" />)}
        </div>
      ) : playlists.length === 0 ? (
        <div className="bento-panel border-dashed border-primary/20 p-16 text-center">
          <div className="w-20 h-20 rounded-2xl bg-green-500/10 flex items-center justify-center mx-auto mb-5">
            <Music2 className="w-10 h-10 text-green-400/40" />
          </div>
          <h3 className="text-xl font-bold mb-2">Noch keine Playlists importiert</h3>
          <p className="text-muted-foreground text-sm mb-6">Importiere Playlists von deinem Musikprovider.</p>
          <Link to="/playlists/import">
            <Button className="bg-primary hover:bg-primary/90 h-11 px-6 gap-2">
              <Download className="w-4 h-4" /> Playlist importieren
            </Button>
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
          {playlists.map((playlist, idx) => {
            const provider = providers.find(p => p.id === playlist.providerId);
            return (
              <motion.div
                key={playlist.id}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: idx * 0.04 }}
                whileHover={{ y: -4, transition: { duration: 0.15 } }}
                className="group cursor-pointer"
                onClick={() => setSelectedPlaylist(playlist)}
              >
                <div className="bento-panel overflow-hidden h-full">
                  {/* Cover */}
                  <div className="relative aspect-square overflow-hidden rounded-t-xl">
                    {playlist.coverUrl ? (
                      <img
                        src={playlist.coverUrl}
                        alt={playlist.name}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                    ) : (
                      <div className="w-full h-full bg-gradient-to-br from-primary/20 via-violet-500/15 to-cyan-500/20 flex items-center justify-center">
                        <Music2 className="w-12 h-12 text-primary/40" />
                      </div>
                    )}
                    {/* Overlay on hover */}
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center">
                      <div className="opacity-0 group-hover:opacity-100 transition-opacity bg-white/10 backdrop-blur-sm rounded-full p-3">
                        <List className="w-5 h-5 text-white" />
                      </div>
                    </div>
                    {/* Menu */}
                    <div className="absolute top-2 right-2" onClick={e => e.stopPropagation()}>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="w-7 h-7 bg-black/50 hover:bg-black/70 text-white opacity-0 group-hover:opacity-100 transition-opacity rounded-lg">
                            <Plus className="w-3.5 h-3.5 rotate-45" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={e => { e.stopPropagation(); setSelectedPlaylist(playlist); }}>
                            <List className="w-4 h-4 mr-2" /> Songs anzeigen
                          </DropdownMenuItem>
                          {playlist.externalUrl && (
                            <DropdownMenuItem asChild>
                              <a href={playlist.externalUrl} target="_blank" rel="noopener noreferrer">
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

                  {/* Info */}
                  <div className="p-3 space-y-2">
                    <h3 className="font-bold text-sm text-foreground truncate leading-tight">{playlist.name}</h3>
                    <p className="text-xs text-muted-foreground">
                      {playlist.totalTracks} Songs · {provider?.name || 'Unbekannt'}
                    </p>
                    <div className="flex flex-wrap gap-1">
                      {playlist.energyLevel && (
                        <span className={`text-[10px] px-1.5 py-0.5 rounded-md border font-semibold ${energyColors[playlist.energyLevel]}`}>
                          {energyLabels[playlist.energyLevel]}
                        </span>
                      )}
                    </div>
                    {playlist.lastImportedAt && (
                      <p className="text-[10px] text-muted-foreground">
                        Sync: {format(new Date(playlist.lastImportedAt), 'dd.MM.yy')}
                      </p>
                    )}
                    <Button
                      size="sm"
                      className="w-full h-8 bg-primary/10 border border-primary/20 text-primary hover:bg-primary/20 text-xs gap-1.5 mt-1"
                      onClick={e => { e.stopPropagation(); setSelectedPlaylist(playlist); }}
                    >
                      <List className="w-3 h-3" /> Songs anzeigen
                    </Button>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      {selectedPlaylist && (
        <PlaylistDetailModal playlist={selectedPlaylist} onClose={() => setSelectedPlaylist(null)} />
      )}
    </div>
  );
}