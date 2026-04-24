import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Link } from 'react-router-dom';
import { Plus, Cpu, MoreVertical, Trash2, Edit, TestTube, Volume2, MapPin, Wifi, WifiOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import StatusBadge from '@/components/ui/StatusBadge';
import PageHeader from '@/components/ui/PageHeader';
import DeleteDeviceModal from '@/components/devices/DeleteDeviceModal';
import { toast } from 'sonner';
import { format } from 'date-fns';

export default function Devices() {
  const [deleteTarget, setDeleteTarget] = useState(null);
  const queryClient = useQueryClient();

  const { data: devices = [], isLoading } = useQuery({
    queryKey: ['devices'],
    queryFn: () => base44.entities.Device.filter({ isDeleted: false }),
  });

  const { data: providers = [] } = useQuery({
    queryKey: ['providers'],
    queryFn: () => base44.entities.Provider.list(),
  });

  const { data: zones = [] } = useQuery({
    queryKey: ['zones'],
    queryFn: () => base44.entities.Zone.list(),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Device.update(id, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['devices'] }),
  });

  const handleTest = async (device) => {
    toast.info(`Teste Gerät "${device.name}"...`);
    await updateMutation.mutateAsync({ id: device.id, data: { lastTestAt: new Date().toISOString() } });
    setTimeout(() => toast.success(`Gerät "${device.name}" antwortet!`), 1000);
  };

  const getProvider = (id) => providers.find(p => p.id === id);
  const getZone = (id) => zones.find(z => z.id === id);

  const onlineDevices = devices.filter(d => d.status === 'online' && d.isActive);
  const warningDevices = devices.filter(d => d.status === 'warning');
  const offlineDevices = devices.filter(d => d.status === 'offline' || !d.isActive);

  return (
    <div className="p-6 space-y-6">
      <PageHeader
        title="Geräte"
        subtitle="Wiedergabegeräte verwalten und konfigurieren"
        actions={
          <Link to="/devices/add">
            <Button className="bg-primary hover:bg-primary/90">
              <Plus className="w-4 h-4 mr-2" /> Gerät hinzufügen
            </Button>
          </Link>
        }
      />

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="glass-card rounded-xl p-4 text-center">
          <div className="text-2xl font-bold text-green-400">{onlineDevices.length}</div>
          <p className="text-xs text-muted-foreground mt-1">Online</p>
        </div>
        <div className="glass-card rounded-xl p-4 text-center">
          <div className="text-2xl font-bold text-yellow-400">{warningDevices.length}</div>
          <p className="text-xs text-muted-foreground mt-1">Warnung</p>
        </div>
        <div className="glass-card rounded-xl p-4 text-center">
          <div className="text-2xl font-bold text-red-400">{offlineDevices.length}</div>
          <p className="text-xs text-muted-foreground mt-1">Offline</p>
        </div>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {[1,2,3].map(i => <div key={i} className="glass-card rounded-xl h-48 animate-pulse" />)}
        </div>
      ) : devices.length === 0 ? (
        <Card className="glass-card border-dashed border-primary/30">
          <CardContent className="p-12 text-center">
            <Cpu className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">Noch kein Gerät hinzugefügt</h3>
            <p className="text-muted-foreground text-sm mb-6">
              Verbinde ein Wiedergabegerät mit einem Musikprovider und weise es einer Zone zu.
            </p>
            <Link to="/devices/add">
              <Button className="bg-primary hover:bg-primary/90">
                <Plus className="w-4 h-4 mr-2" /> Gerät hinzufügen
              </Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {devices.map(device => {
            const provider = getProvider(device.providerId);
            const zone = getZone(device.zoneId);
            return (
              <Card key={device.id} className="glass-card hover:border-primary/30 transition-all">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                        device.status === 'online' ? 'bg-green-500/10' :
                        device.status === 'warning' ? 'bg-yellow-500/10' : 'bg-muted'
                      }`}>
                        {device.status === 'online' 
                          ? <Wifi className="w-5 h-5 text-green-400" />
                          : <WifiOff className="w-5 h-5 text-muted-foreground" />
                        }
                      </div>
                      <div>
                        <h3 className="font-semibold text-foreground">{device.name}</h3>
                        <p className="text-xs text-muted-foreground">{device.type || 'Gerät'}</p>
                      </div>
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="w-8 h-8">
                          <MoreVertical className="w-4 h-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => handleTest(device)}>
                          <TestTube className="w-4 h-4 mr-2" /> Gerät testen
                        </DropdownMenuItem>
                        <DropdownMenuItem asChild>
                          <Link to={`/devices/edit/${device.id}`}>
                            <Edit className="w-4 h-4 mr-2" /> Bearbeiten
                          </Link>
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => updateMutation.mutate({ id: device.id, data: { isActive: !device.isActive } })}>
                          {device.isActive ? 'Deaktivieren' : 'Aktivieren'}
                        </DropdownMenuItem>
                        <DropdownMenuItem className="text-destructive" onClick={() => setDeleteTarget(device)}>
                          <Trash2 className="w-4 h-4 mr-2" /> Löschen
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex flex-wrap gap-2">
                    <StatusBadge status={device.status || 'unknown'} />
                    {!device.isActive && <StatusBadge status="inactive" />}
                  </div>

                  <div className="space-y-1.5 text-xs">
                    {provider && (
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <span>Provider:</span>
                        <span className="text-foreground font-medium">{provider.name}</span>
                      </div>
                    )}
                    {zone && (
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <MapPin className="w-3 h-3" />
                        <span className="text-foreground font-medium">{zone.name}</span>
                      </div>
                    )}
                    {device.currentVolume !== undefined && (
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Volume2 className="w-3 h-3" />
                        <span className="text-foreground font-medium">{device.currentVolume}%</span>
                      </div>
                    )}
                    {device.currentTrack && (
                      <p className="text-muted-foreground truncate">♪ {device.currentTrack}</p>
                    )}
                  </div>

                  {device.lastSeenAt && (
                    <p className="text-xs text-muted-foreground">
                      Zuletzt aktiv: {format(new Date(device.lastSeenAt), 'dd.MM.yy HH:mm')}
                    </p>
                  )}

                  <Button 
                    variant="outline" size="sm" className="w-full text-xs"
                    onClick={() => handleTest(device)}
                  >
                    <TestTube className="w-3 h-3 mr-1" /> Gerät testen
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <DeleteDeviceModal 
        device={deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onDeleted={() => queryClient.invalidateQueries({ queryKey: ['devices'] })}
      />
    </div>
  );
}