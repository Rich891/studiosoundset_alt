import { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Copy, Trash2, Eye, EyeOff, Music2, AlertCircle, Wifi, WifiOff, QrCode, Wrench, CheckCircle2, PlugZap, MapPin } from 'lucide-react';
import { toast } from 'sonner';
import PlayerQRModal from '@/components/player/PlayerQRModal';
import { motion } from 'framer-motion';
import { isPlayerOnline } from '@/lib/studioSoundSetRuntime';
import {
  buildPlayerProviderPatch,
  getPlayerProviderAssignmentState,
  getPlayerProviderId,
  getProviderDisplayName,
  providerStatus,
} from '@/lib/playerAssignments';

const invoke = (fn, payload) => base44.functions.invoke(fn, payload);

const EMPTY_FORM = { name: '', providerId: '', zoneId: '', passwordHash: '' };
const EMPTY_EDIT = { player: null, providerId: '', zoneId: '' };

export default function ManagePlayerDevices() {
  const queryClient = useQueryClient();
  const [showDialog, setShowDialog] = useState(false);
  const [showPassword, setShowPassword] = useState({});
  const [qrModalOpen, setQrModalOpen] = useState(false);
  const [qrData, setQrData] = useState({ playerId: '', providerId: '', zoneId: '', email: '', password: '', deviceName: '' });
  const [formData, setFormData] = useState(EMPTY_FORM);
  const [editAssignment, setEditAssignment] = useState(EMPTY_EDIT);

  const { data: players = [], error: playerError } = useQuery({ queryKey: ['players'], queryFn: () => base44.entities.Player.list('-updated_date'), refetchInterval: 3000 });
  const { data: providers = [] } = useQuery({ queryKey: ['providers'], queryFn: () => base44.entities.Provider.list('-created_date') });
  const { data: zones = [] } = useQuery({ queryKey: ['zones'], queryFn: () => base44.entities.Zone.list() });

  const zonesById = useMemo(() => Object.fromEntries(zones.map((zone) => [zone.id, zone])), [zones]);
  const providersById = useMemo(() => Object.fromEntries(providers.map((provider) => [provider.id, provider])), [providers]);

  const createMutation = useMutation({
    mutationFn: async (data) => {
      const providerId = data.providerId;
      const response = await invoke('createPlayerUserNew', {
        ...data,
        providerId,
        apiCredentialSetId: providerId,
        spotifyAccountId: providerId,
      });
      if (!response.data?.success) throw new Error(response.data?.error || 'Player konnte nicht erstellt werden. Prüfe Base44 Function createPlayerUserNew.');

      const playerUser = response.data.playerUser;
      // Canonical assignment repair: the Player is the operational unit.
      // Keep providerId for current code and apiCredentialSetId/spotifyAccountId aliases for the new player-centric flow.
      await base44.entities.Player.update(playerUser.id, {
        ...buildPlayerProviderPatch(providerId),
        zoneId: data.zoneId || '',
      }).catch(() => {});

      return { ...playerUser, ...buildPlayerProviderPatch(providerId), zoneId: data.zoneId || '' };
    },
    onSuccess: (player) => {
      queryClient.invalidateQueries({ queryKey: ['players'] });
      toast.success('Player erstellt. API-Verbindung wurde direkt am Player gespeichert.');
      setQrData({
        playerId: player.id,
        providerId: getPlayerProviderId(player, zonesById[player.zoneId]) || formData.providerId,
        zoneId: player.zoneId || formData.zoneId || '',
        email: player.email,
        password: formData.passwordHash,
        deviceName: player.name,
      });
      setQrModalOpen(true);
      setShowDialog(false);
      setFormData(EMPTY_FORM);
    },
    onError: (err) => toast.error(err.message),
  });

  const updateAssignmentMutation = useMutation({
    mutationFn: async ({ player, providerId, zoneId }) => {
      if (!player?.id) throw new Error('Player fehlt.');
      const patch = {
        ...buildPlayerProviderPatch(providerId),
        zoneId: zoneId || '',
        lastError: '',
      };
      return base44.entities.Player.update(player.id, patch);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['players'] });
      toast.success('Player-Zuweisung gespeichert.');
      setEditAssignment(EMPTY_EDIT);
    },
    onError: (err) => toast.error(`Zuweisung konnte nicht gespeichert werden: ${err.message}`),
  });

  const repairMutation = useMutation({
    mutationFn: async (player) => {
      const zone = zonesById[player.zoneId];
      const assignment = getPlayerProviderAssignmentState(player, zone);
      if (!assignment.providerId || assignment.source !== 'zone_legacy') throw new Error('Keine eindeutige Legacy-Zonen-Zuweisung gefunden.');
      return base44.entities.Player.update(player.id, buildPlayerProviderPatch(assignment.providerId));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['players'] });
      toast.success('Legacy-Zuweisung wurde auf den Player verschoben.');
    },
    onError: (err) => toast.error(err.message),
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.Player.delete(id),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['players'] }); toast.success('Player gelöscht.'); },
    onError: (err) => toast.error(`Player konnte nicht gelöscht werden: ${err.message}`),
  });

  const handleCreate = async () => {
    if (!formData.name.trim() || !formData.providerId || !formData.passwordHash.trim()) return toast.error('Name, API-Verbindung und Passwort sind erforderlich.');
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
    const zone = zonesById[player.zoneId];
    const providerId = getPlayerProviderId(player, zone);
    setQrData({
      playerId: player.id,
      providerId,
      zoneId: player.zoneId || '',
      email: player.email,
      password: player.passwordHash,
      deviceName: player.name,
    });
    setQrModalOpen(true);
  };

  const openEditAssignment = (player) => {
    const zone = zonesById[player.zoneId];
    const providerId = getPlayerProviderId(player, zone);
    setEditAssignment({ player, providerId: providerId || '', zoneId: player.zoneId || 'none' });
  };

  const getZoneName = (id) => zones.find(z => z.id === id)?.name || '—';
  const connectedProviders = providers.filter(p => providerStatus(p) === 'connected');
  const playersNeedingRepair = players.filter((player) => getPlayerProviderAssignmentState(player, zonesById[player.zoneId]).needsRepair);

  return (
    <div className="p-4 lg:p-8 space-y-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-black">Player</h1>
          <p className="text-sm text-muted-foreground mt-1">Der Player ist die operative Einheit: Zone, Player-Login, API-Verbindung, Spotify-Konto, Commands und Playlists hängen am Player.</p>
        </div>
        <Button onClick={() => setShowDialog(true)} className="gap-2 bg-primary hover:bg-primary/90"><Plus className="w-4 h-4" />Neuer Player</Button>
      </div>

      <div className="bento-panel p-5 border-cyan-500/20 bg-cyan-500/5">
        <div className="flex gap-3">
          <PlugZap className="w-5 h-5 text-cyan-300 mt-0.5 flex-shrink-0" />
          <div className="space-y-1 text-sm">
            <p className="font-black text-cyan-200">Neuer Datenfluss</p>
            <p className="text-muted-foreground">Zonen sind nur Räume mit Farbe und Lautstärke-Defaults. Die API-Verbindung gehört direkt zum Player. Falls alte Daten noch eine Provider-Zuweisung an der Zone enthalten, kannst du sie hier gezielt auf den Player verschieben.</p>
          </div>
        </div>
      </div>

      {playerError && <div className="bento-panel border-red-500/20 bg-red-500/5 p-4 text-sm text-red-300">Player konnten nicht geladen werden: {playerError.message}</div>}
      {connectedProviders.length === 0 && <div className="bento-panel border-yellow-500/20 bg-yellow-500/5 p-5 flex items-center gap-3"><AlertCircle className="w-5 h-5 text-yellow-400" /><p className="text-sm text-yellow-300">Keine verbundene API-Verbindung. Erstelle und verbinde zuerst einen Spotify Provider unter Spotify Provider.</p></div>}
      {playersNeedingRepair.length > 0 && <div className="bento-panel border-yellow-500/20 bg-yellow-500/5 p-5 flex items-start gap-3"><Wrench className="w-5 h-5 text-yellow-400 mt-0.5" /><div><p className="font-bold text-yellow-200">{playersNeedingRepair.length} Player brauchen eine eindeutige API-Zuweisung</p><p className="text-sm text-yellow-300/80">Öffne die jeweilige Karte und wähle „Zuweisung bearbeiten“ oder nutze „Legacy reparieren“, wenn die API noch an der Zone hängt.</p></div></div>}

      <div className="grid gap-4">
        {players.length === 0 ? (
          <motion.div className="bento-panel border-dashed border-primary/20 p-12 text-center"><Music2 className="w-12 h-12 text-muted-foreground/20 mx-auto mb-4" /><h3 className="text-lg font-bold mb-2">Keine Player vorhanden</h3><p className="text-muted-foreground mb-6">Erstelle den ersten Player und öffne den QR-Code auf dem Player-Gerät.</p><Button onClick={() => setShowDialog(true)} className="bg-primary">Neuer Player</Button></motion.div>
        ) : players.map((player, idx) => {
          const zone = zonesById[player.zoneId];
          const assignment = getPlayerProviderAssignmentState(player, zone);
          const provider = providersById[assignment.providerId];
          const online = isPlayerOnline(player);
          const isConnected = providerStatus(provider) === 'connected';
          return (
            <motion.div key={player.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: idx * 0.04 }}>
              <div className="bento-panel p-5 space-y-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="text-xl font-black">{player.name}</h3>
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      {online ? <Wifi className="w-3.5 h-3.5 text-green-400" /> : <WifiOff className="w-3.5 h-3.5 text-yellow-400" />}
                      <span className={`text-xs font-semibold ${online ? 'text-green-400' : 'text-yellow-400'}`}>{online ? 'Online' : 'Offline'}</span>
                      {player.sdkReady && <span className="text-xs text-cyan-400">SDK Ready</span>}
                      {assignment.source === 'player' && <span className="text-xs text-green-400 flex items-center gap-1"><CheckCircle2 className="w-3 h-3" /> API am Player</span>}
                      {assignment.source === 'zone_legacy' && <span className="text-xs text-yellow-300">Legacy-Zone</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button variant="ghost" size="sm" onClick={() => openQr(player)} className="h-8 w-8 p-0" title="QR anzeigen"><QrCode className="w-4 h-4" /></Button>
                    <Button variant="ghost" size="sm" onClick={() => deleteMutation.mutate(player.id)} className="text-red-400 hover:text-red-300 h-8 w-8 p-0" disabled={deleteMutation.isPending}><Trash2 className="w-4 h-4" /></Button>
                  </div>
                </div>

                <div className="grid md:grid-cols-4 gap-3 text-sm">
                  <div className={`rounded-lg p-3 border ${assignment.providerId ? 'bg-muted/20 border-border/30' : 'bg-red-500/5 border-red-500/20'}`}>
                    <p className="text-xs text-muted-foreground font-semibold mb-1">API-Verbindung</p>
                    <p className="font-bold text-sm">{provider ? getProviderDisplayName(provider) : assignment.providerId ? 'Provider nicht gefunden' : 'Nicht zugewiesen'}</p>
                    <p className={`text-xs mt-1 ${isConnected ? 'text-green-400' : assignment.providerId ? 'text-yellow-400' : 'text-red-300'}`}>{provider ? providerStatus(provider) : assignment.label}</p>
                  </div>
                  <div className="bg-muted/20 rounded-lg p-3 border border-border/30"><p className="text-xs text-muted-foreground font-semibold mb-1">Zone</p><p className="font-bold text-sm">{getZoneName(player.zoneId)}</p><p className="text-xs text-muted-foreground mt-1">Raum / Defaults</p></div>
                  <div className="bg-muted/20 rounded-lg p-3 border border-border/30"><p className="text-xs text-muted-foreground font-semibold mb-1">Device ID</p><p className="font-mono text-xs break-all">{player.spotifyDeviceId || '—'}</p></div>
                  <div className="bg-muted/20 rounded-lg p-3 border border-border/30"><p className="text-xs text-muted-foreground font-semibold mb-1">Last Command</p><p className="text-xs break-all">{player.lastCommand || '—'} {player.lastCommandStatus ? `· ${player.lastCommandStatus}` : ''}</p></div>
                </div>

                <div className="rounded-lg border border-border/40 bg-background/40 p-3 text-xs text-muted-foreground">
                  <p className="font-semibold text-foreground mb-1">Setup-Status</p>
                  <p>{assignment.message}</p>
                  {assignment.source === 'zone_legacy' && <p className="text-yellow-300 mt-1">Empfohlen: Legacy-Zuweisung auf den Player verschieben.</p>}
                </div>

                <div className="flex flex-wrap gap-2">
                  <Button variant="outline" size="sm" onClick={() => openEditAssignment(player)} className="gap-2"><Wrench className="w-4 h-4" />Zuweisung bearbeiten</Button>
                  {assignment.source === 'zone_legacy' && <Button variant="outline" size="sm" onClick={() => repairMutation.mutate(player)} disabled={repairMutation.isPending} className="gap-2 text-yellow-300 border-yellow-500/30"><Wrench className="w-4 h-4" />Legacy reparieren</Button>}
                  <Button variant="outline" size="sm" onClick={() => openQr(player)} className="gap-2"><QrCode className="w-4 h-4" />Player öffnen / QR</Button>
                </div>

                <div className="bg-background/50 rounded-lg p-3 space-y-2 border border-border/30">
                  <p className="text-xs text-muted-foreground font-semibold">Player Login</p>
                  <div className="flex items-center gap-2 font-mono text-xs"><code className="flex-1 bg-background px-2 py-1.5 rounded border border-border/30 truncate">{player.email}</code><Button variant="ghost" size="sm" onClick={() => copyToClipboard(player.email)} className="h-7 w-7 p-0"><Copy className="w-3 h-3" /></Button></div>
                  <div className="flex items-center gap-2 font-mono text-xs"><code className="flex-1 bg-background px-2 py-1.5 rounded border border-border/30 truncate">{showPassword[player.id] ? player.passwordHash : '••••••••'}</code><Button variant="ghost" size="sm" onClick={() => setShowPassword(prev => ({ ...prev, [player.id]: !prev[player.id] }))} className="h-7 w-7 p-0">{showPassword[player.id] ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}</Button><Button variant="ghost" size="sm" onClick={() => copyToClipboard(player.passwordHash)} className="h-7 w-7 p-0"><Copy className="w-3 h-3" /></Button></div>
                </div>
                {player.lastError && <div className="rounded-lg border border-red-500/20 bg-red-500/5 p-3 text-xs text-red-300">{player.lastError}</div>}
              </div>
            </motion.div>
          );
        })}
      </div>

      <PlayerQRModal open={qrModalOpen} onOpenChange={setQrModalOpen} playerId={qrData.playerId} providerId={qrData.providerId} zoneId={qrData.zoneId} email={qrData.email} password={qrData.password} deviceName={qrData.deviceName} />

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-md"><DialogHeader><DialogTitle>Neuer Player</DialogTitle></DialogHeader><div className="space-y-4"><div><label className="text-xs font-semibold text-muted-foreground mb-2 block">Player-Name</label><Input placeholder="z.B. Gym Player" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} /></div><div><label className="text-xs font-semibold text-muted-foreground mb-2 block">API-Verbindung</label><Select value={formData.providerId} onValueChange={(value) => setFormData({ ...formData, providerId: value })}><SelectTrigger><SelectValue placeholder="API-Verbindung wählen" /></SelectTrigger><SelectContent>{providers.length === 0 ? <SelectItem disabled value="none">Keine API-Verbindung konfiguriert</SelectItem> : providers.map((acc) => <SelectItem key={acc.id} value={acc.id}>{getProviderDisplayName(acc)} {providerStatus(acc) === 'connected' ? '✓' : '(nicht verbunden)'}</SelectItem>)}</SelectContent></Select><p className="text-[11px] text-muted-foreground mt-1">Diese Zuweisung wird direkt am Player gespeichert.</p></div><div><label className="text-xs font-semibold text-muted-foreground mb-2 block">Zone / Raum optional</label><Select value={formData.zoneId || 'none'} onValueChange={(value) => setFormData({ ...formData, zoneId: value })}><SelectTrigger><SelectValue placeholder="Zone wählen" /></SelectTrigger><SelectContent><SelectItem value="none">Keine</SelectItem>{zones.map((zone) => <SelectItem key={zone.id} value={zone.id}>{zone.name}</SelectItem>)}</SelectContent></Select><p className="text-[11px] text-muted-foreground mt-1">Zonen sind nur Räume, keine API-Träger.</p></div><div><label className="text-xs font-semibold text-muted-foreground mb-2 block">Player-Passwort</label><div className="flex gap-2"><Input type="text" placeholder="z.B. ABC12345" value={formData.passwordHash} onChange={(e) => setFormData({ ...formData, passwordHash: e.target.value })} /><Button type="button" variant="outline" onClick={generatePassword} className="whitespace-nowrap">Generieren</Button></div></div><div className="flex gap-2 pt-4"><Button variant="outline" onClick={() => setShowDialog(false)} className="flex-1">Abbrechen</Button><Button onClick={handleCreate} disabled={createMutation.isPending} className="flex-1">{createMutation.isPending ? 'Erstelle...' : 'Erstellen'}</Button></div></div></DialogContent>
      </Dialog>

      <Dialog open={!!editAssignment.player} onOpenChange={(open) => !open && setEditAssignment(EMPTY_EDIT)}>
        <DialogContent className="max-w-md"><DialogHeader><DialogTitle>Player-Zuweisung bearbeiten</DialogTitle></DialogHeader><div className="space-y-4"><div className="rounded-lg border border-border/40 bg-muted/10 p-3 text-sm"><p className="font-bold">{editAssignment.player?.name}</p><p className="text-xs text-muted-foreground">API-Verbindung und Zone werden direkt am Player gespeichert.</p></div><div><label className="text-xs font-semibold text-muted-foreground mb-2 block">API-Verbindung</label><Select value={editAssignment.providerId || 'none'} onValueChange={(value) => setEditAssignment(prev => ({ ...prev, providerId: value === 'none' ? '' : value }))}><SelectTrigger><SelectValue placeholder="API-Verbindung wählen" /></SelectTrigger><SelectContent><SelectItem value="none">Keine</SelectItem>{providers.map((acc) => <SelectItem key={acc.id} value={acc.id}>{getProviderDisplayName(acc)} {providerStatus(acc) === 'connected' ? '✓' : '(nicht verbunden)'}</SelectItem>)}</SelectContent></Select></div><div><label className="text-xs font-semibold text-muted-foreground mb-2 block">Zone / Raum</label><Select value={editAssignment.zoneId || 'none'} onValueChange={(value) => setEditAssignment(prev => ({ ...prev, zoneId: value }))}><SelectTrigger><SelectValue placeholder="Zone wählen" /></SelectTrigger><SelectContent><SelectItem value="none">Keine</SelectItem>{zones.map((zone) => <SelectItem key={zone.id} value={zone.id}>{zone.name}</SelectItem>)}</SelectContent></Select></div><div className="flex gap-2 pt-4"><Button variant="outline" onClick={() => setEditAssignment(EMPTY_EDIT)} className="flex-1">Abbrechen</Button><Button onClick={() => updateAssignmentMutation.mutate({ player: editAssignment.player, providerId: editAssignment.providerId, zoneId: editAssignment.zoneId === 'none' ? '' : editAssignment.zoneId })} disabled={updateAssignmentMutation.isPending} className="flex-1">Speichern</Button></div></div></DialogContent>
      </Dialog>
    </div>
  );
}
