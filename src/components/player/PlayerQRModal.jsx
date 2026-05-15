import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Copy, Download, ExternalLink } from 'lucide-react';
import { toast } from 'sonner';

export default function PlayerQRModal({ open, onOpenChange, playerId, providerId, zoneId, sessionToken, email, password, deviceName }) {
  if (!email || !password) return null;

  const loginParams = new URLSearchParams({
    email,
    password,
    name: deviceName || 'StudioSoundSet Player',
  });
  if (playerId) loginParams.set('playerId', playerId);
  if (providerId) loginParams.set('providerId', providerId);
  if (zoneId) loginParams.set('zoneId', zoneId);
  if (sessionToken) loginParams.set('sessionToken', sessionToken);

  const loginUrl = `${window.location.origin}/player-new?${loginParams.toString()}`;
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(loginUrl)}`;

  const handleCopyCredentials = () => {
    const text = `Player Login URL: ${loginUrl}\nEmail: ${email}\nPasswort: ${password}`;
    navigator.clipboard.writeText(text);
    toast.success('Player Login kopiert');
  };

  const handleDownloadQR = async () => {
    const link = document.createElement('a');
    link.href = qrUrl;
    link.download = `player-${deviceName}.png`;
    link.click();
    toast.success('QR-Code heruntergeladen');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader><DialogTitle>Player QR-Code</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div className="bg-white p-4 rounded-lg flex justify-center"><img src={qrUrl} alt="Player QR Code" className="w-64 h-64" /></div>

          <div className="space-y-2 p-3 bg-muted/30 rounded-lg">
            <p className="text-xs text-muted-foreground font-semibold">Open this URL on the Player device</p>
            <p className="font-mono text-xs break-all">{loginUrl}</p>
            <p className="text-xs text-muted-foreground font-semibold mt-3">Gerätename</p>
            <p className="font-mono text-sm break-all">{deviceName}</p>
            <p className="text-xs text-muted-foreground font-semibold mt-3">Player ID</p>
            <p className="font-mono text-xs break-all">{playerId || '—'}</p>
            <p className="text-xs text-muted-foreground font-semibold mt-3">Session</p>
            <p className="font-mono text-xs break-all">{sessionToken ? 'vorhanden' : 'fehlt'}</p>
            <p className="text-xs text-muted-foreground font-semibold mt-3">Email</p>
            <p className="font-mono text-sm break-all">{email}</p>
            <p className="text-xs text-muted-foreground font-semibold mt-3">Passwort</p>
            <p className="font-mono text-sm break-all">{password}</p>
          </div>

          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={handleCopyCredentials} className="flex-1 gap-2"><Copy className="w-4 h-4" /> Kopieren</Button>
            <Button variant="outline" size="sm" onClick={handleDownloadQR} className="flex-1 gap-2"><Download className="w-4 h-4" /> QR laden</Button>
          </div>
          <Button variant="outline" size="sm" className="w-full gap-2" onClick={() => window.open(loginUrl, '_blank', 'noopener,noreferrer')}><ExternalLink className="w-4 h-4" /> Player Login öffnen</Button>

          <p className="text-xs text-muted-foreground text-center">Der QR-Code enthält Player-ID und Session Token. Nur damit darf der öffentliche Player publicPlayerRuntime verwenden.</p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
