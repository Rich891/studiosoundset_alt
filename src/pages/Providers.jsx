import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Link } from 'react-router-dom';
import { Plus, Zap, MoreVertical, RefreshCw, Trash2, Edit, TestTube, CheckCircle2, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';
import StatusBadge from '@/components/ui/StatusBadge';
import PageHeader from '@/components/ui/PageHeader';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';

const providerTypeLabels = {
  spotify_demo: 'Spotify Demo',
  apple_music: 'Apple Music',
  business_music: 'Business Music',
  custom_api: 'Custom API',
  local_audio: 'Local Audio',
};

const providerTypeIcons = {
  spotify_demo: '🎵',
  apple_music: '🍎',
  business_music: '🏢',
  custom_api: '⚙️',
  local_audio: '🔊',
};

export default function Providers() {
  const [deleteTarget, setDeleteTarget] = useState(null);
  const queryClient = useQueryClient();

  const { data: providers = [], isLoading } = useQuery({
    queryKey: ['providers'],
    queryFn: () => base44.entities.Provider.list(),
  });

  const { data: devices = [] } = useQuery({
    queryKey: ['devices'],
    queryFn: () => base44.entities.Device.filter({ isDeleted: false }),
  });

  const { data: playlists = [] } = useQuery({
    queryKey: ['playlists'],
    queryFn: () => base44.entities.Playlist.list(),
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.Provider.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['providers'] });
      toast.success('Provider wurde gelöscht.');
      setDeleteTarget(null);
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Provider.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['providers'] });
      toast.success('Provider wurde aktualisiert.');
    },
  });

  const handleTest = async (provider) => {
    toast.info('Verbindungstest läuft...');
    await updateMutation.mutateAsync({ 
      id: provider.id, 
      data: { lastConnectionTestAt: new Date().toISOString(), connectionStatus: 'pending' } 
    });
    // Simulate test
    setTimeout(async () => {
      const status = provider.accessTokenStored ? 'connected' : 'disconnected';
      await updateMutation.mutateAsync({
        id: provider.id,
        data: { connectionStatus: status, lastConnectionTestAt: new Date().toISOString() }
      });
      if (status === 'connected') toast.success('Verbindung erfolgreich!');
      else toast.error('Verbindung fehlgeschlagen. Bitte API-Daten prüfen.');
    }, 1500);
  };

  return (
    <div className="p-6 space-y-6">
      <PageHeader
        title="Provider"
        subtitle="Musikprovider und API-Verbindungen verwalten"
        actions={
          <Link to="/providers/add">
            <Button className="bg-primary hover:bg-primary/90">
              <Plus className="w-4 h-4 mr-2" /> Provider hinzufügen
            </Button>
          </Link>
        }
      />

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {[1,2,3].map(i => (
            <div key={i} className="glass-card rounded-xl h-48 animate-pulse" />
          ))}
        </div>
      ) : providers.length === 0 ? (
        <Card className="glass-card border-dashed border-primary/30">
          <CardContent className="p-12 text-center">
            <Zap className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">Noch kein Provider verbunden</h3>
            <p className="text-muted-foreground text-sm mb-6">
              Füge deinen ersten Musikprovider hinzu, um mit der Musiksteuerung zu beginnen.
            </p>
            <Link to="/providers/add">
              <Button className="bg-primary hover:bg-primary/90">
                <Plus className="w-4 h-4 mr-2" /> Provider hinzufügen
              </Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {providers.map(provider => {
            const deviceCount = devices.filter(d => d.providerId === provider.id).length;
            const playlistCount = playlists.filter(p => p.providerId === provider.id).length;
            
            return (
              <Card key={provider.id} className="glass-card hover:border-primary/30 transition-all">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center text-xl">
                        {providerTypeIcons[provider.type] || '🎵'}
                      </div>
                      <div>
                        <h3 className="font-semibold text-foreground">{provider.name}</h3>
                        <p className="text-xs text-muted-foreground">{providerTypeLabels[provider.type]}</p>
                      </div>
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="w-8 h-8">
                          <MoreVertical className="w-4 h-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => handleTest(provider)}>
                          <TestTube className="w-4 h-4 mr-2" /> Verbindung testen
                        </DropdownMenuItem>
                        <DropdownMenuItem asChild>
                          <Link to={`/providers/edit/${provider.id}`}>
                            <Edit className="w-4 h-4 mr-2" /> Bearbeiten
                          </Link>
                        </DropdownMenuItem>
                        <DropdownMenuItem 
                          onClick={() => updateMutation.mutate({ id: provider.id, data: { isActive: !provider.isActive } })}
                        >
                          {provider.isActive ? 'Deaktivieren' : 'Aktivieren'}
                        </DropdownMenuItem>
                        <DropdownMenuItem 
                          className="text-destructive"
                          onClick={() => setDeleteTarget(provider)}
                        >
                          <Trash2 className="w-4 h-4 mr-2" /> Löschen
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex flex-wrap gap-2">
                    <StatusBadge status={provider.connectionStatus || 'disconnected'} />
                    <StatusBadge status={provider.licenseStatus || 'unknown'} />
                    {!provider.isActive && <StatusBadge status="inactive" />}
                  </div>

                  {provider.type === 'spotify_demo' && (
                    <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-2.5 text-xs text-yellow-400">
                      ⚠️ Nur für private Demo-/Testnutzung. Nicht für gewerbliche Studiobeschallung geeignet.
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="bg-muted/50 rounded-lg p-2">
                      <p className="text-muted-foreground">Geräte</p>
                      <p className="font-semibold text-foreground">{deviceCount}</p>
                    </div>
                    <div className="bg-muted/50 rounded-lg p-2">
                      <p className="text-muted-foreground">Playlists</p>
                      <p className="font-semibold text-foreground">{playlistCount}</p>
                    </div>
                  </div>

                  {provider.lastSyncAt && (
                    <p className="text-xs text-muted-foreground">
                      Zuletzt sync: {format(new Date(provider.lastSyncAt), 'dd.MM.yy HH:mm')}
                    </p>
                  )}

                  <div className="flex gap-2 pt-1">
                    <Button 
                      variant="outline" size="sm" className="flex-1 text-xs"
                      onClick={() => handleTest(provider)}
                    >
                      <TestTube className="w-3 h-3 mr-1" /> Testen
                    </Button>
                    <Link to={`/providers/edit/${provider.id}`} className="flex-1">
                      <Button variant="outline" size="sm" className="w-full text-xs">
                        <Edit className="w-3 h-3 mr-1" /> Bearbeiten
                      </Button>
                    </Link>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* API Setup Link */}
      <Card className="glass-card border-blue-500/20">
        <CardContent className="p-4 flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center flex-shrink-0">
            <CheckCircle2 className="w-5 h-5 text-blue-400" />
          </div>
          <div className="flex-1">
            <h3 className="font-medium text-sm">API Setup Anleitung</h3>
            <p className="text-xs text-muted-foreground">Schritt-für-Schritt Anleitung für die API-Einrichtung in Base44</p>
          </div>
          <Link to="/providers/api-setup">
            <Button variant="outline" size="sm">Anleitung öffnen</Button>
          </Link>
        </CardContent>
      </Card>

      <AlertDialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Provider löschen?</AlertDialogTitle>
            <AlertDialogDescription>
              "{deleteTarget?.name}" wird endgültig gelöscht. Verbundene Geräte verlieren ihren Provider.
              Logs bleiben erhalten.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
            <AlertDialogAction 
              className="bg-destructive hover:bg-destructive/90"
              onClick={() => deleteMutation.mutate(deleteTarget.id)}
            >
              Endgültig löschen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}