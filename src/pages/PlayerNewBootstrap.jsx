import { useEffect, useState } from 'react';
import PlayerRuntime from './PlayerRuntime';
import { RefreshCw } from 'lucide-react';
import { getPlayerProviderId } from '@/lib/playerAssignments';

function readStoredPlayer() {
  try { return JSON.parse(localStorage.getItem('player')) || null; }
  catch { return null; }
}

export default function PlayerNewBootstrap() {
  const [ready, setReady] = useState(false);
  const [bootKey, setBootKey] = useState(0);

  useEffect(() => {
    let cancelled = false;

    async function bootstrap() {
      const params = new URLSearchParams(window.location.search);
      const stored = readStoredPlayer();
      const playerId = params.get('playerId') || stored?.id || '';
      const providerId = params.get('providerId') || getPlayerProviderId(stored || {});
      const zoneId = params.get('zoneId') || stored?.zoneId || '';
      const spotifyClientId = params.get('cid') || stored?.spotifyClientId || stored?.clientId || '';
      const sessionToken = params.get('sessionToken') || params.get('setupToken') || params.get('token') || stored?.sessionToken || stored?.setupToken || '';

      if (playerId || stored?.id) {
        const merged = {
          ...(stored || {}),
          ...(playerId ? { id: playerId } : {}),
          ...(params.get('name') ? { name: params.get('name') } : {}),
          ...(params.get('email') ? { email: params.get('email') } : {}),
          ...(providerId ? { providerId, apiCredentialSetId: providerId, spotifyAccountId: providerId } : {}),
          ...(zoneId ? { zoneId } : {}),
          ...(spotifyClientId ? { spotifyClientId, clientId: spotifyClientId } : {}),
          ...(sessionToken ? { sessionToken, setupToken: stored?.setupToken || sessionToken } : {}),
          role: 'player',
          isActive: true,
        };
        localStorage.setItem('player', JSON.stringify(merged));
        if (sessionToken) localStorage.setItem('playerSessionToken', sessionToken);
      }

      if (!cancelled) {
        setBootKey((v) => v + 1);
        setReady(true);
      }
    }

    bootstrap();
    return () => { cancelled = true; };
  }, []);

  if (!ready) {
    return (
      <div className="min-h-screen aurora-bg flex items-center justify-center">
        <div className="flex flex-col items-center gap-3 text-muted-foreground">
          <RefreshCw className="w-8 h-8 text-primary animate-spin" />
          <p className="text-sm">Synchronisiere Player...</p>
        </div>
      </div>
    );
  }

  return <PlayerRuntime key={bootKey} />;
}
