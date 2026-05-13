import { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { AlertCircle, CheckCircle2, Loader, Music2 } from 'lucide-react';
import { toast } from 'sonner';

const invoke = (fn, payload) => base44.functions.invoke(fn, payload);

export default function PlayerPairing() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState('loading'); // loading | success | expired | error
  const [device, setDevice] = useState(null);
  const [message, setMessage] = useState('');
  const [deviceId, setDeviceId] = useState('');

  useEffect(() => {
    const token = searchParams.get('token');
    if (!token) {
      setStatus('error');
      setMessage('Kein Pairing-Token gefunden.');
      return;
    }

    const pairDevice = async () => {
      try {
        // Generate unique device ID
        const id = `device_${Math.random().toString(36).substring(2, 15)}`;
        setDeviceId(id);

        // Find device by token
        const devices = await base44.entities.PlayerDevice.filter({
          pairingToken: token,
        });

        if (devices.length === 0) {
          setStatus('error');
          setMessage('Ungültiger oder abgelaufener Pairing-Token.');
          return;
        }

        const dev = devices[0];

        // Check expiration
        if (new Date(dev.pairingExpiresAt) < new Date()) {
          setStatus('expired');
          setMessage('Dieser Pairing-Token ist abgelaufen. Der Admin muss einen neuen generieren.');
          return;
        }

        // Mark as paired
        await base44.entities.PlayerDevice.update(dev.id, {
          deviceId: id,
          isPaired: true,
          pairedAt: new Date().toISOString(),
          lastSeen: new Date().toISOString(),
        });

        setDevice(dev);
        setStatus('success');
        setMessage(`✓ "${dev.name}" wurde erfolgreich gekoppelt!`);

        // Store pairing info locally
        localStorage.setItem('playerDeviceId', id);
        localStorage.setItem('playerToken', token);
      } catch (e) {
        setStatus('error');
        setMessage('Fehler beim Koppeln: ' + e.message);
      }
    };

    pairDevice();
  }, [searchParams]);

  return (
    <div className="min-h-screen aurora-bg flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-sm space-y-6">
        {/* Header */}
        <div className="flex flex-col items-center gap-3 text-center">
          <div className="w-12 h-12 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center">
            <Music2 className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-black gradient-text">StudioSoundSet</h1>
            <p className="text-sm text-muted-foreground mt-1">Player Kopplung</p>
          </div>
        </div>

        {/* Status */}
        {status === 'loading' && (
          <div className="bento-panel p-8 flex flex-col items-center gap-4 text-center">
            <Loader className="w-8 h-8 text-primary animate-spin" />
            <p className="text-sm text-muted-foreground">Koppeln läuft...</p>
          </div>
        )}

        {status === 'success' && (
          <div className="bento-panel border-green-500/20 bg-green-500/5 p-8 space-y-4 text-center">
            <CheckCircle2 className="w-12 h-12 text-green-400 mx-auto" />
            <div>
              <p className="font-bold text-green-300 text-lg">{device?.name}</p>
              <p className="text-sm text-muted-foreground mt-1 leading-relaxed">{message}</p>
            </div>
            <div className="bg-muted/30 rounded-lg p-3 mt-4">
              <p className="text-[10px] text-muted-foreground">Device ID</p>
              <p className="font-mono text-xs text-primary mt-1 break-all">{deviceId}</p>
            </div>
            <div className="pt-4 space-y-2">
              <p className="text-xs text-muted-foreground">
                Dieser Browser ist jetzt als "{device?.name}" registriert.
              </p>
              <Button
                className="w-full bg-green-600 hover:bg-green-700 font-bold h-11"
                onClick={() => {
                  // Open player in new window
                  const playerUrl = `${window.location.origin}/player?deviceId=${deviceId}`;
                  window.location.href = '/player';
                }}
              >
                → Zum Player
              </Button>
            </div>
          </div>
        )}

        {status === 'expired' && (
          <div className="bento-panel border-orange-500/20 bg-orange-500/5 p-8 space-y-4 text-center">
            <AlertCircle className="w-12 h-12 text-orange-400 mx-auto" />
            <div>
              <p className="font-bold text-orange-300">Token abgelaufen</p>
              <p className="text-sm text-muted-foreground mt-2">{message}</p>
            </div>
            <Button variant="outline" className="w-full">
              Kontaktiere den Admin
            </Button>
          </div>
        )}

        {status === 'error' && (
          <div className="bento-panel border-red-500/20 bg-red-500/5 p-8 space-y-4 text-center">
            <AlertCircle className="w-12 h-12 text-red-400 mx-auto" />
            <div>
              <p className="font-bold text-red-300">Fehler</p>
              <p className="text-sm text-muted-foreground mt-2">{message}</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}