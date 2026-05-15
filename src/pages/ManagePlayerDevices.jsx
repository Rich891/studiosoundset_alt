import { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Copy, Trash2, Eye, EyeOff, Music2, AlertCircle, Wifi, WifiOff, QrCode, Wrench, CheckCircle2, PlugZap } from 'lucide-react';
import { toast } from 'sonner';
import PlayerSetupModal from '@/components/player/PlayerSetupModal';
import { motion } from 'framer-motion';
import { isPlayerOnline } from '@/lib/studioSoundSetRuntime';
import { buildPlayerProviderPatch, getPlayerProviderId, getProviderDisplayName, providerStatus } from '@/lib/playerAssignments';
import { listPlayerConfigs, mergePlayerWithConfig, savePlayerConfig } from '@/lib/playerConfigStore';

const invoke = (fn, payload) => base44.functions.invoke(fn, payload);

const EMPTY_FORM = { name: '', providerId: '', zoneId: '', passwordHash: '' };
const EMPTY_EDIT = { player: null, providerId: '', zoneId: '' };
const EMPTY_ZONE = { name: '', color: '#7c3aed', defaultVolume: 50, minVolume: 10, maxVolume: 90 };

function randomToken(prefix = 'session') {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return `${prefix}_${Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('')}`;
}

function ensureRuntimeTokens(player = {}) {
  return {
    sessionToken: player.sessionToken || randomToken('session'),
    setupToken: player.setupToken || randomToken('setup'),
  };
}

export default function ManagePlayerDevices() {
  const queryClient = useQueryClient();
  const [showDialog, setShowDialog] = useState(false);
  const [showZoneDialog, setShowZoneDialog] = useState(false);
  const [zoneTarget, setZoneTarget] = useState('create');
  const [zoneForm, setZoneForm] = useState(EMPTY_ZONE);
  const [showPassword, setShowPassword] = useState({});
  const [setupModalOpen, setSetupModalOpen] = useState(false);
  const [setupData, setSetupData] = useState({ playerId: '', providerId: '', providerClientId: '', zoneId: '', sessionToken: '', deviceName: '' });
  const [formData, setFormData] = useState(EMPTY_FORM);
  const [editAssignment, setEditAssignment] = useState(EMPTY_EDIT);

  const { data: rawPlayers = [], error: playerError } = useQuery({ queryKey: ['players'], queryFn: () => base44.entities.Player.list('-updated_date'), refetchInterval: 3000 });
  const { data: providers = [] } = useQuery({ queryKey: ['providers'], queryFn: () => base44.entities.Provider.list('-created_date') });
  const { data: zones = [] } = useQuery({ queryKey: ['zones'], queryFn: () => base44.entities.Zone.list() });
  const { data: configByPlayer = {} } = useQuery({ queryKey: ['player-configs'], queryFn: listPlayerConfigs, refetchInterval: 3000 });

  const players = useMemo(() => rawPlayers.map((p) => mergePlayerWithConfig(p, configByPlayer[p.id])), [rawPlayers, configByPlayer]);
  const zonesById = useMemo(() => Object.fromEntries(zones.map((zone) => [zone.id, zone])), [zones]);
  const providersById = useMemo(() => Object.fromEntries(providers.map((provider) => [provider.id, provider])), [providers]);

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ['players'] });
    queryClient.invalidateQueries({ queryKey: ['player-configs'] });
    queryClient.invalidateQueries({ queryKey: ['zones'] });
  };

  const persistPlayerAssignment = async (player, providerId, zoneId) => {
    if (!player?.id) throw new Error('Player fehlt.');
    if (!providerId) throw new Error('API-Verbindung fehlt. Wähle einen verbundenen Provider.');
    const provider = providersById[providerId];
    const zone = zonesById[zoneId];
    const tokens = ensureRuntimeTokens(player);
    const patch = {
      ...buildPlayerProviderPatch(providerId),
      spotifyClientId: provider?.clientId || player?.spotifyClientId || '',
      zoneId: zoneId || '',
      sessionToken: tokens.sessionToken,
      setupToken: tokens.setupToken,
      isActive: true,
      role: 'player',
      lastError: '',
      updatedAt: new Date().toISOString(),
    };

    await savePlayerConfig(player, {
      providerId,
      providerName: provider?.name || provider?.displayName || '',
      spotifyClientId: provider?.clientId || player?.spotifyClientId || '',
      zoneId: zoneId || '',
      zoneName: zone?.name || '',
      sessionToken: tokens.sessionToken,
      setupToken: tokens.setupToken,
    });

    const updated = await base44.entities.Player.update(player.id, patch);
    const verified = { ...player, ...updated, ...patch };
    if (!verified.sessionToken && !verified.setupToken) {
      throw new Error('Runtime Session konnte nicht am Player gespeichert werden. Kein Player-Link wird erzeugt.');
    }
    return verified;
  };

  const createMutation = useMutation({
    mutationFn: async (data) => {
      const providerId = data.providerId;
      const provider = providersById[providerId];
      const response = await invoke('createPlayerUserNew', {
        ...data,
        providerId,
        apiCredentialSetId: providerId,
        spotifyAccountId: providerId,
        spotifyClientId: provider?.clientId || '',
      });
      if (!response.data?.success) throw new Error(response.data?.error || 'Player konnte nicht erstellt werden.');
      const player = response.data.playerUser;
      return persistPlayerAssignment({ ...player, spotifyClientId: provider?.clientId || '' }, providerId, data.zoneId || '');
    },
    onSuccess: (player) => {
      refresh();
      toast.success('Player erstellt, API-Zuweisung und Runtime Session gespeichert.');
      openSetup(player);
      setShowDialog(false);
      setFormData(EMPTY_FORM);
    },
    onError: (err) => toast.error(err.message),
  });

  const updateAssignmentMutation = useMutation({
    mutationFn: async ({ player, providerId, zoneId }) => {
      return persistPlayerAssignment(player, providerId, zoneId === 'none' ? '' : zoneId);
    },
    onSuccess: (player) => {
      refresh();
      toast.success('Player-Zuweisung und Runtime Session gespeichert. Bitte neuen Player-Link öffnen.');
      setEditAssignment(EMPTY_EDIT);
      openSetup(player);
    },
    onError: (err) => toast.error(`Zuweisung konnte nicht gespeichert werden: ${err.message}`),
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.Player.delete(id),
    onSuccess: () => { refresh(); toast.success('Player gelöscht.'); },
    onError: (err) => toast.error(`Player konnte nicht gelöscht werden: ${err.message}`),
  });

  const createZoneMutation = useMutation({
    mutationFn: (data) => base44.entities.Zone.create({ ...data, providerId: '', apiCredentialSetId: '', spotifyAccountId: '', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }),
    onSuccess: (zone) => {
      queryClient.invalidateQueries({ queryKey: ['zones'] });
      toast.success('Zone erstellt.');
      if (zoneTarget === 'edit') setEditAssignment((prev) => ({ ...prev, zoneId: zone.id }));
      else setFormData((prev) => ({ ...prev, zoneId: zone.id }));
      setZoneForm(EMPTY_ZONE);
      setShowZoneDialog(false);
    },
    onError: (err) => toast.error(`Zone konnte nicht erstellt werden: ${err.message}`),
  });

  const handleCreate = async () => {
    if (!formData.name.trim() || !formData.providerId) return toast.error('Name und API-Verbindung sind erforderlich.');
    createMutation.mutate({ ...formData, zoneId: formData.zoneId === 'none' ? '' : formData.zoneId, passwordHash: formData.passwordHash || 'player' });
  };

  const openZoneDialog = (target) => {
    setZoneTarget(target);
    setZoneForm(EMPTY_ZONE);
    setShowZoneDialog(true);
  };

  const copyToClipboard = (text) => { navigator.clipboard.writeText(text || ''); toast.success('Kopiert.'); };
  const generatePassword = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let pwd = '';
    for (let i = 0; i < 10; i++) pwd += chars.charAt(Math.floor(Math.random() * chars.length));
    setFormData({ ...formData, passwordHash: pwd });
  };

  const openSetup = async (player) => {
    let merged = mergePlayerWithConfig(player, configByPlayer[player.id]);
    const providerId = getPlayerProviderId(merged);
    if (!providerId) {
      toast.error('Dieser Player hat keine API-Verbindung. Zuweisung bearbeiten.');
      return;
    }
    if (!merged.sessionToken || !merged.setupToken) {
      try {
        merged = await persistPlayerAssignment(merged, providerId, merged.zoneId || '');
        refresh();
      } catch (e) {
        toast.error(`Runtime Session konnte nicht erzeugt werden: ${e.message}`);
        return;
      }
    }
    const provider = providersById[providerId];
    setSetupData({ playerId: merged.id, providerId, providerClientId: provider?.clientId || merged.spotifyClientId || '', zoneId: merged.zoneId || '', sessionToken: merged.sessionToken || merged.setupToken || '', deviceName: merged.name });
    setSetupModalOpen(true);
  };

  const openEditAssignment = (player) => {
    const merged = mergePlayerWithConfig(player, configByPlayer[player.id]);
    const providerId = getPlayerProviderId(merged);
    setEditAssignment({ player: merged, providerId: providerId || '', zoneId: merged.zoneId || 'none' });
  };

  const getZoneName = (player) => player.zoneName || zonesById[player.zoneId]?.name || '—';
  const connectedProviders = providers.filter(p => providerStatus(p) === 'connected');
  const playersMissingApi = players.filter((player) => !getPlayerProviderId(player));

  return (
    <div className="p-4 lg:p-8 space-y-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-black">Players</h1>
          <p className="text-sm text-muted-foreground mt-1">Provider/API gehört direkt an den Player. Zonen sind nur optionale Räume und Default-Werte.</p>
        </div>
        <Button onClick={() => setShowDialog(true)} className="gap-2 bg-primary hover:bg-primary/90"><Plus className="w-4 h-4" />Neuer Player</Button>
      </div>

      <div className="bento-panel p-5 border-cyan-500/20 bg-cyan-500/5">
        <div className="flex gap-3">
          <PlugZap className="w-5 h-5 text-cyan-300 mt-0.5 flex-shrink-0" />
          <div className="space-y-1 text-sm">
            <p className="font-black text-cyan-200">Optimierter Flow</p>
            <p className="text-muted-foreground">Provider verbinden → Player erstellen/Provider zuweisen → Zone optional hier erstellen/setzen → Player-Link öffnen. Der öffentliche Player schreibt nur über publicPlayerRuntime.</p>
          </div>
        </div>
      </div>

      {playerError && <div className="bento-panel border-red-500/20 bg-red-500/5 p-4 text-sm text-red-300">Player konnten nicht geladen werden: {playerError.message}</div>}
      {connectedProviders.length === 0 && <div className="bento-panel border-yellow-500/20 bg-yellow-500/5 p-5 flex items-center gap-3"><AlertCircle className="w-5 h-5 text-yellow-400" /><p className="text-sm text-yellow-300">Keine verbundene API-Verbindung. Erstelle und verbinde zuerst einen Spotify Provider.</p></div>}
      {playersMissingApi.length > 0 && <div className="bento-panel border-yellow-500/20 bg-yellow-500/5 p-5 flex items-start gap-3"><Wrench className="w-5 h-5 text-yellow-400 mt-0.5" /><div><p className="font-bold text-yellow-200">{playersMissingApi.length} Player brauchen eine API-Zuweisung</p><p className="text-sm text-yellow-300/80">Öffne „Zuweisung bearbeiten“, wähle einen Provider und öffne danach den neuen Player-Link.</p></div></div>}

      <div className="grid gap-4">
        {players.length === 0 ? (
          <motion.div className="bento-panel border-dashed border-primary/20 p-12 text-center"><Music2 className="w-12 h-12 text-muted-foreground/20 mx-auto mb-4" /><h3 className="text-lg font-bold mb-2">Keine Player vorhanden</h3><p className="text-muted-foreground mb-6">Erstelle den ersten Player und öffne den Setup-Link auf dem Player-Gerät.</p><Button onClick={() => setShowDialog(true)} className="bg-primary">Neuer Player</Button></motion.div>
        ) : players.map((player, idx) => {
          const providerId = getPlayerProviderId(player);
          const provider = providersById[providerId];
          const online = isPlayerOnline(player);
          const isConnected = providerStatus(provider) === 'connected';
          const hasRuntimeToken = !!(player.sessionToken || player.setupToken);
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
                      {providerId && <span className="text-xs text-green-400 flex items-center gap-1"><CheckCircle2 className="w-3 h-3" /> API am Player</span>}
                      <span className={`text-xs ${hasRuntimeToken ? 'text-green-400' : 'text-red-300'}`}>{hasRuntimeToken ? 'Runtime Session OK' : 'Runtime Session fehlt'}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button variant="ghost" size="sm" onClick={() => openSetup(player)} className="h-8 w-8 p-0" title="Player öffnen"><QrCode className="w-4 h-4" /></Button>
                    <Button variant="ghost" size="sm" onClick={() => deleteMutation.mutate(player.id)} className="text-red-400 hover:text-red-300 h-8 w-8 p-0" disabled={deleteMutation.isPending}><Trash2 className="w-4 h-4" /></Button>
                  </div>
                </div>

                <div className="grid md:grid-cols-4 gap-3 text-sm">
                  <div className={`rounded-lg p-3 border ${providerId ? 'bg-muted/20 border-border/30' : 'bg-red-500/5 border-red-500/20'}`}>
                    <p className="text-xs text-muted-foreground font-semibold mb-1">API-Verbindung</p>
                    <p className="font-bold text-sm">{provider ? getProviderDisplayName(provider) : providerId ? 'Provider nicht gefunden' : 'Nicht zugewiesen'}</p>
                    <p className={`text-xs mt-1 ${isConnected ? 'text-green-400' : providerId ? 'text-yellow-400' : 'text-red-300'}`}>{provider ? providerStatus(provider) : providerId ? 'am Player gespeichert' : 'Keine API-Verbindung'}</p>
                  </div>
                  <div className="bg-muted/20 rounded-lg p-3 border border-border/30"><p className="text-xs text-muted-foreground font-semibold mb-1">Zone</p><p className="font-bold text-sm">{getZoneName(player)}</p><p className="text-xs text-muted-foreground mt-1">optional</p></div>
                  <div className="bg-muted/20 rounded-lg p-3 border border-border/30"><p className="text-xs text-muted-foreground font-semibold mb-1">Device ID</p><p className="font-mono text-xs break-all">{player.spotifyDeviceId || '—'}</p></div>
                  <div className="bg-muted/20 rounded-lg p-3 border border-border/30"><p className="text-xs text-muted-foreground font-semibold mb-1">Last Command</p><p className="text-xs break-all">{player.lastCommand || '—'} {player.lastCommandStatus ? `· ${player.lastCommandStatus}` : ''}</p></div>
                </div>

                <div className="flex flex-wrap gap-2">
                  <Button variant="outline" size="sm" onClick={() => openEditAssignment(player)} className="gap-2"><Wrench className="w-4 h-4" />Zuweisung bearbeiten</Button>
                  <Button variant="outline" size="sm" onClick={() => openSetup(player)} className="gap-2"><QrCode className="w-4 h-4" />Player-Link</Button>
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

      <PlayerSetupModal open={setupModalOpen} onOpenChange={setSetupModalOpen} playerId={setupData.playerId} providerId={setupData.providerId} providerClientId={setupData.providerClientId} zoneId={setupData.zoneId} sessionToken={setupData.sessionToken} deviceName={setupData.deviceName} />

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-md"><DialogHeader><DialogTitle>Neuer Player</DialogTitle></DialogHeader><div className="space-y-4"><div><label className="text-xs font-semibold text-muted-foreground mb-2 block">Player-Name</label><Input placeholder="z.B. Gym Player" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} /></div><div><label className="text-xs font-semibold text-muted-foreground mb-2 block">API-Verbindung</label><Select value={formData.providerId} onValueChange={(value) => setFormData({ ...formData, providerId: value })}><SelectTrigger><SelectValue placeholder="API-Verbindung wählen" /></SelectTrigger><SelectContent>{providers.length === 0 ? <SelectItem disabled value="none">Keine API-Verbindung konfiguriert</SelectItem> : providers.map((acc) => <SelectItem key={acc.id} value={acc.id}>{getProviderDisplayName(acc)} {providerStatus(acc) === 'connected' ? '✓' : '(nicht verbunden)'}</SelectItem>)}</SelectContent></Select></div><div><label className="text-xs font-semibold text-muted-foreground mb-2 block">Zone / Raum optional</label><div className="flex gap-2"><Select value={formData.zoneId || 'none'} onValueChange={(value) => setFormData({ ...formData, zoneId: value })}><SelectTrigger><SelectValue placeholder="Zone wählen" /></SelectTrigger><SelectContent><SelectItem value="none">Keine</SelectItem>{zones.map((zone) => <SelectItem key={zone.id} value={zone.id}>{zone.name}</SelectItem>)}</SelectContent></Select><Button type="button" variant="outline" onClick={() => openZoneDialog('create')}>+ Zone</Button></div></div><div><label className="text-xs font-semibold text-muted-foreground mb-2 block">Player-Passwort optional</label><div className="flex gap-2"><Input type="text" placeholder="optional" value={formData.passwordHash} onChange={(e) => setFormData({ ...formData, passwordHash: e.target.value })} /><Button type="button" variant="outline" onClick={generatePassword} className="whitespace-nowrap">Generieren</Button></div></div><div className="flex gap-2 pt-4"><Button variant="outline" onClick={() => setShowDialog(false)} className="flex-1">Abbrechen</Button><Button onClick={handleCreate} disabled={createMutation.isPending} className="flex-1">{createMutation.isPending ? 'Erstelle...' : 'Erstellen'}</Button></div></div></DialogContent>
      </Dialog>

      <Dialog open={!!editAssignment.player} onOpenChange={(open) => !open && setEditAssignment(EMPTY_EDIT)}>
        <DialogContent className="max-w-md"><DialogHeader><DialogTitle>Player-Zuweisung bearbeiten</DialogTitle></DialogHeader><div className="space-y-4"><div className="rounded-lg border border-border/40 bg-muted/10 p-3 text-sm"><p className="font-bold">{editAssignment.player?.name}</p><p className="text-xs text-muted-foreground">API-Verbindung und Zone werden direkt am Player gespeichert.</p></div><div><label className="text-xs font-semibold text-muted-foreground mb-2 block">API-Verbindung</label><Select value={editAssignment.providerId || 'none'} onValueChange={(value) => setEditAssignment(prev => ({ ...prev, providerId: value === 'none' ? '' : value }))}><SelectTrigger><SelectValue placeholder="API-Verbindung wählen" /></SelectTrigger><SelectContent><SelectItem value="none">Keine</SelectItem>{providers.map((acc) => <SelectItem key={acc.id} value={acc.id}>{getProviderDisplayName(acc)} {providerStatus(acc) === 'connected' ? '✓' : '(nicht verbunden)'}</SelectItem>)}</SelectContent></Select></div><div><label className="text-xs font-semibold text-muted-foreground mb-2 block">Zone / Raum</label><div className="flex gap-2"><Select value={editAssignment.zoneId || 'none'} onValueChange={(value) => setEditAssignment(prev => ({ ...prev, zoneId: value }))}><SelectTrigger><SelectValue placeholder="Zone wählen" /></SelectTrigger><SelectContent><SelectItem value="none">Keine</SelectItem>{zones.map((zone) => <SelectItem key={zone.id} value={zone.id}>{zone.name}</SelectItem>)}</SelectContent></Select><Button type="button" variant="outline" onClick={() => openZoneDialog('edit')}>+ Zone</Button></div></div><div className="flex gap-2 pt-4"><Button variant="outline" onClick={() => setEditAssignment(EMPTY_EDIT)} className="flex-1">Abbrechen</Button><Button onClick={() => updateAssignmentMutation.mutate({ player: editAssignment.player, providerId: editAssignment.providerId, zoneId: editAssignment.zoneId })} disabled={updateAssignmentMutation.isPending} className="flex-1">Speichern</Button></div></div></DialogContent>
      </Dialog>

      <Dialog open={showZoneDialog} onOpenChange={setShowZoneDialog}>
        <DialogContent className="max-w-md"><DialogHeader><DialogTitle>Neue Zone erstellen</DialogTitle></DialogHeader><div className="space-y-4"><div><label className="text-xs font-semibold text-muted-foreground mb-2 block">Zonenname</label><Input placeholder="z.B. Gym" value={zoneForm.name} onChange={(e) => setZoneForm({ ...zoneForm, name: e.target.value })} /></div><div><label className="text-xs font-semibold text-muted-foreground mb-2 block">Farbe</label><Input type="color" value={zoneForm.color} onChange={(e) => setZoneForm({ ...zoneForm, color: e.target.value })} /></div><div className="grid grid-cols-3 gap-2"><div><label className="text-xs text-muted-foreground">Default</label><Input type="number" value={zoneForm.defaultVolume} onChange={(e) => setZoneForm({ ...zoneForm, defaultVolume: Number(e.target.value) })} /></div><div><label className="text-xs text-muted-foreground">Min</label><Input type="number" value={zoneForm.minVolume} onChange={(e) => setZoneForm({ ...zoneForm, minVolume: Number(e.target.value) })} /></div><div><label className="text-xs text-muted-foreground">Max</label><Input type="number" value={zoneForm.maxVolume} onChange={(e) => setZoneForm({ ...zoneForm, maxVolume: Number(e.target.value) })} /></div></div><p className="text-xs text-muted-foreground">Zonen speichern keine Provider. Sie sind nur Raum/Default-Werte.</p><div className="flex gap-2 pt-2"><Button variant="outline" onClick={() => setShowZoneDialog(false)} className="flex-1">Abbrechen</Button><Button onClick={() => zoneForm.name.trim() ? createZoneMutation.mutate(zoneForm) : toast.error('Zonenname fehlt.')} disabled={createZoneMutation.isPending} className="flex-1">Erstellen</Button></div></div></DialogContent>
      </Dialog>
    </div>
  );
}
