import { Link } from 'react-router-dom';
import { AlertCircle, Music2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function PlayerPairing() {
  return (
    <div className="min-h-screen aurora-bg flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="flex flex-col items-center gap-3 text-center">
          <div className="w-12 h-12 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center">
            <Music2 className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-black gradient-text">StudioSoundSet</h1>
            <p className="text-sm text-muted-foreground mt-1">Legacy Player Kopplung</p>
          </div>
        </div>

        <div className="bento-panel border-yellow-500/20 bg-yellow-500/5 p-8 space-y-4 text-center">
          <AlertCircle className="w-12 h-12 text-yellow-400 mx-auto" />
          <div>
            <p className="font-bold text-yellow-200">Dieser alte Pairing-Pfad ist deaktiviert.</p>
            <p className="text-sm text-muted-foreground mt-2">
              Öffne den aktuellen Player-Link aus dem Admin-Bereich. Der öffentliche Player darf nur noch publicPlayerRuntime verwenden.
            </p>
          </div>
          <Button asChild variant="outline" className="w-full">
            <Link to="/player-new">Zum Player</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
