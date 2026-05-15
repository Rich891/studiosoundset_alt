import { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { AlertCircle, Loader, Wifi } from 'lucide-react';
import { toast } from 'sonner';

function buildPlayerFromQuery(params) {
  const id = params.get('playerId');
  const email = params.get('email');
  const passwordHash = params.get('password');
  const name = params.get('name') || 'StudioSoundSet Player';
  const providerId = params.get('providerId') || '';
  const zoneId = params.get('zoneId') || '';
  if (!id || !email || !passwordHash) return null;
  return {
    id,
    name,
    email,
    passwordHash,
    providerId,
    zoneId,
    role: 'player',
    isActive: true,
    isOnline: true,
    lastSeen: new Date().toISOString(),
    lastHeartbeatAt: new Date().toISOString(),
  };
}

export default function PlayerLogin({ onLoginSuccess }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [qrPlayer, setQrPlayer] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [backendReachable, setBackendReachable] = useState(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const queryEmail = params.get('email');
    const queryPassword = params.get('password');
    const playerFromQuery = buildPlayerFromQuery(params);
    if (queryEmail) setEmail(queryEmail);
    if (queryPassword) setPassword(queryPassword);
    if (playerFromQuery) setQrPlayer(playerFromQuery);

    fetch(window.location.origin, { method: 'HEAD', cache: 'no-store' })
      .then(() => setBackendReachable(true))
      .catch(() => setBackendReachable(false));
  }, []);

  const completeLogin = (player, sessionToken) => {
    localStorage.setItem('playerSessionToken', sessionToken || `qr_${player.id}_${Date.now()}`);
    localStorage.setItem('player', JSON.stringify(player));
    toast.success('Angemeldet!');
    onLoginSuccess();
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    if (!email || !password) {
      setError('Email und Passwort erforderlich');
      return;
    }

    setLoading(true);
    setError('');

    if (qrPlayer && qrPlayer.email === email && qrPlayer.passwordHash === password) {
      completeLogin(qrPlayer, `qr_${qrPlayer.id}_${Date.now()}`);
      setLoading(false);
      return;
    }

    try {
      const response = await base44.functions.invoke('playerAuthLogin', { email, password });

      if (response.data?.success && response.data?.sessionToken) {
        completeLogin(response.data.player, response.data.sessionToken);
      } else {
        setError(response.data?.error || 'Login fehlgeschlagen');
      }
    } catch (e) {
      const needsQr = /must be logged in|auth|required|403|401/i.test(e.message || '');
      setError(needsQr
        ? 'Base44 blockiert öffentlichen Entity-Zugriff. Bitte nutze den QR-Code bzw. Player-Link aus “Player verwalten”, nicht nur Email/Passwort manuell.'
        : 'Fehler: ' + e.message
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen aurora-bg flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="bento-panel p-8 space-y-6">
          <div className="text-center">
            <h1 className="text-2xl font-black gradient-text mb-1">StudioSoundSet</h1>
            <p className="text-sm text-muted-foreground">Player Login</p>
          </div>

          <div className="rounded-lg border border-border/40 bg-background/40 p-3 text-xs space-y-1">
            <p className="flex items-center gap-2"><Wifi className="w-3.5 h-3.5" /> Current Origin: <span className="font-mono break-all">{window.location.origin}</span></p>
            <p>App erreichbar: <span className={backendReachable === false ? 'text-red-400' : 'text-green-400'}>{backendReachable === null ? 'prüfe...' : backendReachable ? 'ja' : 'nein'}</span></p>
            <p>QR Player-ID: <span className={qrPlayer ? 'text-green-400' : 'text-yellow-300'}>{qrPlayer?.id || 'nicht im Link'}</span></p>
            <p className="text-muted-foreground">Admin und Player bitte auf getrennten Geräten/Browserprofilen testen.</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="text-xs font-semibold text-muted-foreground mb-2 block">Email</label>
              <Input type="email" placeholder="player-xxx@studio" value={email} onChange={(e) => setEmail(e.target.value)} disabled={loading} />
            </div>
            <div>
              <label className="text-xs font-semibold text-muted-foreground mb-2 block">Passwort</label>
              <Input type="password" placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} disabled={loading} />
            </div>

            {error && <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3 flex gap-2"><AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" /><p className="text-xs text-red-300">{error}</p></div>}

            <Button type="submit" disabled={loading} className="w-full">
              {loading ? <><Loader className="w-4 h-4 animate-spin mr-2" />Melde mich an...</> : 'Anmelden'}
            </Button>
          </form>

          <p className="text-xs text-muted-foreground text-center">Bei Base44 Auth-Sperre funktioniert der Login nur über den QR-/Player-Link mit Player-ID.</p>
        </div>
      </div>
    </div>
  );
}
