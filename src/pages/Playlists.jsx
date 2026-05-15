import { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { motion, AnimatePresence } from 'framer-motion';
import { Music2, RefreshCw, Download, Eye, AlertCircle, Play, X, Search, Link2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from 'sonner';
import PlaylistTrackList from '@/components/playlists/PlaylistTrackList';
import { COMMAND, createPlayerCommand } from '@/lib/studioSoundSetRuntime';
import { normalizeImportedPlaylist, parseSpotifyPlaylistInput, toSpotifyPlaylistUri } from '@/lib/spotifyPlaylist';

const invoke = (fn, payload) => base44.functions.invoke(fn, payload);

const SYNC_CFG = {
  success: { color: 'text-green-400', label: 'Synchronisiert' },
  synced: { color: 'text-green-400', label: 'Synchronisiert' },
  partial: { color: 'text-yellow-400', label: 'Unvollstandig' },
  loading: { color: 'text-blue-400', label: 'Ladt' },
  pending: { color: 'text-blue-400', label: 'Ausstehend' },
  failed: { color: 'text-red-400', label: 'Fehler' },
  error: { color: 'text-red-400', label: 'Fehler' },
  idle: { color: 'text-muted-foreground', label: 'Idle' },
  not_imported: { color: 'text-muted-foreground', label: 'Nicht importiert' },
};

function getProviderIdFromPlayer(player) {
  return player?.providerId || player?.apiCredentialSetId || player?.spotifyAccountId || '';
}

function getProviderStatus(provider) {
  return provider?.status || provider?.authStatus || 'disconnected';
}

function getProviderLabel(provider) {
  return provider?.name || provider?.displayName || provider?.spotifyUserEmail || 'Spotify Provider';
}

function getPlayerLabel(player) {
  return player?.name || player?.displayName || 'Unbekannter Player';
}

function findProviderForPlayer(providers, player) {
  const providerId = getProviderIdFromPlayer(player);
  return providers.find((provider) => provider.id === providerId) || null;
}

function findProviderForPlaylist(providers, playlist) {
  const providerId = playlist.providerId || playlist.spotifyAccountId || playlist.apiCredentialSetId || '';
  return providers.find((provider) => provider.id === providerId) || null;
}

function functionErrorMessage(error, responseData) {
  const code = responseData?.errorCode || error?.response?.data?.errorCode || error?.code || '';
  const detail = responseData?.detail || error?.response?.data?.detail;
  const raw = responseData?.error || error?.response?.data?.error || error?.message || 'Unbekannter Fehler';
  if (code === 'ADMIN_REQUIRED') return 'ADMIN_REQUIRED: Bitte als Admin neu einloggen und den Playlist-Sync erneut starten.';
  if (code === 'SPOTIFY_FORBIDDEN') return `SPOTIFY_FORBIDDEN: Spotify verweigert Zugriff. Provider neu verbinden und Scopes prufen. Details: ${detail?.error?.message || raw}`;
  if (code === 'TOKEN_EXPIRED' || code === 'TOKEN_REFRESH_FAILED') return `${code}: Provider neu mit Spotify verbinden.`;
  return code ? `${code}: ${raw}` : raw;
}

async function upsertPlaylistMetadata({ provider, player, spotifyPlaylist }) {
  const data = normalizeImportedPlaylist(spotifyPlaylist, provider, player);
  const playerProviderId = getProviderIdFromPlayer(player);
  const payload = {
    ...data,
    playerId: player?.id || data.playerId || '',
    providerId: provider?.id || playerProviderId || data.providerId || '',
    spotifyAccountId: provider?.id || playerProviderId || data.spotifyAccountId || '',
  };
  const existing = await base44.entities.Playlist.filter({ providerPlaylistId: payload.providerPlaylistId, providerId: payload.providerId });
  if (existing.length) {
    await base44.entities.Playlist.update(existing[0].id, payload);
    return { ...existing[0], ...payload };
  }
  return base44.entities.Playlist.create(payload);
}

async function importTracks({ provider, playlist, spotifyPlaylistId }) {
  let res;
  try {
    res = await invoke('spotifyAccountControl', {
      action: 'importPlaylistTracks',
      accountId: provider.id,
      playlistId: playlist.id,
      spotifyPlaylistId,
    });
  } catch (error) {
    const message = functionErrorMessage(error);
    await base44.entities.Playlist.update(playlist.id, {
      trackSyncStatus: 'failed',
      syncStatus: 'error',
      lastError: message,
      lastTrackSyncAt: new Date().toISOString(),
    }).catch(() => {});
    throw new Error(message);
  }

  if (!res.data?.success) {
    const message = functionErrorMessage(null, res.data);
    await base44.entities.Playlist.update(playlist.id, {
      trackSyncStatus: 'failed',
      syncStatus: 'error',
      lastError: message,
      lastTrackSyncAt: new Date().toISOString(),
    }).catch(() => {});
    throw new Error(message);
  }

  const imported = Number(res.data.imported || res.data.importedTracks || 0);
  const total = Number(res.data.total || playlist.totalTracks || 0);
  const status = imported > 0 && (!total || imported >= total) ? 'success' : imported > 0 ? 'partial' : 'failed';
  await base44.entities.Playlist.update(playlist.id, {
    importedTracks: imported,
    totalTracks: total,
    trackSyncStatus: status,
    syncStatus: status === 'failed' ? 'error' : status === 'partial' ? 'partial' : 'synced',
    lastTrackSyncAt: new Date().toISOString(),
    lastSyncAt: new Date().toISOString(),
    lastError: status === 'failed' ? 'NO_TRACKS_IMPORTED' : '',
  });
  return imported;
}

function SpotifyPlaylistPicker({ provider, player, importedPlaylists, onImported, onClose }) {
  const [spotifyPlaylists, setSpotifyPlaylists] = useState([]);
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(null);
  const [error, setError] = useState('');

  const loadPlaylists = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await invoke('spotifyAccountControl', { action: 'getUserPlaylists', accountId: provider.id, limit: 50 });
      if (!res.data?.success) throw new Error(functionErrorMessage(null, res.data));
      setSpotifyPlaylists(res.data.playlists || []);
      toast.success(`${res.data.playlists?.length || 0} Spotify Playlists geladen.`);
    } catch (error) {
      setError(functionErrorMessage(error));
    } finally {
      setLoading(false);
    }
  };

  const handleImport = async (spotifyPlaylist) => {
    setImporting(spotifyPlaylist.id);
    try {
      const playlist = await upsertPlaylistMetadata({ provider, player, spotifyPlaylist });
      const imported = await importTracks({ provider, playlist, spotifyPlaylistId: spotifyPlaylist.id });
      toast.success(`"${spotifyPlaylist.name}" importiert: ${imported} Songs.`);
      onImported();
    } catch (error) {
      toast.error(error.message);
      onImported();
    } finally {
      setImporting(null);
    }
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="bg-card border-border max-w-4xl flex flex-col" style={{ maxHeight: '85vh' }}>
        <DialogHeader>
          <DialogTitle>Spotify Playlists laden · {getProviderLabel(provider)}</DialogTitle>
        </DialogHeader>
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm text-muted-foreground">Importiert fur Player: <strong>{getPlayerLabel(player)}</strong></p>
          <Button onClick={loadPlaylists} disabled={loading} className="gap-2">
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Load Spotify Playlists
          </Button>
        </div>
        {error && <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-sm text-red-400"><AlertCircle className="w-4 h-4" />{error}</div>}
        <div className="overflow-y-auto flex-1 grid md:grid-cols-2 gap-3 pr-1">
          {spotifyPlaylists.map((spotifyPlaylist) => {
            const already = importedPlaylists.some((playlist) => playlist.providerPlaylistId === spotifyPlaylist.id && (playlist.providerId || playlist.spotifyAccountId) === provider.id);
            return (
              <div key={spotifyPlaylist.id} className="rounded-xl border border-border/40 bg-background/40 p-3 space-y-3">
                <div className="flex gap-3">
                  {spotifyPlaylist.images?.[0]?.url ? <img src={spotifyPlaylist.images[0].url} alt={spotifyPlaylist.name} className="w-16 h-16 rounded-lg object-cover" /> : <div className="w-16 h-16 bg-muted/30 rounded-lg flex items-center justify-center"><Music2 className="w-6 h-6 text-muted-foreground" /></div>}
                  <div className="min-w-0 flex-1">
                    <p className="font-bold truncate">{spotifyPlaylist.name}</p>
                    <p className="text-xs text-muted-foreground truncate">{spotifyPlaylist.owner?.display_name || spotifyPlaylist.owner?.id} · {spotifyPlaylist.tracks?.total ?? 0} tracks</p>
                    <p className="text-xs text-muted-foreground truncate">{spotifyPlaylist.uri}</p>
                    <p className={already ? 'text-xs text-green-400' : 'text-xs text-muted-foreground'}>{already ? 'Already imported' : 'Not imported'}</p>
                  </div>
                </div>
                <Button className="w-full gap-2" variant={already ? 'outline' : 'default'} onClick={() => handleImport(spotifyPlaylist)} disabled={importing === spotifyPlaylist.id || !player?.id}>
                  {importing === spotifyPlaylist.id ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />} Import
                </Button>
              </div>
            );
          })}
          {spotifyPlaylists.length === 0 && <div className="md:col-span-2 text-center py-12 text-sm text-muted-foreground">Load playlists from this Spotify account.</div>}
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function Playlists() {
  const [selectedPlayerId, setSelectedPlayerId] = useState('');
  const [showSpotifyPicker, setShowSpotifyPicker] = useState(false);
  const [detailPlaylist, setDetailPlaylist] = useState(null);
  const [resyncingId, setResyncingId] = useState(null);
  const [playlistInput, setPlaylistInput] = useState('');
  const [search, setSearch] = useState('');
  const [filterProviderId, setFilterProviderId] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const queryClient = useQueryClient();

  const { data: playlists = [], isLoading } = useQuery({ queryKey: ['playlists'], queryFn: () => base44.entities.Playlist.list('-lastSyncAt') });
  const { data: providers = [] } = useQuery({ queryKey: ['providers'], queryFn: () => base44.entities.Provider.list('-created_date') });
  const { data: players = [] } = useQuery({ queryKey: ['players'], queryFn: () => base44.entities.Player.list('-updated_date') });

  const selectedPlayer = players.find((player) => player.id === selectedPlayerId) || players[0] || null;
  const selectedProvider = findProviderForPlayer(providers, selectedPlayer);
  const connectedProviders = providers.filter((provider) => getProviderStatus(provider) === 'connected');

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.Playlist.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['playlists'] });
      toast.success('Playlist entfernt.');
    },
  });

  const filtered = useMemo(() => playlists.filter((playlist) => {
    if (search && !playlist.name?.toLowerCase().includes(search.toLowerCase())) return false;
    const playlistProviderId = playlist.providerId || playlist.spotifyAccountId || playlist.apiCredentialSetId || '';
    if (filterProviderId !== 'all' && playlistProviderId !== filterProviderId) return false;
    if (filterStatus !== 'all' && (playlist.trackSyncStatus || playlist.syncStatus) !== filterStatus) return false;
    return true;
  }), [playlists, search, filterProviderId, filterStatus]);

  const refresh = () => queryClient.invalidateQueries({ queryKey: ['playlists'] });

  const importByInput = async () => {
    if (!selectedPlayer) return toast.error('Wahle zuerst einen Player.');
    if (!selectedProvider) return toast.error('Dieser Player hat keinen verbundenen Spotify Provider. Weise den Provider direkt am Player zu.');
    const playlistId = parseSpotifyPlaylistInput(playlistInput);
    if (!playlistId) return toast.error('Invalid Spotify playlist link or URI.');
    try {
      const metadata = { id: playlistId, uri: toSpotifyPlaylistUri(playlistInput), name: playlistId, tracks: { total: 0 }, owner: { display_name: '' }, images: [] };
      const playlist = await upsertPlaylistMetadata({ provider: selectedProvider, player: selectedPlayer, spotifyPlaylist: metadata });
      const imported = await importTracks({ provider: selectedProvider, playlist, spotifyPlaylistId: playlistId });
      toast.success(`Playlist importiert: ${imported} Songs.`);
      setPlaylistInput('');
      refresh();
    } catch (error) {
      toast.error(error.message);
      refresh();
    }
  };

  const handleResync = async (playlist) => {
    const provider = findProviderForPlaylist(providers, playlist);
    if (!provider) return toast.error('Provider nicht gefunden. Playlist ist nicht sauber einem Player-Provider zugeordnet.');
    setResyncingId(playlist.id);
    try {
      await base44.entities.Playlist.update(playlist.id, { trackSyncStatus: 'loading', syncStatus: 'pending' });
      const imported = await importTracks({ provider, playlist, spotifyPlaylistId: playlist.providerPlaylistId });
      toast.success(`${imported} Songs neu importiert.`);
      refresh();
    } catch (error) {
      toast.error(error.message);
      refresh();
    } finally {
      setResyncingId(null);
    }
  };

  const handlePlay = async (playlist) => {
    const targetPlayer = players.find((player) => player.id === (playlist.playerId || selectedPlayer?.id)) || selectedPlayer;
    if (!targetPlayer) return toast.error('Kein Player ausgewahlt.');
    await createPlayerCommand(targetPlayer, COMMAND.PLAY_PLAYLIST, { playlistId: playlist.id, contextUri: playlist.providerPlaylistUri });
    toast.success('PLAY_PLAYLIST gesendet. Erfolg erscheint erst nach Player-Bestatigung.');
  };

  return (
    <div className="p-4 lg:p-8 space-y-6 max-w-7xl mx-auto">
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl lg:text-3xl font-black flex items-center gap-3"><div className="w-10 h-10 rounded-xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center"><Music2 className="w-5 h-5 text-violet-400" /></div>Playlist Catalog</h1>
          <p className="text-sm text-muted-foreground mt-1 ml-14">Import playlists and songs from connected Spotify accounts.</p>
        </div>
      </div>

      <div className="bento-panel p-5 space-y-4">
        <div className="grid lg:grid-cols-[1fr_auto] gap-3 items-end">
          <div>
            <label className="text-sm font-semibold mb-2 block">Player / Spotify Account</label>
            <Select value={selectedPlayer?.id || ''} onValueChange={setSelectedPlayerId}>
              <SelectTrigger className="h-11 bg-background/50"><SelectValue placeholder="Player wahlen" /></SelectTrigger>
              <SelectContent>
                {players.map((player) => {
                  const provider = findProviderForPlayer(providers, player);
                  return <SelectItem key={player.id} value={player.id}>{getPlayerLabel(player)} · {provider ? getProviderLabel(provider) : 'kein Provider am Player'}</SelectItem>;
                })}
              </SelectContent>
            </Select>
          </div>
          <Button className="h-11 gap-2" onClick={() => setShowSpotifyPicker(true)} disabled={!selectedProvider || getProviderStatus(selectedProvider) !== 'connected'}>
            <Download className="w-4 h-4" /> Load Spotify Playlists
          </Button>
        </div>
        {selectedProvider ? <p className="text-xs text-muted-foreground">Provider direkt am Player: <strong>{getProviderLabel(selectedProvider)}</strong> · Status: <span className={getProviderStatus(selectedProvider) === 'connected' ? 'text-green-400' : 'text-yellow-400'}>{getProviderStatus(selectedProvider)}</span></p> : <p className="text-xs text-yellow-300">Dieser Player hat keinen Spotify Provider. Weise den Provider direkt am Player zu. Zonen werden nicht mehr als Provider-Fallback verwendet.</p>}
        <div className="grid lg:grid-cols-[1fr_auto] gap-3 items-end">
          <div>
            <label className="text-sm font-semibold mb-2 block">Spotify Playlist Link or URI</label>
            <Input value={playlistInput} onChange={(event) => setPlaylistInput(event.target.value)} placeholder="https://open.spotify.com/playlist/... oder spotify:playlist:..." className="h-11 bg-background/50" />
          </div>
          <Button variant="outline" className="h-11 gap-2" onClick={importByInput}><Link2 className="w-4 h-4" /> Import Playlist</Button>
        </div>
      </div>

      {connectedProviders.length === 0 && <div className="bento-panel border-yellow-500/20 bg-yellow-500/5 p-5 flex items-center gap-3"><AlertCircle className="w-5 h-5 text-yellow-400" /><p className="text-sm text-yellow-300">Kein Spotify Provider verbunden. Gehe zu <a href="/spotify-accounts" className="underline font-semibold">Spotify Provider</a>.</p></div>}

      <div className="bento-panel p-5 space-y-4">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <h2 className="text-xl font-black">Playlist Catalog</h2>
          <div className="flex gap-2 flex-wrap">
            <div className="relative"><Search className="w-4 h-4 absolute left-3 top-3 text-muted-foreground" /><Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search playlists" className="pl-9 h-10 w-52" /></div>
            <Select value={filterProviderId} onValueChange={setFilterProviderId}>
              <SelectTrigger className="w-44 h-10"><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="all">All Providers</SelectItem>{providers.map((provider) => <SelectItem key={provider.id} value={provider.id}>{getProviderLabel(provider)}</SelectItem>)}</SelectContent>
            </Select>
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-44 h-10"><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="all">All sync status</SelectItem><SelectItem value="success">Success</SelectItem><SelectItem value="partial">Partial</SelectItem><SelectItem value="failed">Failed</SelectItem><SelectItem value="loading">Loading</SelectItem></SelectContent>
            </Select>
          </div>
        </div>

        {isLoading ? <div className="flex items-center justify-center gap-2 py-10"><RefreshCw className="w-5 h-5 animate-spin text-primary" /></div> : filtered.length === 0 ? <div className="py-12 text-sm text-muted-foreground">No playlists imported yet.</div> : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            <AnimatePresence>
              {filtered.map((playlist, index) => {
                const provider = findProviderForPlaylist(providers, playlist);
                const player = players.find((candidate) => candidate.id === playlist.playerId);
                const statusKey = playlist.trackSyncStatus || playlist.syncStatus || 'not_imported';
                const syncCfg = SYNC_CFG[statusKey] || SYNC_CFG.not_imported;
                const missingTracks = (playlist.totalTracks || 0) > 0 && (playlist.importedTracks || 0) < (playlist.totalTracks || 0);
                return (
                  <motion.div key={playlist.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.03 }}>
                    <div className="bento-panel overflow-hidden group">
                      {playlist.coverUrl ? <img src={playlist.coverUrl} alt={playlist.name} className="w-full aspect-square object-cover" /> : <div className="w-full aspect-square bg-muted/20 flex items-center justify-center"><Music2 className="w-12 h-12 text-muted-foreground/30" /></div>}
                      <div className="p-4 space-y-3">
                        <div>
                          <p className="font-bold truncate">{playlist.name}</p>
                          <p className="text-xs text-muted-foreground truncate">{provider ? getProviderLabel(provider) : 'No provider'} · {player ? getPlayerLabel(player) : 'No player'}</p>
                        </div>
                        <div className="flex items-center justify-between text-xs"><span className={`font-semibold ${syncCfg.color}`}>{syncCfg.label}</span><span className="text-muted-foreground">{playlist.importedTracks || 0} / {playlist.totalTracks || 0} songs</span></div>
                        {missingTracks && <div className="flex items-center gap-1 text-xs text-yellow-400"><AlertCircle className="w-3 h-3" /> Songs are missing. Sync again.</div>}
                        {playlist.lastError && <p className="text-xs text-red-400 break-words">{playlist.lastError}</p>}
                        <div className="grid grid-cols-4 gap-2">
                          <Button size="sm" className="gap-1.5 h-8 text-xs col-span-2 bg-green-600 hover:bg-green-700" onClick={() => handlePlay(playlist)} disabled={!playlist.providerPlaylistUri}><Play className="w-3.5 h-3.5" /> Play</Button>
                          <Button size="sm" variant="outline" className="h-8" onClick={() => setDetailPlaylist(playlist)}><Eye className="w-3.5 h-3.5" /></Button>
                          <Button size="sm" variant="outline" className="h-8" onClick={() => handleResync(playlist)} disabled={resyncingId === playlist.id}><RefreshCw className={`w-3.5 h-3.5 ${resyncingId === playlist.id ? 'animate-spin' : ''}`} /></Button>
                        </div>
                        <Button size="sm" variant="ghost" className="w-full h-8 text-destructive/70 hover:text-destructive" onClick={() => deleteMutation.mutate(playlist.id)}><X className="w-3.5 h-3.5 mr-1" /> Remove</Button>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        )}
      </div>

      {showSpotifyPicker && selectedProvider && <SpotifyPlaylistPicker provider={selectedProvider} player={selectedPlayer} importedPlaylists={playlists} onImported={refresh} onClose={() => setShowSpotifyPicker(false)} />}
      {detailPlaylist && <Dialog open onOpenChange={() => setDetailPlaylist(null)}><DialogContent className="bg-card border-border max-w-4xl max-h-[85vh] overflow-y-auto"><DialogHeader><DialogTitle className="flex items-center gap-3">{detailPlaylist.coverUrl && <img src={detailPlaylist.coverUrl} alt="" className="w-12 h-12 rounded-lg" />}{detailPlaylist.name}</DialogTitle></DialogHeader><div className="grid md:grid-cols-3 gap-3 text-xs text-muted-foreground"><div>Total: {detailPlaylist.totalTracks || 0}</div><div>Imported: {detailPlaylist.importedTracks || 0}</div><div>Status: {detailPlaylist.trackSyncStatus || detailPlaylist.syncStatus}</div></div><PlaylistTrackList playlistId={detailPlaylist.id} /></DialogContent></Dialog>}
    </div>
  );
}
