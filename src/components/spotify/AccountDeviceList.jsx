import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Monitor, Smartphone, Tablet, RefreshCw, Star, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

const invoke = (fn, payload) => base44.functions.invoke(fn, payload);
const DEVICE_ICONS = { Computer: Monitor, Smartphone, Tablet };
const providerStatus = (account) => account?.status || account?.authStatus || 'disconnected';

export default function AccountDeviceList({ account }) {
  const [loading, setLoading] = useState(false);
  const queryClient = useQueryClient();
  const connected = providerStatus(account) === 'connected';

  const { data: devices = [] } = useQuery({
    queryKey: ['spotifyDevices', account.id],
    queryFn: () => base44.entities.SpotifyDevice.filter({ spotifyAccountId: account.id }),
    enabled: connected,
  });

  const handleLoadDevices = async () => {
    if (!connected) return toast.error('Provider muss zuerst mit Spotify verbunden werden.');
    setLoading(true);
    try {
      const res = await invoke('spotifyAccountControl', { action: 'getDevices', accountId: account.id });
      if (res.data?.success) {
        toast.success(`${res.data.devices?.length || 0} Geräte gefunden.`);
        queryClient.invalidateQueries({ queryKey: ['spotifyDevices', account.id] });
      } else {
        toast.error(res.data?.error || 'Fehler beim Laden der Geräte.');
      }
    } catch (e) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSetTarget = async (device) => {
    try {
      for (const d of devices) {
        if (d.isSelectedTarget && d.id !== device.id) await base44.entities.SpotifyDevice.update(d.id, { isSelectedTarget: false });
      }
      await base44.entities.SpotifyDevice.update(device.id, { isSelectedTarget: true });
      if (account.zoneId) await base44.entities.Zone.update(account.zoneId, { targetDeviceId: device.id });
      toast.success(`"${device.name}" als Zielgerät gesetzt.`);
      queryClient.invalidateQueries({ queryKey: ['spotifyDevices', account.id] });
      queryClient.invalidateQueries({ queryKey: ['zones'] });
    } catch (e) {
      toast.error(e.message);
    }
  };

  if (!connected) {
    return <div className="px-5 pb-5 flex items-center gap-2 text-sm text-muted-foreground"><AlertCircle className="w-4 h-4 text-yellow-400" />Provider muss zuerst mit Spotify verbunden werden.</div>;
  }

  return (
    <div className="px-5 pb-5 space-y-3 border-t border-border/30 pt-4">
      <div className="flex items-center justify-between"><p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Verfügbare Spotify Geräte</p><Button variant="outline" size="sm" className="gap-1.5 h-7 text-xs" onClick={handleLoadDevices} disabled={loading}><RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} /> Aktualisieren</Button></div>
      {devices.length === 0 ? (
        <div className="text-center py-4 border border-dashed border-border/30 rounded-xl"><p className="text-sm text-muted-foreground mb-2">Keine Geräte geladen. Für den StudioSoundSet Player öffne `/player-new` auf dem Zielgerät.</p><Button size="sm" variant="outline" onClick={handleLoadDevices} disabled={loading}><RefreshCw className="w-3.5 h-3.5 mr-1.5" /> Geräte laden</Button></div>
      ) : (
        <div className="space-y-2">{devices.map(device => { const DevIcon = DEVICE_ICONS[device.type] || Monitor; return <div key={device.id} className={`flex items-center gap-3 p-3 rounded-xl border transition-all ${device.isSelectedTarget ? 'border-primary/40 bg-primary/5' : 'border-border/30 bg-muted/10'}`}><DevIcon className="w-4 h-4 text-muted-foreground flex-shrink-0" /><div className="flex-1 min-w-0"><p className="text-sm font-semibold truncate">{device.name}</p><div className="flex items-center gap-2 mt-0.5 flex-wrap"><span className="text-xs text-muted-foreground">{device.type}</span>{device.isActive && <span className="text-xs text-green-400 font-semibold">● Aktiv</span>}{device.isVisible && !device.isActive && <span className="text-xs text-yellow-400">○ Sichtbar</span>}{!device.isVisible && <span className="text-xs text-muted-foreground">○ Offline</span>}{device.currentVolume !== undefined && <span className="text-xs text-muted-foreground">{device.currentVolume}%</span>}</div></div>{device.isSelectedTarget ? <span className="text-xs text-primary font-bold flex items-center gap-1"><Star className="w-3 h-3" /> Ziel</span> : <Button size="sm" variant="ghost" className="text-xs h-7 px-2" onClick={() => handleSetTarget(device)}>Als Ziel setzen</Button>}</div>; })}</div>
      )}
    </div>
  );
}
