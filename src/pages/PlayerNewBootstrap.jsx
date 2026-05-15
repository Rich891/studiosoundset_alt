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

function installPublicPlayerStubs({ providerId, zoneId }) {
  if (providerId && !base44.entities.Provider.__sssPublicPlayerStub) {
    const originalProviderGet = base44.entities.Provider.get.bind(base44.entities.Provider);
    base44.entities.Provider.get = async (id) => {
      if (id === providerId) {
        return {
          id,
          name: 'Zugewiesener Spotify Provider',
          displayName: 'Zugewiesener Spotify Provider',
          providerType: 'spotify',
          status: 'connected',
          authStatus: 'connected',
          publicPlayerStub: true,
        };
      }
      return originalProviderGet(id);
    };
    base44.entities.Provider.__sssPublicPlayerStub = true;
  }

  if (zoneId && !base44.entities.Zone.__sssPublicPlayerStub) {
    const originalZoneGet = base44.entities.Zone.get.bind(base44.entities.Zone);
    base44.entities.Zone.get = async (id) => {
      if (id === zoneId) return { id, name: 'Zugewiesene Zone', publicPlayerStub: true };
      return originalZoneGet(id);
    };
    base44.entities.Zone.__sssPublicPlayerStub = true;
  }
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
      const explicitProviderId = params.get('providerId') || '';
      const explicitZoneId = params.get('zoneId') || '';
      const providerId = explicitProviderId || getPlayerProviderId(stored || {}, {});
      const zoneId = explicitZoneId || stored?.zoneId || '';

      installPublicPlayerStubs({ providerId, zoneId });

      if (stored?.id || playerId) {
        const merged = {
          ...(stored || {}),
          ...(playerId ? { id: playerId } : {}),
          ...(params.get('name') ? { name: params.get('name') } : {}),
          ...(params.get('email') ? { email: params.get('email') } : {}),
          ...(params.get('password') ? { passwordHash: params.get('password') } : {}),
          ...(providerId ? {
            providerId,
            apiCredentialSetId: providerId,
            spotifyAccountId: providerId,
          } : {}),
          ...(zoneId ? { zoneId } : {}),
          role: 'player',
          isActive: true,
        };
        localStorage.setItem('player', JSON.stringify(merged));
        if (!localStorage.getItem('playerSessionToken')) {
          localStorage.setItem('playerSessionToken', `qr_${merged.id}_${Date.now()}`);
        }
      }

      if (playerId && providerId) {
        base44.entities.Player.update(playerId, {
          ...buildPlayerProviderPatch(providerId),
          ...(zoneId ? { zoneId } : {}),
          isActive: true,
          role: 'player',
          updatedAt: new Date().toISOString(),
        }).catch((error) => console.warn('Public player bootstrap could not repair server assignment.', error));
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
