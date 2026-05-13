import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Plus, Copy, QrCode, AlertCircle, CheckCircle2, Zap } from 'lucide-react';
import { toast } from 'sonner';

const invoke = (fn, payload) => base44.functions.invoke(fn, payload);

export default function AddPlayerDevice() {
  const [showDialog, setShowDialog] = useState(false);
  const [formData, setFormData] = useState({ name: '', accountId: '', zoneId: '' });
  const [createdDevice, setCreatedDevice] = useState(null);
  const [showQR, setShowQR] = useState(false);
  const queryClient = useQueryClient();

  const { data: accounts = [] } = useQuery({
    queryKey: ['spotifyAccounts'],
    queryFn: () => base44.entities.SpotifyAccount.list(),
  });
  const { data: zones = [] } = useQuery({
    queryKey: ['zones'],
    queryFn: () => base44.entities.Zone.list(),
  });

  const createMutation = useMutation({
    mutationFn: async (data) => {
      const token = Math.random().toString(36).substring(2, 15);
      const deviceId = `device_${Math.random().toString(36).substring(2, 15)}`;
      
      // Create device first
      const device = await base44.entities.PlayerDevice.create({
        name: data.name,
        spotifyAccountId: data.accountId,
        zoneId: data.zoneId || undefined,
        pairingToken: token,
        deviceId: deviceId,
        pairingExpiresAt: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
      });

      // Create player user IMMEDIATELY so credentials are in QR code
      try {
        const playerRes = await invoke('createPlayerUser', {
          deviceId: deviceId,
          deviceName: data.name,
          playerDeviceId: device.id,
        });
        
        if (!playerRes.data?.success) {
          throw new Error('Player-User Erstellung fehlgeschlagen');
        }

        // Add credentials to device object for QR code
        return {
          ...device,
          playerEmail: playerRes.data.playerEmail,
          playerPassword: playerRes.data.playerPassword,
        };
      } catch (e) {
        console.error('createPlayerUser error:', e);
        throw e;
      }
    },
    onSuccess: (device) => {
      setCreatedDevice(device);
      setShowQR(true);
      toast.success('Player erstellt! QR Code mit Login-Daten generiert.');
    },
    onError: (error) => {
      toast.error('Fehler: ' + error.message);
    },
  });

  const handleCreate = () => {
    if (!formData.name.trim() || !formData.accountId) {
      toast.error('Name und Account erforderlich.');
      return;
    }
    createMutation.mutate(formData);
  };

  const pairingUrl = createdDevice
    ? `${window.location.origin}/player-pairing?token=${createdDevice.pairingToken}&email=${encodeURIComponent(createdDevice.playerEmail || '')}&password=${encodeURIComponent(createdDevice.playerPassword || '')}`
    : '';

  const connectedAccounts = accounts.filter(a => a.authStatus === 'connected');

  return (
    <div className="p-4 lg:p-8 space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl lg:text-3xl font-black flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center">
            <Plus className="w-5 h-5 text-primary" />
          </div>
          Neuer Player
        </h1>
        <p className="text-sm text-muted-foreground mt-1 ml-14">
          Füge ein neues Gerät hinzu und erhalte einen QR Code zum Pairing.
        </p>
      </div>

      {connectedAccounts.length === 0 && (
        <div className="bento-panel border-yellow-500/20 bg-yellow-500/5 p-5 flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-yellow-400 flex-shrink-0" />
          <p className="text-sm text-yellow-300">
            Kein Spotify Account verbunden. <a href="/spotify-accounts" className="underline font-semibold">Jetzt verbinden</a>
          </p>
        </div>
      )}

      {!createdDevice && (
        <div className="bento-panel p-6 space-y-4">
          <div>
            <Label className="text-sm font-semibold mb-2 block">Player Name *</Label>
            <Input
              value={formData.name}
              onChange={e => setFormData(f => ({ ...f, name: e.target.value }))}
              placeholder="z.B. 'Tennishalle Süd'"
              className="h-11 bg-muted/30"
            />
          </div>
          <div>
            <Label className="text-sm font-semibold mb-2 block">Spotify Account *</Label>
            <Select value={formData.accountId} onValueChange={v => setFormData(f => ({ ...f, accountId: v }))}>
              <SelectTrigger className="h-11 bg-muted/30">
                <SelectValue placeholder="Account wählen" />
              </SelectTrigger>
              <SelectContent>
                {connectedAccounts.map(a => (
                  <SelectItem key={a.id} value={a.id}>{a.displayName}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-sm font-semibold mb-2 block">Zone (optional)</Label>
            <Select value={formData.zoneId} onValueChange={v => setFormData(f => ({ ...f, zoneId: v }))}>
              <SelectTrigger className="h-11 bg-muted/30">
                <SelectValue placeholder="Zone wählen" />
              </SelectTrigger>
              <SelectContent>
                {zones.map(z => (
                  <SelectItem key={z.id} value={z.id}>{z.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex gap-3">
            <Button variant="outline" className="flex-1" onClick={() => setFormData({ name: '', accountId: '', zoneId: '' })}>
              Zurücksetzen
            </Button>
            <Button
              className="flex-1 bg-primary hover:bg-primary/90 font-bold"
              onClick={handleCreate}
              disabled={createMutation.isPending}
            >
              {createMutation.isPending ? 'Erstelle...' : 'Player erstellen'}
            </Button>
          </div>
        </div>
      )}

      {createdDevice && (
        <div className="space-y-4">
          <div className="bento-panel border-green-500/20 bg-green-500/5 p-6 space-y-4">
            <div className="flex items-start gap-3">
              <CheckCircle2 className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-bold text-green-300">Player erstellt!</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Gib diesem Player den QR Code oder den Link zum Scannen.
                </p>
              </div>
            </div>

            {/* QR Code Display */}
            {showQR && (
              <div className="flex justify-center p-4 bg-white rounded-lg">
                <div
                  style={{
                    width: '200px',
                    height: '200px',
                    backgroundImage: `url('https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(pairingUrl)}')`
                  }}
                  className="bg-cover"
                />
              </div>
            )}

            {/* Link Copy */}
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground font-semibold">Oder Link kopieren:</p>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={pairingUrl}
                  readOnly
                  className="flex-1 h-10 px-3 bg-muted/30 rounded-lg text-xs font-mono text-muted-foreground border border-border"
                />
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    navigator.clipboard.writeText(pairingUrl);
                    toast.success('Link kopiert!');
                  }}
                  className="gap-2"
                >
                  <Copy className="w-3.5 h-3.5" /> Kopieren
                </Button>
              </div>
            </div>

            <Button
              className="w-full bg-primary hover:bg-primary/90"
              onClick={() => {
                setCreatedDevice(null);
                setShowQR(false);
                setFormData({ name: '', accountId: '', zoneId: '' });
                queryClient.invalidateQueries({ queryKey: ['playerDevices'] });
              }}
            >
              Weiterer Player
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}