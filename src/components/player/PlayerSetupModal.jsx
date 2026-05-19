import { useEffect, useMemo, useState } from 'react';
import qrcode from 'qrcode-generator';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { AlertCircle, CheckCircle2, Copy, ExternalLink, QrCode, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';

function buildPlayerUrl({ playerId, providerId, providerClientId, zoneId, sessionToken, deviceName }) {
  const params = new URLSearchParams({ playerId, name: deviceName || 'StudioSoundSet Player' });
  if (providerId) params.set('providerId', providerId);
  if (providerClientId) params.set('cid', providerClientId);
  if (zoneId) params.set('zoneId', zoneId);
  if (sessionToken) params.set('sessionToken', sessionToken);
  return `${window.location.origin}/player-new?${params.toString()}`;
}

function createQrDataUrl(text) {
  const qr = qrcode(0, 'M');
  qr.addData(text, 'Byte');
  qr.make();
  return qr.createDataURL(6, 12);
}

export default function PlayerSetupModal({ open, onOpenChange, playerId, providerId, providerClientId, zoneId, sessionToken, deviceName }) {
  const [qrError, setQrError] = useState('');
  const [qrDataUrl, setQrDataUrl] = useState('');

  const link = useMemo(() => {
    if (!playerId) return '';
    return buildPlayerUrl({ playerId, providerId, providerClientId, zoneId, sessionToken, deviceName });
  }, [playerId, providerId, providerClientId, zoneId, sessionToken, deviceName]);

  useEffect(() => {
    if (!open || !link) {
      setQrDataUrl('');
      setQrError('');
      return;
    }

    setQrError('');
    setQrDataUrl('');
    try {
      setQrDataUrl(createQrDataUrl(link));
    } catch (error) {
      console.error('QR render failed:', error);
      setQrError('QR-Code konnte nicht erzeugt werden. Nutze den Kopieren-Button.');
    }
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
          <div className="rounded-2xl border border-border/50 bg-white p-4 mx-auto w-fit shadow-xl min-h-72 min-w-72 flex items-center justify-center">
            {qrDataUrl ? (
              <img src={qrDataUrl} alt="Player Setup QR Code" className="block w-72 h-72 object-contain" draggable={false} />
            ) : (
              <div className="w-72 h-72 flex flex-col items-center justify-center gap-3 text-slate-500">
                <RefreshCw className="w-8 h-8 animate-spin" />
                <span className="text-xs font-semibold">QR-Code wird erzeugt...</span>
              </div>
            )}
          </div>

          {qrError && <div className="rounded-xl border border-red-500/20 bg-red-500/10 p-3 text-xs text-red-300 flex gap-2"><AlertCircle className="w-4 h-4 flex-shrink-0" />{qrError}</div>}

          <div className="rounded-xl border border-green-500/20 bg-green-500/5 p-3 flex gap-2 text-sm">
            <CheckCircle2 className="w-4 h-4 text-green-400 mt-0.5 flex-shrink-0" />
            <div>
              <p className="font-bold text-green-200">Auf dem Player-Geraet oeffnen</p>
              <p className="text-xs text-muted-foreground mt-1">Scanne diesen QR-Code mit iPad/iPhone/Tablet. Der Link enthaelt die Runtime Session fuer genau diesen Player.</p>
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
            <Button variant="outline" size="sm" className="gap-2" onClick={() => window.open(link, '_blank', 'noopener,noreferrer')}><ExternalLink className="w-4 h-4" /> Oeffnen</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
