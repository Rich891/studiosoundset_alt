import { useEffect, useMemo, useRef, useState } from 'react';
import QRCode from 'qrcode';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { AlertCircle, CheckCircle2, Copy, ExternalLink, QrCode } from 'lucide-react';
import { toast } from 'sonner';

function buildPlayerUrl({ playerId, providerId, providerClientId, zoneId, sessionToken, deviceName }) {
  const params = new URLSearchParams({ playerId, name: deviceName || 'StudioSoundSet Player' });
  if (providerId) params.set('providerId', providerId);
  if (providerClientId) params.set('cid', providerClientId);
  if (zoneId) params.set('zoneId', zoneId);
  if (sessionToken) params.set('sessionToken', sessionToken);
  return `${window.location.origin}/player-new?${params.toString()}`;
}

export default function PlayerSetupModal({ open, onOpenChange, playerId, providerId, providerClientId, zoneId, sessionToken, deviceName }) {
  const canvasRef = useRef(null);
  const [qrError, setQrError] = useState('');

  const link = useMemo(() => {
    if (!playerId) return '';
    return buildPlayerUrl({ playerId, providerId, providerClientId, zoneId, sessionToken, deviceName });
  }, [playerId, providerId, providerClientId, zoneId, sessionToken, deviceName]);

  useEffect(() => {
    if (!open || !link || !canvasRef.current) return;
    setQrError('');
    QRCode.toCanvas(canvasRef.current, link, {
      width: 240,
      margin: 2,
      errorCorrectionLevel: 'M',
      color: {
        dark: '#050816',
        light: '#ffffff',
      },
    }).catch((error) => {
      console.error('QR render failed:', error);
      setQrError('QR-Code konnte nicht erzeugt werden. Nutze den Kopieren-Button.');
    });
  }, [open, link]);

  if (!playerId) return null;

  const copy = async () => {
    await navigator.clipboard.writeText(link);
    toast.success('Player-Link kopiert');
  };

  const copyToken = async () => {
    if (!sessionToken) return;
    await navigator.clipboard.writeText(sessionToken);
    toast.success('Runtime Session kopiert');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><QrCode className="w-5 h-5 text-primary" /> Player per QR verbinden</DialogTitle>
        </DialogHeader>
        <div className="space-y-5">
          <div className="rounded-2xl border border-border/50 bg-white p-4 mx-auto w-fit shadow-xl">
            <canvas ref={canvasRef} width={240} height={240} className="block w-60 h-60" aria-label="Player Setup QR Code" />
          </div>

          {qrError && <div className="rounded-xl border border-red-500/20 bg-red-500/10 p-3 text-xs text-red-300 flex gap-2"><AlertCircle className="w-4 h-4 flex-shrink-0" />{qrError}</div>}

          <div className="rounded-xl border border-green-500/20 bg-green-500/5 p-3 flex gap-2 text-sm">
            <CheckCircle2 className="w-4 h-4 text-green-400 mt-0.5 flex-shrink-0" />
            <div>
              <p className="font-bold text-green-200">Auf dem Player-Gerät öffnen</p>
              <p className="text-xs text-muted-foreground mt-1">Scanne diesen QR-Code mit iPad/iPhone/Tablet. Der Link enthält die Runtime Session für genau diesen Player.</p>
            </div>
          </div>

          <div className="space-y-2 p-3 bg-muted/30 rounded-lg">
            <p className="text-xs text-muted-foreground font-semibold">Player-Link</p>
            <p className="font-mono text-xs break-all">{link}</p>
            <div className="grid grid-cols-2 gap-2 pt-2">
              <div>
                <p className="text-xs text-muted-foreground font-semibold">Player ID</p>
                <p className="font-mono text-xs break-all">{playerId}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground font-semibold">Runtime Session</p>
                <button type="button" onClick={copyToken} className={sessionToken ? 'text-xs text-green-400 hover:underline' : 'text-xs text-red-300'}>{sessionToken ? 'vorhanden' : 'fehlt'}</button>
              </div>
            </div>
          </div>

          {!sessionToken && <div className="rounded-xl border border-red-500/20 bg-red-500/10 p-3 text-xs text-red-300 flex gap-2"><AlertCircle className="w-4 h-4 flex-shrink-0" />Dieser Player hat keine Runtime Session. Speichere die Player-Zuweisung neu, bevor du den QR-Code nutzt.</div>}

          <div className="grid grid-cols-2 gap-2">
            <Button variant="outline" size="sm" onClick={copy} className="gap-2"><Copy className="w-4 h-4" /> Link kopieren</Button>
            <Button variant="outline" size="sm" className="gap-2" onClick={() => window.open(link, '_blank', 'noopener,noreferrer')}><ExternalLink className="w-4 h-4" /> Öffnen</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
