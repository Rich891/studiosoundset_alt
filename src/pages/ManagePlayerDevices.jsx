import { useState } from 'react';
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
import { Plus, Copy, Trash2, Eye, EyeOff, QrCode } from 'lucide-react';
import { toast } from 'sonner';
import PlayerQRModal from '@/components/player/PlayerQRModal';

const invoke = (fn, payload) => base44.functions.invoke(fn, payload);

export default function ManagePlayerDevices() {
  const queryClient = useQueryClient();
  const [showDialog, setShowDialog] = useState(false);
  const [showPassword, setShowPassword] = useState({});
  const [qrModalOpen, setQrModalOpen] = useState(false);
  const [qrData, setQrData] = useState({ email: '', password: '', deviceName: '' });
  const [formData, setFormData] = useState({
    deviceName: '',
    spotifyAccountId: '',
    zoneId: '',
    password: '',
  });

  const { data: playerUsers = [] } = useQuery({
    queryKey: ['playerUsers'],
    queryFn: () => base44.entities.PlayerUser.list('-createdAt'),
  });

  const { data: spotifyAccounts = [] } = useQuery({
    queryKey: ['spotifyAccounts'],
    queryFn: () => base44.entities.SpotifyAccount.list(),
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
        password: formData.password, // Das ursprüngliche Passwort (nicht gehashed)
        deviceName: player.deviceName
      });
      setQrModalOpen(true);
      setShowDialog(false);
      setFormData({ deviceName: '', spotifyAccountId: '', zoneId: '', password: '' });
    },
    onError: (err) => {
      toast.error(err.message);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.PlayerUser.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['playerUsers'] });
      toast.success('Player gelöscht');
    },
  });

  const handleCreate = async () => {
    if (!formData.deviceName || !formData.spotifyAccountId || !formData.password) {
      toast.error('Alle Felder erforderlich');
      return;
    }
    createMutation.mutate(formData);
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
    setFormData({ ...formData, password: pwd });
  };

  const getAccountName = (id) => spotifyAccounts.find(a => a.id === id)?.displayName || id;
  const getZoneName = (id) => zones.find(z => z.id === id)?.name || id;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold">Player-Geräte</h2>
        <Button onClick={() => setShowDialog(true)} className="gap-2">
          <Plus className="w-4 h-4" />
          Neuer Player
        </Button>
      </div>

      {/* Player List */}
      <div className="grid gap-4">
        {playerUsers.length === 0 ? (
          <div className="bento-panel p-8 text-center text-muted-foreground">
            Noch keine Player erstellt
          </div>
        ) : (
          playerUsers.map((player) => (
            <div
              key={player.id}
              className="bento-panel p-4 space-y-3"
            >
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-bold text-lg">{player.deviceName}</h3>
                  <p className="text-xs text-muted-foreground">{player.deviceId}</p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => deleteMutation.mutate(player.id)}
                  className="text-red-400 hover:text-red-300"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>

              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-xs text-muted-foreground">Spotify Account</p>
                  <p className="font-semibold">{getAccountName(player.spotifyAccountId)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Zone</p>
                  <p className="font-semibold">{player.zoneId ? getZoneName(player.zoneId) : '-'}</p>
                </div>
              </div>

              {/* Credentials */}
              <div className="bg-background/50 rounded-lg p-3 space-y-2">
                <p className="text-xs text-muted-foreground font-semibold">Login-Daten</p>
                
                {/* Email */}
                <div className="flex items-center gap-2">
                  <code className="text-xs bg-background px-2 py-1 rounded flex-1 truncate">
                    {player.email}
                  </code>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => copyToClipboard(player.email)}
                    className="h-6 w-6 p-0"
                  >
                    <Copy className="w-3 h-3" />
                  </Button>
                </div>

                {/* Password */}
                <div className="flex items-center gap-2">
                  <code className="text-xs bg-background px-2 py-1 rounded flex-1 truncate">
                    {showPassword[player.id] ? player.passwordHash : '•'.repeat(8)}
                  </code>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowPassword(prev => ({
                      ...prev,
                      [player.id]: !prev[player.id]
                    }))}
                    className="h-6 w-6 p-0"
                  >
                    {showPassword[player.id] ? (
                      <EyeOff className="w-3 h-3" />
                    ) : (
                      <Eye className="w-3 h-3" />
                    )}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => copyToClipboard(player.passwordHash)}
                    className="h-6 w-6 p-0"
                  >
                    <Copy className="w-3 h-3" />
                  </Button>
                </div>
              </div>

              {player.lastLoginAt && (
                <p className="text-xs text-muted-foreground">
                  Zuletzt angemeldet: {new Date(player.lastLoginAt).toLocaleString('de-DE')}
                </p>
              )}
            </div>
          ))
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
                value={formData.deviceName}
                onChange={(e) =>
                  setFormData({ ...formData, deviceName: e.target.value })
                }
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-muted-foreground mb-2 block">
                Spotify Account
              </label>
              <Select
                value={formData.spotifyAccountId}
                onValueChange={(value) =>
                  setFormData({ ...formData, spotifyAccountId: value })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Account wählen" />
                </SelectTrigger>
                <SelectContent>
                  {spotifyAccounts.map((acc) => (
                    <SelectItem key={acc.id} value={acc.id}>
                      {acc.displayName}
                    </SelectItem>
                  ))}
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
                  value={formData.password}
                  onChange={(e) =>
                    setFormData({ ...formData, password: e.target.value })
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