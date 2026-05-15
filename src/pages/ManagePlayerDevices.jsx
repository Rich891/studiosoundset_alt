import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Copy, Trash2, Eye, EyeOff, Music2, AlertCircle, Wifi, WifiOff, QrCode } from 'lucide-react';
import { toast } from 'sonner';
import PlayerQRModal from '@/components/player/PlayerQRModal';
import { motion } from 'framer-motion';
import { isPlayerOnline } from '@/lib/studioSoundSetRuntime';

const invoke = (fn, payload) => base44.functions.invoke(fn, payload);
const providerStatus = (provider) => provider?.status || provider?.authStatus || 'disconnected';

export default function ManagePlayerDevices() {
  const queryClient = useQueryClient();
  const [showDialog, setShowDialog] = useState(false);
  const [showPassword, setShowPassword] = useState({});
  const [qrModalOpen, setQrModalOpen] = useState(false);
  const [qrData, setQrData] = useState({ playerId: '', providerId: '', zoneId: '', email: '', password: '', deviceName: '' });
  const [formData, setFormData] = useState({ name: '', providerId: '', zoneId: '', passwordHash: '' });

  const { data: players = [], error: playerError } = useQuery({ queryKey: ['players'], queryFn: () => base44.entities.Player.list('-updated_date'), refetchInterval: 3000 });
  const { data: providers = [] } = useQuery({ queryKey: ['providers'], queryFn: () => base44.entities.Provider.list('-created_date') });
  const { data: zones = [] } = useQuery({ queryKey: ['zones'], queryFn: () => base44.entities.Zone.list() });

  const createMutation = useMutation({
    mutationFn: async (data) => {
      const response = await invoke('createPlayerUserNew', data);
      if (!response.data?.success) throw new Error(response.data?.error || 'Player konnte nicht erstellt werden. Prüfe Base44 Function createPlayerUserNew.');
      return response.data.playerUser;
    },
    onSuccess: (player) => {
      queryClient.invalidateQueries({ queryKey: ['players'] });
      toast.success('Player erstellt. Öffne den QR-Code auf dem Player-Gerät.');
      setQrData({
        playerId: player.id,
        providerId: player.providerId || formData.providerId,
        zoneId: player.zoneId || formData.zoneId || '',
        email: player.email,
        password: formData.passwordHash,
        deviceName: player.name,
      });
      setQrModalOpen(true);
      setShowDialog(false);
      setFormData({ name: '', providerId: '', zoneId: '', passwordHash: '' });
    },
    onError: (err) => toast.error(err.message),
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.Player.delete(id),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['players'] }); toast.success('Player gelöscht.'); },
    onError: (err) => toast.error(`Player konnte nicht gelöscht werden: ${err.message}`),
  });

  const handleCreate = async () => {
    if (!formData.name.trim() || !formData.providerId || !formData.passwordHash.trim()) return toast.error('Name, Provider und Passwort sind erforderlich.');
    createMutation.mutate({ ...formData, zoneId: formData.zoneId === 'none' ? '' : formData.zoneId });
  };

  const copyToClipboard = (text) => { navigator.clipboard.writeText(text || ''); toast.success('Kopiert.'); };
  const generatePassword = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let pwd = '';
    for (let i = 0; i < 10; i++) pwd += chars.charAt(Math.floor(Math.random() * chars.length));
    setFormData({ ...formData, passwordHash: pwd });
  };

  const openQr = (player) => {
    setQrData({
      playerId: player.id,
      providerId: player.providerId || '',
      zoneId: player.zoneId || '',
      email: player.email,
      password: player.passwordHash,
      deviceName: player.name,
    });
    setQrModalOpen(true);
  };

  const getProviderName = (id) => providers.find(a => a.id === id)?.name || providers.find(a => a.id === id)?.displayName || '—';
  const getZoneName = (id) => zones.find(z => z.id === id)?.name || '—';
  const connectedProviders = providers.filter(p => providerStatus(p) === 'connected');

  return (
    <div className="p-4 lg:p-8 space-y-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div><h1 className="text-2xl font-black">Player verwalten</h1><p className="text-sm text-muted-foreground mt-1">Erstelle Player Logins, QR-Codes und überwache Heartbeat/SDK Status.</p></div>
        <Button onClick={() => setShowDialog(true)} className="gap-2 bg-primary hover:bg-primary/90"><Plus className="w-4 h-4" />Neuer Player</Button>
      </div>

      {playerError && <div className="bento-panel border-red-500/20 bg-red-500/5 p-4 text-sm text-red-300">Player konnten nicht geladen werden: {playerError.message}</div>}
      {connectedProviders.length === 0 && <div className="bento-panel border-yellow-500/20 bg-yellow-500/5 p-5 flex items-center gap-3"><AlertCircle className="w-5 h-5 text-yellow-400" /><p className="text-sm text-yellow-300">Kein verbundener Spotify Provider. Erstelle und verbinde zuerst einen Provider unter Spotify Provider.</p></div>}

      <div className="grid gap-4">
        {players.length === 0 ? (
          <motion.div className="bento-panel border-dashed border-primary/20 p-12 text-center"><Music2 className="w-12 h-12 text-muted-foreground/20 mx-auto mb-4" /><h3 className="text-lg font-bold mb-2">Keine Player vorhanden</h3><p className="text-muted-foreground mb-6">Erstelle den ersten Player und öffne den QR-Code auf dem Player-Gerät.</p><Button onClick={() => setShowDialog(true)} className="bg-primary">Neuer Player</Button></motion.div>
        ) : players.map((player, idx) => {
          const online = isPlayerOnline(player);
          const account = providers.find(a => a.id === player.providerId);
          return (
            <motion.div key={player.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: idx * 0.04 }}>
              <div className="bento-panel p-5 space-y-4">
                <div className="flex items-start justify-between gap-3"><div><h3 className="text-xl font-black">{player.name}</h3><div className="flex items-center gap-2 mt-1">{online ? <Wifi className="w-3.5 h-3.5 text-green-400" /> : <WifiOff className="w-3.5 h-3.5 text-yellow-400" />}<span className={`text-xs font-semibold ${online ? 'text-green-400' : 'text-yellow-400'}`}>{online ? 'Online' : 'Offline'}</span>{player.sdkReady && <span className="text-xs text-cyan-400">SDK Ready</span>}</div></div><div className="flex items-center gap-1"><Button variant="ghost" size="sm" onClick={() => openQr(player)} className="h-8 w-8 p-0" title="QR anzeigen"><QrCode className="w-4 h-4" /></Button><Button variant="ghost" size="sm" onClick={() => deleteMutation.mutate(player.id)} className="text-red-400 hover:text-red-300 h-8 w-8 p-0" disabled={deleteMutation.isPending}><Trash2 className="w-4 h-4" /></Button></div></div>
                <div className="grid md:grid-cols-4 gap-3 text-sm"><div className="bg-muted/20 rounded-lg p-3"><p className="text-xs text-muted-foreground font-semibold mb-1">Spotify Provider</p><p className="font-bold text-sm">{getProviderName(player.providerId)}</p>{account && <p className={`text-xs mt-1 ${providerStatus(account) === 'connected' ? 'text-green-400' : 'text-yellow-400'}`}>{providerStatus(account)}</p>}</div><div className="bg-muted/20 rounded-lg p-3"><p className="text-xs text-muted-foreground font-semibold mb-1">Zone</p><p className="font-bold text-sm">{getZoneName(player.zoneId)}</p></div><div className="bg-muted/20 rounded-lg p-3"><p className="text-xs text-muted-foreground font-semibold mb-1">Device ID</p><p className="font-mono text-xs break-all">{player.spotifyDeviceId || '—'}</p></div><div className="bg-muted/20 rounded-lg p-3"><p className="text-xs text-muted-foreground font-semibold mb-1">Last Command</p><p className="text-xs break-all">{player.lastCommand || '—'} {player.lastCommandStatus ? `· ${player.lastCommandStatus}` : ''}</p></div></div>
                <div className="bg-background/50 rounded-lg p-3 space-y-2 border border-border/30"><p className="text-xs text-muted-foreground font-semibold">Login-Daten</p><div className="flex items-center gap-2 font-mono text-xs"><code className="flex-1 bg-background px-2 py-1.5 rounded border border-border/30 truncate">{player.email}</code><Button variant="ghost" size="sm" onClick={() => copyToClipboard(player.email)} className="h-7 w-7 p-0"><Copy className="w-3 h-3" /></Button></div><div className="flex items-center gap-2 font-mono text-xs"><code className="flex-1 bg-background px-2 py-1.5 rounded border border-border/30 truncate">{showPassword[player.id] ? player.passwordHash : '••••••••'}</code><Button variant="ghost" size="sm" onClick={() => setShowPassword(prev => ({ ...prev, [player.id]: !prev[player.id] }))} className="h-7 w-7 p-0">{showPassword[player.id] ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}</Button><Button variant="ghost" size="sm" onClick={() => copyToClipboard(player.passwordHash)} className="h-7 w-7 p-0"><Copy className="w-3 h-3" /></Button></div></div>
                {player.lastError && <div className="rounded-lg border border-red-500/20 bg-red-500/5 p-3 text-xs text-red-300">{player.lastError}</div>}
                <div className="rounded-lg border border-border/40 bg-background/40 p-3 text-xs text-muted-foreground">Wenn Player-Login manuell wegen Base44 Auth blockiert wird, nutze den QR-Link. Er enthält die Player-ID und kann die Player-Session lokal herstellen.</div>
              </div>
            </motion.div>
          );
        })}
      </div>

      <PlayerQRModal open={qrModalOpen} onOpenChange={setQrModalOpen} playerId={qrData.playerId} providerId={qrData.providerId} zoneId={qrData.zoneId} email={qrData.email} password={qrData.password} deviceName={qrData.deviceName} />

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-md"><DialogHeader><DialogTitle>Neuer Player</DialogTitle></DialogHeader><div className="space-y-4"><div><label className="text-xs font-semibold text-muted-foreground mb-2 block">Gerätename</label><Input placeholder="z.B. Gym Player" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} /></div><div><label className="text-xs font-semibold text-muted-foreground mb-2 block">Spotify Provider</label><Select value={formData.providerId} onValueChange={(value) => setFormData({ ...formData, providerId: value })}><SelectTrigger><SelectValue placeholder="Provider wählen" /></SelectTrigger><SelectContent>{providers.length === 0 ? <SelectItem disabled value="none">Keine Provider konfiguriert</SelectItem> : providers.map((acc) => <SelectItem key={acc.id} value={acc.id}>{acc.name || acc.displayName} {providerStatus(acc) === 'connected' ? '✓' : '(nicht verbunden)'}</SelectItem>)}</SelectContent></Select></div><div><label className="text-xs font-semibold text-muted-foreground mb-2 block">Zone optional</label><Select value={formData.zoneId || 'none'} onValueChange={(value) => setFormData({ ...formData, zoneId: value })}><SelectTrigger><SelectValue placeholder="Zone wählen" /></SelectTrigger><SelectContent><SelectItem value="none">Keine</SelectItem>{zones.map((zone) => <SelectItem key={zone.id} value={zone.id}>{zone.name}</SelectItem>)}</SelectContent></Select></div><div><label className="text-xs font-semibold text-muted-foreground mb-2 block">Passwort</label><div className="flex gap-2"><Input type="text" placeholder="z.B. ABC12345" value={formData.passwordHash} onChange={(e) => setFormData({ ...formData, passwordHash: e.target.value })} /><Button type="button" variant="outline" onClick={generatePassword} className="whitespace-nowrap">Generieren</Button></div></div><div className="flex gap-2 pt-4"><Button variant="outline" onClick={() => setShowDialog(false)} className="flex-1">Abbrechen</Button><Button onClick={handleCreate} disabled={createMutation.isPending} className="flex-1">{createMutation.isPending ? 'Erstelle...' : 'Erstellen'}</Button></div></div></DialogContent>
      </Dialog>
    </div>
  );
}
