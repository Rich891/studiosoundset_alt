import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Plus, Cpu, Trash2, Edit, TestTube, Volume2, MapPin, Wifi, WifiOff, Music2, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import DeleteDeviceModal from '@/components/devices/DeleteDeviceModal';
import { toast } from 'sonner';
import { format } from 'date-fns';

const statusConfig = {
  online:  { color: 'text-green-400',  bg: 'bg-green-500/10',  border: 'border-green-500/25',  dot: 'bg-green-400',  label: 'Online',   Icon: Wifi },
  warning: { color: 'text-yellow-400', bg: 'bg-yellow-500/10', border: 'border-yellow-500/25', dot: 'bg-yellow-400', label: 'Warnung',  Icon: WifiOff },
  offline: { color: 'text-red-400',    bg: 'bg-red-500/10',    border: 'border-red-500/25',    dot: 'bg-red-400',    label: 'Offline',  Icon: WifiOff },
  unknown: { color: 'text-gray-400',   bg: 'bg-gray-500/10',   border: 'border-gray-500/20',   dot: 'bg-gray-400',   label: 'Unbekannt',Icon: WifiOff },
};

export default function Devices() {
  const [deleteTarget, setDeleteTarget] = useState(null);
  const queryClient = useQueryClient();

  const { data: devices = [], isLoading } = useQuery({ queryKey: ['devices'], queryFn: () => base44.entities.Device.filter({ isDeleted: false }) });
  const { data: providers = [] } = useQuery({ queryKey: ['providers'], queryFn: () => base44.entities.Provider.list() });
  const { data: zones = [] }     = useQuery({ queryKey: ['zones'],     queryFn: () => base44.entities.Zone.list() });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Device.update(id, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['devices'] }),
  });

  const handleTest = async (device) => {
    toast.info(`Teste "${device.name}"...`);
    await updateMutation.mutateAsync({ id: device.id, data: { lastTestAt: new Date().toISOString() } });
    setTimeout(() => toast.success(`"${device.name}" antwortet!`), 1000);
  };

  const onlineCount  = devices.filter(d => d.status === 'online' && d.isActive).length;
  const warningCount = devices.filter(d => d.status === 'warning').length;
  const offlineCount = devices.filter(d => d.status !== 'online' && !d.isActive).length;

  return (
    <div className="p-4 lg:p-8 space-y-6 max-w-7xl mx-auto">
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl lg:text-3xl font-black text-foreground flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center">
              <Cpu className="w-5 h-5 text-cyan-400" />
            </div>
            Geräte
          </h1>
          <p className="text-sm text-muted-foreground mt-1 ml-14">Wiedergabegeräte verwalten</p>
        </div>
        <Link to="/devices/add">
          <Button className="bg-primary hover:bg-primary/90 h-11 px-6 gap-2 font-semibold">
            <Plus className="w-4 h-4" /> Gerät hinzufügen
          </Button>
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Online', val: onlineCount, color: 'text-green-400', bg: 'bg-green-500/10', border: 'border-green-500/20' },
          { label: 'Warnung', val: warningCount, color: 'text-yellow-400', bg: 'bg-yellow-500/10', border: 'border-yellow-500/20' },
          { label: 'Offline', val: offlineCount, color: 'text-red-400', bg: 'bg-red-500/10', border: 'border-red-500/20' },
        ].map((s, i) => (
          <div key={i} className={`rounded-xl border ${s.border} ${s.bg} p-4 text-center`}>
            <p className={`text-3xl font-black ${s.color}`}>{s.val}</p>
            <p className="text-xs text-muted-foreground mt-1">{s.label}</p>
          </div>
        ))}
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {[1,2,3].map(i => <div key={i} className="rounded-xl h-60 skeleton" />)}
        </div>
      ) : devices.length === 0 ? (
        <div className="bento-panel border-dashed border-primary/20 p-16 text-center">
          <div className="w-20 h-20 rounded-2xl bg-cyan-500/10 flex items-center justify-center mx-auto mb-5">
            <Cpu className="w-10 h-10 text-cyan-400/40" />
          </div>
          <h3 className="text-xl font-bold mb-2">Noch kein Gerät hinzugefügt</h3>
          <p className="text-muted-foreground text-sm mb-6">Verbinde ein Gerät mit einem Musikprovider und weise es einer Zone zu.</p>
          <Link to="/devices/add">
            <Button className="bg-primary hover:bg-primary/90 h-11 px-6 gap-2">
              <Plus className="w-4 h-4" /> Gerät hinzufügen
            </Button>
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {devices.map((device, idx) => {
            const provider = providers.find(p => p.id === device.providerId);
            const zone = zones.find(z => z.id === device.zoneId);
            const sc = statusConfig[device.status] || statusConfig.unknown;
            const StatusIcon = sc.Icon;

            return (
              <motion.div
                key={device.id}
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
                        <div className={`w-12 h-12 rounded-xl ${sc.bg} flex items-center justify-center relative`}>
                          <StatusIcon className={`w-5 h-5 ${sc.color}`} />
                          {device.status === 'online' && (
                            <div className={`absolute -top-1 -right-1 w-3 h-3 rounded-full ${sc.dot} border-2 border-background pulse-green`} />
                          )}
                        </div>
                        <div>
                          <h3 className="font-bold text-foreground text-base">{device.name}</h3>
                          <p className="text-xs text-muted-foreground">{device.type || 'Gerät'}</p>
                        </div>
                      </div>
                      <div className={`flex items-center gap-1.5 px-2 py-1 rounded-lg ${sc.bg}`}>
                        <div className={`w-1.5 h-1.5 rounded-full ${sc.dot}`} />
                        <span className={`text-xs font-bold ${sc.color}`}>{sc.label}</span>
                      </div>
                    </div>

                    {/* Details */}
                    <div className="space-y-2">
                      {zone && (
                        <div className="flex items-center gap-2 text-sm">
                          <MapPin className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                          <span className="text-muted-foreground">Zone:</span>
                          <span className="font-semibold" style={{ color: zone.color }}>{zone.name}</span>
                        </div>
                      )}
                      {provider && (
                        <div className="flex items-center gap-2 text-sm">
                          <Zap className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                          <span className="text-muted-foreground">Provider:</span>
                          <span className="font-semibold text-foreground">{provider.name}</span>
                        </div>
                      )}
                      {device.currentVolume !== undefined && (
                        <div className="flex items-center gap-2 text-sm">
                          <Volume2 className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                          <span className="text-muted-foreground">Lautstärke:</span>
                          <span className="text-2xl font-black text-primary ml-auto">{device.currentVolume}%</span>
                        </div>
                      )}
                      {device.currentTrack && (
                        <div className="flex items-center gap-2 text-sm bg-muted/20 rounded-lg p-2">
                          <Music2 className="w-3.5 h-3.5 text-primary flex-shrink-0" />
                          <span className="truncate text-foreground font-medium">{device.currentTrack}</span>
                        </div>
                      )}
                    </div>

                    {device.lastSeenAt && (
                      <p className="text-xs text-muted-foreground">
                        Letzter Kontakt: {format(new Date(device.lastSeenAt), 'dd.MM.yy HH:mm')}
                      </p>
                    )}

                    {/* Actions */}
                    <div className="space-y-2 pt-1">
                      <Button
                        className="w-full h-10 bg-primary/10 border border-primary/20 text-primary hover:bg-primary/20 gap-2 font-semibold"
                        onClick={() => handleTest(device)}
                      >
                        <TestTube className="w-4 h-4" /> Gerät testen
                      </Button>
                      <div className="grid grid-cols-2 gap-2">
                        <Button variant="ghost" size="sm" className="h-9 gap-1.5 text-xs" asChild>
                          <Link to={`/devices/edit/${device.id}`}><Edit className="w-3.5 h-3.5" /> Bearbeiten</Link>
                        </Button>
                        <Button
                          variant="ghost" size="sm"
                          className="h-9 gap-1.5 text-xs text-destructive hover:text-destructive hover:bg-destructive/10"
                          onClick={() => setDeleteTarget(device)}
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

      <DeleteDeviceModal device={deleteTarget} onClose={() => setDeleteTarget(null)} onDeleted={() => queryClient.invalidateQueries({ queryKey: ['devices'] })} />
    </div>
  );
}