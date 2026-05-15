import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Copy, ExternalLink } from 'lucide-react';
import { toast } from 'sonner';

export default function PlayerSetupModal({ open, onOpenChange, playerId, providerId, providerClientId, zoneId, sessionToken, deviceName }) {
  if (!playerId) return null;
  const params = new URLSearchParams({ playerId, name: deviceName || 'StudioSoundSet Player' });
  if (providerId) params.set('providerId', providerId);
  if (providerClientId) params.set('cid', providerClientId);
  if (zoneId) params.set('zoneId', zoneId);
  if (sessionToken) params.set('sessionToken', sessionToken);
  const link = `${window.location.origin}/player-new?${params.toString()}`;
  const copy = () => { navigator.clipboard.writeText(link); toast.success('Player-Link kopiert'); };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader><DialogTitle>Player öffnen</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2 p-3 bg-muted/30 rounded-lg">
            <p className="text-xs text-muted-foreground font-semibold">Player-Link</p>
            <p className="font-mono text-xs break-all">{link}</p>
            <p className="text-xs text-muted-foreground font-semibold mt-3">Player ID</p>
            <p className="font-mono text-xs break-all">{playerId}</p>
            <p className="text-xs text-muted-foreground font-semibold mt-3">Runtime Session</p>
            <p className={sessionToken ? 'text-xs text-green-400' : 'text-xs text-red-300'}>{sessionToken ? 'vorhanden' : 'fehlt'}</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={copy} className="flex-1 gap-2"><Copy className="w-4 h-4" /> Kopieren</Button>
            <Button variant="outline" size="sm" className="flex-1 gap-2" onClick={() => window.open(link, '_blank', 'noopener,noreferrer')}><ExternalLink className="w-4 h-4" /> Öffnen</Button>
          </div>
          <p className="text-xs text-muted-foreground text-center">Der Player-Link enthält die Runtime Session. Der öffentliche Player darf nur publicPlayerRuntime verwenden.</p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
