import { useEffect } from 'react';
import { Music2 } from 'lucide-react';

export default function PlayerLoginIndex() {
  useEffect(() => {
    // Redirect to player login
    window.location.href = '/player-new';
  }, []);

  return (
    <div className="min-h-screen aurora-bg flex items-center justify-center">
      <div className="text-center">
        <Music2 className="w-12 h-12 text-primary mx-auto mb-3" />
        <p className="text-muted-foreground">Lade Player...</p>
      </div>
    </div>
  );
}