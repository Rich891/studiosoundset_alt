import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Music2, Plus, RefreshCw, Download, Eye, AlertCircle, Play, X
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from 'sonner';
import PlaylistTrackList from '@/components/playlists/PlaylistTrackList';

const invoke = (fn, payload) => base44.functions.invoke(fn, payload);

const SYNC_CFG = {
  synced:       { color: 'text-green-400', label: 'Synchronisiert' },
  partial:      { color: 'text-yellow-400', label: 'Unvollständig' },
  pending:      { color: 'text-blue-400', label: 'Ausstehend' },
  error:        { color: 'text-red-400', label: 'Fehler' },
  not_imported: { color: 'text-muted-foreground', label: 'Nicht importiert' },
};

function ImportModal({ account, onImport, onClose }) {
  const [spotifyPlaylists, setSpotifyPlaylists] = useState([]);
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(null);
  const [error, setError] = useState('');

  const loadPlaylists = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await invoke('spotifyAccountControl', { action: 'getUserPlaylists', accountId: account.id, limit: 50 });
      if (res.data?.success) {
        setSpotifyPlaylists(res.data.playlists || []);
      } else {
        setError(res.data?.error || 'Fehler beim Laden der Playlists.');
      }
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadPlaylists(); }, []);

  const handleImport = async (pl) => {
    setImporting(pl.id);
    try {
      // Create or update playlist record in DB
      const existing = await base44.entities.Playlist.filter({ providerPlaylistId: pl.id, spotifyAccountId: account.id });
      let dbPlaylist;
      const plData = {
        spotifyAccountId: account.id,
        providerPlaylistId: pl.id,
        providerPlaylistUri: pl.uri,
        name: pl.name,
        description: pl.description || '',
        owner: pl.owner?.display_name || '',
        coverUrl: pl.images?.[0]?.url || '',
        totalTracks: pl.tracks?.total ?? pl.items?.total ?? 0,
        syncStatus: 'pending',
      };
      if (existing.length) {
        await base44.entities.Playlist.update(existing[0].id, plData);
        dbPlaylist = existing[0];
      } else {
        dbPlaylist = await base44.entities.Playlist.create(plData);
      }

      // Import tracks
      const trackRes = await invoke('spotifyAccountControl', {
        action: 'importPlaylistTracks',
        accountId: account.id,
        playlistId: dbPlaylist.id,
        spotifyPlaylistId: pl.id,
      });
      if (trackRes.data?.success) {
        toast.success(`"${pl.name}" importiert: ${trackRes.data.imported} Songs.`);
        onImport();
      } else {
        const err = trackRes.data?.error || 'Track-Import fehlgeschlagen.';
        if (err.includes('FORBIDDEN')) {
          toast.error('Kein Zugriff auf diese Playlist. Verbinde den Spotify Account neu (Scopes fehlen).');
        } else {
          toast.error(err);
        }
      }
    } catch (e) {
      toast.error(e.message);
    } finally {
      setImporting(null);
    }
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="bg-card border-border max-w-2xl flex flex-col" style={{ maxHeight: '85vh' }}>
        <DialogHeader className="flex-shrink-0">
          <DialogTitle>Playlists importieren — {account.displayName}</DialogTitle>
        </DialogHeader>
        {error && <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-sm text-red-400 flex-shrink-0"><AlertCircle className="w-4 h-4 flex-shrink-0" />{error}</div>}
        {loading ? (
          <div className="flex items-center justify-center gap-2 py-10"><RefreshCw className="w-5 h-5 animate-spin text-primary" /><span className="text-muted-foreground">Lade Playlists von Spotify...</span></div>
        ) : (
          <div className="overflow-y-auto flex-1 space-y-2 pr-1">
            {spotifyPlaylists.map(pl => (
              <div
                key={pl.id}
                className={`flex items-center gap-3 p-3 rounded-xl border transition-all cursor-pointer select-none
                  ${importing === pl.id
                    ? 'border-primary/50 bg-primary/5 opacity-70 pointer-events-none'
                    : 'border-border/30 hover:border-primary/50 hover:bg-primary/5'
                  }`}
                onClick={() => { if (!importing) handleImport(pl); }}
              >
                {pl.images?.[0]?.url
                  ? <img src={pl.images[0].url} alt={pl.name} className="w-12 h-12 rounded-lg flex-shrink-0 object-cover" />
                  : <div className="w-12 h-12 bg-muted/30 rounded-lg flex items-center justify-center flex-shrink-0"><Music2 className="w-5 h-5 text-muted-foreground" /></div>
                }
                <div className="flex-1 min-w-0">
                  <p className="font-semibold truncate">{pl.name}</p>
                  <p className="text-xs text-muted-foreground">{pl.tracks?.total ?? pl.items?.total ?? 0} Songs · {pl.owner?.display_name}</p>
                </div>
                <div className="flex items-center gap-1.5 flex-shrink-0 text-sm font-medium text-primary">
                  {importing === pl.id
                    ? <><RefreshCw className="w-3.5 h-3.5 animate-spin" /><span>Importiert...</span></>
                    : <><Download className="w-3.5 h-3.5" /><span>Importieren</span></>
                  }
                </div>
              </div>
            ))}
            {spotifyPlaylists.length === 0 && !loading && !error && (
              <p className="text-center text-muted-foreground py-6 text-sm">Keine Playlists für diesen Account gefunden.</p>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

export default function Playlists() {
  const [filterAccountId, setFilterAccountId] = useState('all');
  const [importingForAccount, setImportingForAccount] = useState(null);
  const [detailPlaylist, setDetailPlaylist] = useState(null);
  const [resyncingId, setResyncingId] = useState(null);
  const queryClient = useQueryClient();

  const { data: playlists = [], isLoading } = useQuery({
    queryKey: ['playlists'],
    queryFn: () => base44.entities.Playlist.list('-lastSyncAt'),
  });
  const { data: accounts = [] } = useQuery({
    queryKey: ['spotifyAccounts'],
    queryFn: () => base44.entities.SpotifyAccount.list(),
  });
  const { data: zones = [] } = useQuery({ queryKey: ['zones'], queryFn: () => base44.entities.Zone.list() });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.Playlist.delete(id),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['playlists'] }); toast.success('Playlist entfernt.'); },
  });

  const { data: zonesAll = [] } = useQuery({ queryKey: ['zones'], queryFn: () => base44.entities.Zone.list() });

  const handlePlay = async (pl) => {
    const account = accounts.find(a => a.id === pl.spotifyAccountId);
    if (!account) { toast.error('Kein Account für diese Playlist.'); return; }
    if (account.authStatus !== 'connected') { toast.error('Spotify Account nicht verbunden.'); return; }
    if (!pl.providerPlaylistUri) { toast.error('Keine Spotify URI gespeichert.'); return; }

    // Find target device for this account's zone
    const zone = zonesAll.find(z => z.spotifyAccountId === account.id);
    const targetDeviceId = zone?.targetDeviceId || undefined;

    try {
      const res = await invoke('spotifyAccountControl', {
        action: 'playPlaylist',
        accountId: account.id,
        contextUri: pl.providerPlaylistUri,
        deviceId: targetDeviceId,
      });
      if (res.data?.success) toast.success(`"${pl.name}" wird abgespielt.`);
      else toast.error(res.data?.error || 'Fehler beim Abspielen.');
    } catch (e) {
      toast.error(e.message);
    }
  };

  const connectedAccounts = accounts.filter(a => a.authStatus === 'connected');
  const filtered = filterAccountId === 'all' ? playlists : playlists.filter(p => p.spotifyAccountId === filterAccountId);

  const handleResync = async (playlist) => {
    const account = accounts.find(a => a.id === playlist.spotifyAccountId);
    if (!account) { toast.error('Account nicht gefunden.'); return; }
    setResyncingId(playlist.id);
    try {
      await base44.entities.Playlist.update(playlist.id, { syncStatus: 'pending' });
      const res = await invoke('spotifyAccountControl', {
        action: 'importPlaylistTracks',
        accountId: account.id,
        playlistId: playlist.id,
        spotifyPlaylistId: playlist.providerPlaylistId,
      });
      if (res.data?.success) {
        toast.success(`${res.data.imported} Songs neu importiert.`);
        queryClient.invalidateQueries({ queryKey: ['playlists'] });
      } else {
        const err = res.data?.error || 'Fehler.';
        if (err.includes('FORBIDDEN')) {
          toast.error('Kein Zugriff. Verbinde den Spotify Account neu (Scopes fehlen).');
        } else {
          toast.error(err);
        }
        queryClient.invalidateQueries({ queryKey: ['playlists'] });
      }
    } catch (e) {
      toast.error(e.message);
    } finally {
      setResyncingId(null);
    }
  };

  return (
    <div className="p-4 lg:p-8 space-y-6 max-w-6xl mx-auto">
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl lg:text-3xl font-black flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center">
              <Music2 className="w-5 h-5 text-violet-400" />
            </div>
            Playlists
          </h1>
          <p className="text-sm text-muted-foreground mt-1 ml-14">Playlists pro Spotify Account importieren und verwalten.</p>
        </div>
        {connectedAccounts.length > 0 && (
          <div className="flex gap-2 flex-wrap">
            {connectedAccounts.map(acc => (
              <Button key={acc.id} variant="outline" className="gap-2 h-11" onClick={() => setImportingForAccount(acc)}>
                <Download className="w-4 h-4" /> {acc.displayName}
              </Button>
            ))}
          </div>
        )}
      </div>

      {/* Filter */}
      {accounts.length > 1 && (
        <div className="flex items-center gap-3">
          <span className="text-sm text-muted-foreground">Filtern:</span>
          <div className="flex gap-2 flex-wrap">
            <button onClick={() => setFilterAccountId('all')} className={`px-4 py-1.5 rounded-full text-sm font-semibold border transition-all ${filterAccountId === 'all' ? 'bg-primary text-white border-primary' : 'border-border text-muted-foreground hover:text-foreground'}`}>Alle</button>
            {accounts.map(a => (
              <button key={a.id} onClick={() => setFilterAccountId(a.id)} className={`px-4 py-1.5 rounded-full text-sm font-semibold border transition-all ${filterAccountId === a.id ? 'bg-primary text-white border-primary' : 'border-border text-muted-foreground hover:text-foreground'}`}>{a.displayName}</button>
            ))}
          </div>
        </div>
      )}

      {connectedAccounts.length === 0 && (
        <div className="bento-panel border-yellow-500/20 bg-yellow-500/5 p-5 flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-yellow-400 flex-shrink-0" />
          <p className="text-sm text-yellow-300">Kein Spotify Account verbunden. Gehe zu <a href="/spotify-accounts" className="underline font-semibold">Spotify Accounts</a> und verbinde deine Accounts.</p>
        </div>
      )}

      {isLoading ? (
        <div className="flex items-center justify-center gap-2 py-10"><RefreshCw className="w-5 h-5 animate-spin text-primary" /></div>
      ) : filtered.length === 0 ? (
        <div className="bento-panel border-dashed border-primary/20 p-16 text-center">
          <Music2 className="w-16 h-16 text-muted-foreground/20 mx-auto mb-4" />
          <h3 className="text-xl font-bold mb-2">Keine Playlists</h3>
          <p className="text-muted-foreground text-sm">Importiere Playlists über den "Importieren" Button oben.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          <AnimatePresence>
            {filtered.map((pl, i) => {
              const account = accounts.find(a => a.id === pl.spotifyAccountId);
              const zone = zones.find(z => z.id === pl.zoneId);
              const syncCfg = SYNC_CFG[pl.syncStatus] || SYNC_CFG.not_imported;
              const tracksOk = pl.importedTracks > 0 && pl.importedTracks >= pl.totalTracks * 0.9;

              return (
                <motion.div key={pl.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}>
                  <div className="bento-panel overflow-hidden group">
                    {pl.coverUrl ? (
                      <div className="relative">
                        <img src={pl.coverUrl} alt={pl.name} className="w-full aspect-square object-cover" />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent" />
                        <div className="absolute bottom-3 left-3 right-3">
                          <p className="font-bold text-white truncate">{pl.name}</p>
                          <p className="text-xs text-white/60">{pl.owner}</p>
                        </div>
                      </div>
                    ) : (
                      <div className="w-full aspect-square bg-muted/20 flex items-center justify-center">
                        <Music2 className="w-12 h-12 text-muted-foreground/30" />
                      </div>
                    )}

                    <div className="p-4 space-y-3">
                      {!pl.coverUrl && <p className="font-bold truncate">{pl.name}</p>}
                      <div className="flex items-center justify-between flex-wrap gap-1">
                        <span className={`text-xs font-semibold ${syncCfg.color}`}>{syncCfg.label}</span>
                        {account && <span className="text-xs text-muted-foreground">{account.displayName}</span>}
                      </div>

                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span>{pl.importedTracks || 0} / {pl.totalTracks || '?'} Songs</span>
                        {pl.lastSyncAt && <span>{new Date(pl.lastSyncAt).toLocaleDateString('de')}</span>}
                      </div>

                      {!tracksOk && pl.syncStatus !== 'not_imported' && (
                        <div className="flex items-center gap-1 text-xs text-yellow-400">
                          <AlertCircle className="w-3 h-3" />
                          Songs unvollständig importiert.
                        </div>
                      )}

                      <div className="flex gap-2">
                        <Button size="sm" className="flex-1 gap-1.5 h-8 text-xs bg-green-600 hover:bg-green-700" onClick={() => handlePlay(pl)} disabled={!pl.providerPlaylistUri}>
                          <Play className="w-3.5 h-3.5" /> Abspielen
                        </Button>
                        <Button size="sm" variant="outline" className="gap-1.5 h-8 text-xs" onClick={() => setDetailPlaylist(pl)}>
                          <Eye className="w-3.5 h-3.5" />
                        </Button>
                        <Button size="sm" variant="outline" className="gap-1.5 h-8 text-xs" onClick={() => handleResync(pl)} disabled={resyncingId === pl.id}>
                          <RefreshCw className={`w-3.5 h-3.5 ${resyncingId === pl.id ? 'animate-spin' : ''}`} />
                        </Button>
                        <Button size="sm" variant="ghost" className="h-8 text-destructive/60 hover:text-destructive text-xs" onClick={() => deleteMutation.mutate(pl.id)}>
                          <X className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      )}

      {/* Import Modal */}
      {importingForAccount && (
        <ImportModal
          account={importingForAccount}
          onImport={() => { queryClient.invalidateQueries({ queryKey: ['playlists'] }); }}
          onClose={() => setImportingForAccount(null)}
        />
      )}

      {/* Detail Modal */}
      {detailPlaylist && (
        <Dialog open onOpenChange={() => setDetailPlaylist(null)}>
          <DialogContent className="bg-card border-border max-w-3xl max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-3">
                {detailPlaylist.coverUrl && <img src={detailPlaylist.coverUrl} alt="" className="w-10 h-10 rounded-lg" />}
                {detailPlaylist.name}
              </DialogTitle>
            </DialogHeader>
            <PlaylistTrackList playlistId={detailPlaylist.id} />
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}