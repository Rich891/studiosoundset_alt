import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Plus, Zap, RefreshCw, Trash2, Edit, TestTube, CheckCircle2, AlertCircle, XCircle, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { toast } from 'sonner';
import { format } from 'date-fns';

const typeLabels = { spotify_demo: 'Spotify Demo', apple_music: 'Apple Music', business_music: 'Business Music', custom_api: 'Custom API', local_audio: 'Local Audio' };

const statusConfig = {
  connected:    { icon: CheckCircle2, color: 'text-green-400',  bg: 'bg-green-500/10',  border: 'border-green-500/25',  label: 'Verbunden' },
  disconnected: { icon: XCircle,      color: 'text-red-400',    bg: 'bg-red-500/10',    border: 'border-red-500/25',    label: 'Getrennt' },
  pending:      { icon: Clock,        color: 'text-yellow-400', bg: 'bg-yellow-500/10', border: 'border-yellow-500/25', label: 'Prüfung läuft...' },
  error:        { icon: AlertCircle,  color: 'text-red-400',    bg: 'bg-red-500/10',    border: 'border-red-500/25',    label: 'Fehler' },
  expired:      { icon: AlertCircle,  color: 'text-yellow-400', bg: 'bg-yellow-500/10', border: 'border-yellow-500/25', label: 'Token abgelaufen' },
};

export default function Providers() {
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [testing, setTesting] = useState({});
  const queryClient = useQueryClient();

  const { data: providers = [], isLoading } = useQuery({ queryKey: ['providers'], queryFn: () => base44.entities.Provider.list() });
  const { data: devices = [] }   = useQuery({ queryKey: ['devices'],   queryFn: () => base44.entities.Device.filter({ isDeleted: false }) });
  const { data: playlists = [] } = useQuery({ queryKey: ['playlists'], queryFn: () => base44.entities.Playlist.list() });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.Provider.delete(id),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['providers'] }); toast.success('Provider gelöscht.'); setDeleteTarget(null); },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Provider.update(id, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['providers'] }),
  });

  const handleTest = async (provider) => {
    setTesting(p => ({ ...p, [provider.id]: true }));
    updateMutation.mutate({ id: provider.id, data: { connectionStatus: 'pending', lastConnectionTestAt: new Date().toISOString() } });
    if (provider.type === 'spotify_demo') {
      const res = await base44.functions.invoke('spotifyTest', { providerId: provider.id });
      queryClient.invalidateQueries({ queryKey: ['providers'] });
      if (res.data?.success) {
        toast.success(`Spotify verbunden! ${res.data.profile?.displayName || ''} · ${res.data.devices?.length || 0} Gerät(e)`);
      } else {
        toast.error(`Verbindung fehlgeschlagen: ${res.data?.reason || 'Unbekannt'}`);
      }
    } else {
      setTimeout(() => {
        updateMutation.mutate({ id: provider.id, data: { connectionStatus: provider.accessTokenStored ? 'connected' : 'disconnected', lastConnectionTestAt: new Date().toISOString() } });
        queryClient.invalidateQueries({ queryKey: ['providers'] });
        if (provider.accessTokenStored) toast.success('Verbindung erfolgreich!');
        else toast.error('Kein Token gespeichert.');
      }, 1200);
    }
    setTesting(p => ({ ...p, [provider.id]: false }));
  };

  return (
    <div className="p-4 lg:p-8 space-y-6 max-w-7xl mx-auto">
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl lg:text-3xl font-black text-foreground flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center">
              <Zap className="w-5 h-5 text-violet-400" />
            </div>
            Provider
          </h1>
          <p className="text-sm text-muted-foreground mt-1 ml-14">Musikprovider und API-Verbindungen</p>
        </div>
        <Link to="/providers/add">
          <Button className="bg-primary hover:bg-primary/90 h-11 px-6 gap-2 font-semibold">
            <Plus className="w-4 h-4" /> Provider hinzufügen
          </Button>
        </Link>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {[1,2,3].map(i => <div key={i} className="rounded-xl h-60 skeleton" />)}
        </div>
      ) : providers.length === 0 ? (
        <div className="bento-panel border-dashed border-primary/20 p-16 text-center">
          <div className="w-20 h-20 rounded-2xl bg-violet-500/10 flex items-center justify-center mx-auto mb-5">
            <Zap className="w-10 h-10 text-violet-400/40" />
          </div>
          <h3 className="text-xl font-bold mb-2">Noch kein Provider verbunden</h3>
          <p className="text-muted-foreground text-sm mb-6">Füge deinen ersten Musikprovider hinzu.</p>
          <Link to="/providers/add">
            <Button className="bg-primary hover:bg-primary/90 h-11 px-6 gap-2">
              <Plus className="w-4 h-4" /> Provider hinzufügen
            </Button>
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {providers.map((provider, idx) => {
            const sc = statusConfig[provider.connectionStatus] || statusConfig.disconnected;
            const StatusIcon = sc.icon;
            const deviceCount = devices.filter(d => d.providerId === provider.id).length;
            const playlistCount = playlists.filter(p => p.providerId === provider.id).length;
            const isTesting = testing[provider.id];

            return (
              <motion.div
                key={provider.id}
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.06 }}
                whileHover={{ y: -3, transition: { duration: 0.15 } }}
              >
                <div className={`bento-panel ${sc.border} h-full`}>
                  <div className="p-5 space-y-4">
                    {/* Header */}
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <div className={`w-12 h-12 rounded-xl ${sc.bg} flex items-center justify-center text-2xl`}>
                          {provider.type === 'spotify_demo' ? '🎵' : provider.type === 'apple_music' ? '🍎' : '🎶'}
                        </div>
                        <div>
                          <h3 className="font-bold text-foreground text-base">{provider.name}</h3>
                          <p className="text-xs text-muted-foreground">{typeLabels[provider.type] || provider.type}</p>
                        </div>
                      </div>
                      <div className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg ${sc.bg} border ${sc.border}`}>
                        <StatusIcon className={`w-3.5 h-3.5 ${sc.color}`} />
                        <span className={`text-xs font-bold ${sc.color}`}>{sc.label}</span>
                      </div>
                    </div>

                    {/* Demo warning */}
                    {provider.type === 'spotify_demo' && (
                      <div className="bg-yellow-500/8 border border-yellow-500/20 rounded-lg p-2.5 text-xs text-yellow-300">
                        ⚠️ Nur für Demo/Test – nicht für gewerbliche Nutzung.
                      </div>
                    )}

                    {/* Stats */}
                    <div className="grid grid-cols-3 gap-2">
                      {[
                        { label: 'Token', ok: provider.accessTokenStored },
                        { label: 'Geräte', val: deviceCount },
                        { label: 'Playlists', val: playlistCount },
                      ].map((item, i) => (
                        <div key={i} className="bg-muted/20 rounded-lg p-2.5 text-center">
                          <p className="text-base font-black text-foreground">
                            {item.val !== undefined ? item.val : (item.ok ? '✓' : '✗')}
                          </p>
                          <p className="text-[10px] text-muted-foreground">{item.label}</p>
                        </div>
                      ))}
                    </div>

                    {provider.lastConnectionTestAt && (
                      <p className="text-xs text-muted-foreground">
                        Letzter Test: {format(new Date(provider.lastConnectionTestAt), 'dd.MM.yy HH:mm')}
                      </p>
                    )}

                    {/* Actions */}
                    <div className="space-y-2 pt-1">
                      {provider.type === 'spotify_demo' && !provider.accessTokenStored ? (
                        <Button
                          className="w-full h-11 bg-green-600 hover:bg-green-500 text-white font-bold gap-2"
                          onClick={() => { window.location.href = `/spotify-connect?connect=${provider.id}`; }}
                        >
                          🎵 Mit Spotify verbinden
                        </Button>
                      ) : (
                        <Button
                          variant="outline"
                          className="w-full h-10 gap-2 font-semibold"
                          onClick={() => handleTest(provider)}
                          disabled={isTesting}
                        >
                          {isTesting
                            ? <><RefreshCw className="w-4 h-4 animate-spin" /> Teste...</>
                            : <><TestTube className="w-4 h-4" /> Verbindung testen</>
                          }
                        </Button>
                      )}
                      <div className="grid grid-cols-2 gap-2">
                        <Button variant="ghost" size="sm" className="h-9 gap-1.5 text-xs" asChild>
                          <Link to={`/providers/edit/${provider.id}`}><Edit className="w-3.5 h-3.5" /> Bearbeiten</Link>
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-9 gap-1.5 text-xs text-destructive hover:text-destructive hover:bg-destructive/10"
                          onClick={() => setDeleteTarget(provider)}
                        >
                          <Trash2 className="w-3.5 h-3.5" /> Löschen
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      <AlertDialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Provider löschen?</AlertDialogTitle>
            <AlertDialogDescription>
              "{deleteTarget?.name}" wird endgültig gelöscht. Verbundene Geräte verlieren ihren Provider.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive hover:bg-destructive/90" onClick={() => deleteMutation.mutate(deleteTarget.id)}>
              Endgültig löschen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}