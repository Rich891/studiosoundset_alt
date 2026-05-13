import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Copy, Download } from 'lucide-react';
import { toast } from 'sonner';

export default function PlayerQRModal({ open, onOpenChange, email, password, deviceName }) {
  if (!email || !password) return null;

  // QR Code mit Email und Passwort generieren
  const qrData = JSON.stringify({ email, password });
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(qrData)}`;

  const handleCopyCredentials = () => {
    const text = `Email: ${email}\nPasswort: ${password}`;
    navigator.clipboard.writeText(text);
    toast.success('Anmeldedaten kopiert');
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
        <DialogHeader>
          <DialogTitle>Player QR-Code</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          <div className="bg-white p-4 rounded-lg flex justify-center">
            <img src={qrUrl} alt="Player QR Code" className="w-64 h-64" />
          </div>

          <div className="space-y-2 p-3 bg-muted/30 rounded-lg">
            <p className="text-xs text-muted-foreground font-semibold">Gerätename</p>
            <p className="font-mono text-sm break-all">{deviceName}</p>
            
            <p className="text-xs text-muted-foreground font-semibold mt-3">Email</p>
            <p className="font-mono text-sm break-all">{email}</p>
            
            <p className="text-xs text-muted-foreground font-semibold mt-3">Passwort</p>
            <p className="font-mono text-sm break-all">{password}</p>
          </div>

          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleCopyCredentials}
              className="flex-1 gap-2"
            >
              <Copy className="w-4 h-4" /> Kopieren
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleDownloadQR}
              className="flex-1 gap-2"
            >
              <Download className="w-4 h-4" /> QR laden
            </Button>
          </div>

          <p className="text-xs text-muted-foreground text-center">
            Scanne den QR-Code mit dem Player-Gerät oder verwende die Anmeldedaten direkt.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}