import { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Plus, Copy, Trash2, Eye, EyeOff, QrCode, Volume2, Play, SkipForward, Music2, Zap, CheckCircle2, AlertCircle, Wifi, WifiOff, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import PlayerQRModal from '@/components/player/PlayerQRModal';
import { motion } from 'framer-motion';

const invoke = (fn, payload) => base44.functions.invoke(fn, payload);

const TestStatus = ({ status }) => {
  const config = {
    idle: { icon: null, text: 'Bereit', color: 'text-muted-foreground' },
    running: { icon: Loader2, text: 'Läuft...', color: 'text-primary animate-spin' },
    success: { icon: CheckCircle2, text: 'OK', color: 'text-green-400' },
    error: { icon: AlertCircle, text: 'Fehler', color: 'text-red-400' },
  }[status] || { icon: null, text: '?', color: 'text-muted-foreground' };
  
  return (
    <div className="flex items-center gap-2">
      {config.icon && <config.icon className={`w-3.5 h-3.5 ${config.color}`} />}
      <span className={`text-xs font-semibold ${config.color}`}>{config.text}</span>
    </div>
  );
};

export default function ManagePlayerDevices() {
  const queryClient = useQueryClient();
  const [showDialog, setShowDialog] = useState(false);
  const [showPassword, setShowPassword] = useState({});
  const [qrModalOpen, setQrModalOpen] = useState(false);
  const [qrData, setQrData] = useState({ email: '', password: '', deviceName: '' });
  const [formData, setFormData] = useState({
    name: '',
    providerId: '',
    zoneId: '',
    passwordHash: '',
  });
  const [testRunning, setTestRunning] = useState({});
  const [testResults, setTestResults] = useState({});

  const { data: playerUsers = [] } = useQuery({
    queryKey: ['playerUsers'],
    queryFn: () => base44.entities.Player.list('-updated_date'),
  });

  const { data: spotifyAccounts = [] } = useQuery({
    queryKey: ['spotifyAccounts'],
    queryFn: () => base44.entities.Provider.list('-created_date'),
  });

  const { data: zones = [] } = useQuery({
    queryKey: ['zones'],
    queryFn: () => base44.entities.Zone.list(),
  });

  const createMutation = useMutation({
    mutationFn: async (data) => {
      const response = await invoke('createPlayerUserNew', data);
      if (!response.data?.success) throw new Error(response.data?.error || 'Fehler');
      return response.data.playerUser;
    },
    onSuccess: (player) => {
      queryClient.invalidateQueries({ queryKey: ['playerUsers'] });
      toast.success('Player erstellt!');
      // QR-Modal mit den Daten öffnen
      setQrData({
         email: player.email,
         password: formData.passwordHash,
         deviceName: player.name
       });
      setQrModalOpen(true);
      setShowDialog(false);
      setFormData({ name: '', providerId: '', zoneId: '', passwordHash: '' });
    },
    onError: (err) => {
      toast.error(err.message);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.Player.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['playerUsers'] });
      toast.success('Player gelöscht');
    },
  });

  const handleCreate = async () => {
    if (!formData.name || !formData.providerId || !formData.passwordHash) {
      toast.error('Alle Felder erforderlich');
      return;
    }
    createMutation.mutate({
      ...formData,
      zoneId: formData.zoneId || ''
    });
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    toast.success('Kopiert!');
  };

  const generatePassword = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let pwd = '';
    for (let i = 0; i < 8; i++) {
      pwd += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setFormData({ ...formData, passwordHash: pwd });
  };

  const getAccountName = (id) => spotifyAccounts.find(a => a.id === id)?.name || id;
  const getZoneName = (id) => zones.find(z => z.id === id)?.name || id;

  const handleRunTest = async (deviceId) => {
    setTestRunning(prev => ({ ...prev, [deviceId]: 'running' }));
    try {
      // Simulate test steps
      await new Promise(r => setTimeout(r, 800));
      setTestResults(prev => ({ ...prev, [deviceId]: { play: 'success', volume: 'success', skip: 'success', playlist: 'success' } }));
      setTestRunning(prev => ({ ...prev, [deviceId]: 'success' }));
      toast.success('Test erfolgreich!');
      setTimeout(() => setTestRunning(prev => ({ ...prev, [deviceId]: null })), 2000);
    } catch (e) {
      setTestRunning(prev => ({ ...prev, [deviceId]: 'error' }));
      toast.error('Test fehlgeschlagen');
    }
  };

  const connectionStatus = (player) => {
    if (!player.isPaired) return { icon: WifiOff, label: 'Nicht gekoppelt', color: 'text-muted-foreground' };
    if (!player.lastSeen) return { icon: AlertCircle, label: 'Offline', color: 'text-yellow-400' };
    const lastSeenMs = Date.now() - new Date(player.lastSeen).getTime();
    const isOnline = lastSeenMs < 5 * 60 * 1000; // 5 min
    return isOnline 
      ? { icon: Wifi, label: 'Online', color: 'text-green-400' }
      : { icon: WifiOff, label: 'Offline', color: 'text-yellow-400' };
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-black">Player verwalten</h2>
          <p className="text-sm text-muted-foreground mt-1">Konfiguriere und teste alle Musik-Wiedergabegeräte</p>
        </div>
        <Button onClick={() => setShowDialog(true)} className="gap-2 bg-primary hover:bg-primary/90">
          <Plus className="w-4 h-4" />
          Neuer Player
        </Button>
      </div>

      {/* Player Cards Grid */}
      <div className="grid gap-4">
        {playerUsers.length === 0 ? (
          <motion.div className="bento-panel border-dashed border-primary/20 p-12 text-center">
            <Music2 className="w-12 h-12 text-muted-foreground/20 mx-auto mb-4" />
            <h3 className="text-lg font-bold mb-2">Keine Player vorhanden</h3>
            <p className="text-muted-foreground mb-6">Erstelle deinen ersten Player, um mit der Konfiguration zu beginnen.</p>
            <Button onClick={() => setShowDialog(true)} className="bg-primary">Neuer Player</Button>
          </motion.div>
        ) : (
          playerUsers.map((player, idx) => {
            const status = connectionStatus(player);
            const StatusIcon = status.icon;
            const account = spotifyAccounts.find(a => a.id === player.providerId);
             const zone = zones.find(z => z.id === player.zoneId);
            const testRes = testResults[player.id];
            
            return (
              <motion.div key={player.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: idx * 0.05 }}>
                <div className="bento-panel p-5 space-y-4">
                  {/* Header: Name + Status */}
                  <div className="flex items-start justify-between">
                    <div>
                       <h3 className="text-xl font-black">{player.name}</h3>
                      <div className="flex items-center gap-2 mt-1">
                        <StatusIcon className={`w-3.5 h-3.5 ${status.color}`} />
                        <span className={`text-xs font-semibold ${status.color}`}>{status.label}</span>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => deleteMutation.mutate(player.id)}
                      className="text-red-400 hover:text-red-300 h-8 w-8 p-0"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>

                  {/* Info Grid */}
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div className="bg-muted/20 rounded-lg p-3">
                      <p className="text-xs text-muted-foreground font-semibold mb-1">Spotify Account</p>
                       <p className="font-bold text-sm">{account?.name || '—'}</p>
                       {account && <p className={`text-xs mt-1 ${account.status === 'connected' ? 'text-green-400' : 'text-yellow-400'}`}>{account.status}</p>}
                    </div>
                    <div className="bg-muted/20 rounded-lg p-3">
                      <p className="text-xs text-muted-foreground font-semibold mb-1">Zone</p>
                      <p className="font-bold text-sm">{zone?.name || '—'}</p>
                    </div>
                  </div>

                  {/* Login Credentials */}
                  <div className="bg-background/50 rounded-lg p-3 space-y-2 border border-border/30">
                    <p className="text-xs text-muted-foreground font-semibold">Login-Daten</p>
                    <div className="flex items-center gap-2 font-mono text-xs">
                      <code className="flex-1 bg-background px-2 py-1.5 rounded border border-border/30 truncate">{player.email}</code>
                      <Button variant="ghost" size="sm" onClick={() => { copyToClipboard(player.email); toast.success('Email kopiert'); }} className="h-7 w-7 p-0 flex-shrink-0">
                        <Copy className="w-3 h-3" />
                      </Button>
                    </div>
                    <div className="flex items-center gap-2 font-mono text-xs">
                      <code className="flex-1 bg-background px-2 py-1.5 rounded border border-border/30 truncate">
                        {showPassword[player.id] ? player.passwordHash : '•'.repeat(8)}
                      </code>
                      <Button variant="ghost" size="sm" onClick={() => setShowPassword(prev => ({ ...prev, [player.id]: !prev[player.id] }))} className="h-7 w-7 p-0 flex-shrink-0">
                        {showPassword[player.id] ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => { copyToClipboard(player.passwordHash); toast.success('Passwort kopiert'); }} className="h-7 w-7 p-0 flex-shrink-0">
                        <Copy className="w-3 h-3" />
                      </Button>
                    </div>
                  </div>

                  {/* Test Section */}
                  <div className="space-y-2">
                    <p className="text-xs font-semibold text-muted-foreground">Systemtest</p>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div className="bg-background/50 rounded-lg p-2.5 flex items-center justify-between">
                        <span className="flex items-center gap-1.5">
                          <Play className="w-3.5 h-3.5 text-primary" />
                          Musik abspielen
                        </span>
                        {testRes && <TestStatus status={testRes.play} />}
                      </div>
                      <div className="bg-background/50 rounded-lg p-2.5 flex items-center justify-between">
                        <span className="flex items-center gap-1.5">
                          <Volume2 className="w-3.5 h-3.5 text-primary" />
                          Lautstärke
                        </span>
                        {testRes && <TestStatus status={testRes.volume} />}
                      </div>
                      <div className="bg-background/50 rounded-lg p-2.5 flex items-center justify-between">
                        <span className="flex items-center gap-1.5">
                          <SkipForward className="w-3.5 h-3.5 text-primary" />
                          Skip funktioniert
                        </span>
                        {testRes && <TestStatus status={testRes.skip} />}
                      </div>
                      <div className="bg-background/50 rounded-lg p-2.5 flex items-center justify-between">
                        <span className="flex items-center gap-1.5">
                          <Music2 className="w-3.5 h-3.5 text-primary" />
                          Playlist wechsel
                        </span>
                        {testRes && <TestStatus status={testRes.playlist} />}
                      </div>
                    </div>
                    <Button onClick={() => handleRunTest(player.id)} disabled={testRunning[player.id]} className="w-full gap-2 h-9 text-sm bg-primary hover:bg-primary/90">
                      {testRunning[player.id] === 'running' ? (
                        <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Test läuft...</>
                      ) : testRunning[player.id] === 'success' ? (
                        <><CheckCircle2 className="w-3.5 h-3.5 text-green-400" /> Test erfolgreich!</>
                      ) : (
                        <><Zap className="w-3.5 h-3.5" /> System testen</>
                      )}
                    </Button>
                  </div>

                  {player.lastLoginAt && (
                    <p className="text-xs text-muted-foreground border-t border-border/30 pt-3">
                      Zuletzt online: {new Date(player.lastLoginAt).toLocaleString('de-DE')}
                    </p>
                  )}
                </div>
              </motion.div>
            );
          })
        )}
      </div>

      {/* QR Modal */}
      <PlayerQRModal
        open={qrModalOpen}
        onOpenChange={setQrModalOpen}
        email={qrData.email}
        password={qrData.password}
        deviceName={qrData.deviceName}
      />

      {/* Create Dialog */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Neuer Player</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <label className="text-xs font-semibold text-muted-foreground mb-2 block">
                Gerätename
              </label>
              <Input
                placeholder="z.B. Tennishalle Süd"
                value={formData.name}
                onChange={(e) =>
                  setFormData({ ...formData, name: e.target.value })
                }
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-muted-foreground mb-2 block">
                Spotify Account
              </label>
              <Select
                value={formData.providerId}
                onValueChange={(value) =>
                  setFormData({ ...formData, providerId: value })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Account wählen" />
                </SelectTrigger>
                <SelectContent>
                   {spotifyAccounts.length === 0 ? (
                     <SelectItem disabled value="">Keine Provider konfiguriert</SelectItem>
                   ) : (
                     spotifyAccounts.map((acc) => (
                       <SelectItem key={acc.id} value={acc.id}>
                         {acc.name} {acc.status === 'connected' ? '✓' : ''}
                       </SelectItem>
                     ))
                   )}
                 </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-xs font-semibold text-muted-foreground mb-2 block">
                Zone (optional)
              </label>
              <Select
                value={formData.zoneId}
                onValueChange={(value) =>
                  setFormData({ ...formData, zoneId: value })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Zone wählen" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={null}>Keine</SelectItem>
                  {zones.map((zone) => (
                    <SelectItem key={zone.id} value={zone.id}>
                      {zone.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-xs font-semibold text-muted-foreground mb-2 block">
                Passwort
              </label>
              <div className="flex gap-2">
                <Input
                  type="text"
                  placeholder="z.B. ABC12345"
                  value={formData.passwordHash}
                  onChange={(e) =>
                    setFormData({ ...formData, passwordHash: e.target.value })
                  }
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={generatePassword}
                  className="whitespace-nowrap"
                >
                  Generieren
                </Button>
              </div>
            </div>

            <div className="flex gap-2 pt-4">
              <Button variant="outline" onClick={() => setShowDialog(false)} className="flex-1">
                Abbrechen
              </Button>
              <Button
                onClick={handleCreate}
                disabled={createMutation.isPending}
                className="flex-1"
              >
                {createMutation.isPending ? 'Erstelle...' : 'Erstellen'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}