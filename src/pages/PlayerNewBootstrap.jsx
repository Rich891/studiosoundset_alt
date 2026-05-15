import { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import PlayerNew from './PlayerNew';
import { RefreshCw } from 'lucide-react';
import { buildPlayerProviderPatch, getPlayerProviderId } from '@/lib/playerAssignments';

function readStoredPlayer() {
  try {
    return JSON.parse(localStorage.getItem('player')) || null;
  } catch {
    return null;
  }
}

export default function PlayerNewBootstrap() {
  const [ready, setReady] = useState(false);
  const [bootKey, setBootKey] = useState(0);

  useEffect(() => {
    let cancelled = false;

    async function bootstrap() {
      const params = new URLSearchParams(window.location.search);
      const playerId = params.get('playerId') || readStoredPlayer()?.id;
      const explicitProviderId = params.get('providerId') || '';
      const explicitZoneId = params.get('zoneId') || '';
      const stored = readStoredPlayer();

      if (stored?.id || playerId) {
        const merged = {
          ...(stored || {}),
          ...(playerId ? { id: playerId } : {}),
          ...(explicitProviderId ? {
            providerId: explicitProviderId,
            apiCredentialSetId: explicitProviderId,
            spotifyAccountId: explicitProviderId,
          } : {}),
          ...(explicitZoneId ? { zoneId: explicitZoneId } : {}),
          role: 'player',
          isActive: true,
        };
        localStorage.setItem('player', JSON.stringify(merged));
        if (!localStorage.getItem('playerSessionToken')) {
          localStorage.setItem('playerSessionToken', `qr_${merged.id}_${Date.now()}`);
        }
      }

      if (playerId && explicitProviderId) {
        try {
          const serverPlayer = await base44.entities.Player.get(playerId);
          const serverProviderId = getPlayerProviderId(serverPlayer || {}, {});
          if (serverProviderId !== explicitProviderId || !serverPlayer?.providerId || !serverPlayer?.apiCredentialSetId || !serverPlayer?.spotifyAccountId) {
            await base44.entities.Player.update(playerId, {
              ...buildPlayerProviderPatch(explicitProviderId),
              ...(explicitZoneId ? { zoneId: explicitZoneId } : {}),
              isActive: true,
              role: 'player',
              updatedAt: new Date().toISOString(),
            });
          }
        } catch (error) {
          console.warn('Could not repair player assignment during bootstrap. The local QR/session payload will still be used.', error);
        }
      }

      if (!cancelled) {
        setBootKey((value) => value + 1);
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
          <p className="text-sm">Synchronisiere Player-Zuweisung...</p>
        </div>
      </div>
    );
  }

  return <PlayerNew key={bootKey} />;
}
