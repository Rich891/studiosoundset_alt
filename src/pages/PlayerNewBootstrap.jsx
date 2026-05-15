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

function pickUrlPlayer(params) {
  const playerId = params.get('playerId');
  if (!playerId) return null;
  return {
    id: playerId,
    name: params.get('name') || 'StudioSoundSet Player',
    email: params.get('email') || '',
    passwordHash: params.get('password') || '',
    providerId: params.get('providerId') || '',
    apiCredentialSetId: params.get('providerId') || '',
    spotifyAccountId: params.get('providerId') || '',
    zoneId: params.get('zoneId') || '',
    role: 'player',
    isActive: true,
  };
}

function mergePlayerRecords({ stored, urlPlayer, serverPlayer }) {
  const providerId = getPlayerProviderId(serverPlayer || {}, {}) || getPlayerProviderId(urlPlayer || {}, {}) || getPlayerProviderId(stored || {}, {});
  const zoneId = serverPlayer?.zoneId || urlPlayer?.zoneId || stored?.zoneId || '';
  const merged = {
    ...(stored || {}),
    ...(serverPlayer || {}),
    ...(urlPlayer || {}),
    id: serverPlayer?.id || urlPlayer?.id || stored?.id,
    name: serverPlayer?.name || urlPlayer?.name || stored?.name || 'StudioSoundSet Player',
    email: serverPlayer?.email || urlPlayer?.email || stored?.email || '',
    passwordHash: serverPlayer?.passwordHash || urlPlayer?.passwordHash || stored?.passwordHash || '',
    providerId,
    apiCredentialSetId: providerId,
    spotifyAccountId: providerId,
    zoneId,
    role: 'player',
  };
  return merged.id ? merged : null;
}

export default function PlayerNewBootstrap() {
  const [ready, setReady] = useState(false);
  const [bootKey, setBootKey] = useState(0);

  useEffect(() => {
    let cancelled = false;

    async function bootstrap() {
      const params = new URLSearchParams(window.location.search);
      const urlPlayer = pickUrlPlayer(params);
      const stored = readStoredPlayer();
      const playerId = urlPlayer?.id || stored?.id;
      let serverPlayer = null;

      if (playerId) {
        try {
          serverPlayer = await base44.entities.Player.get(playerId);
        } catch (error) {
          // Public Base44 reads can fail on some deployments. The QR/link payload is still enough to boot the player.
          console.warn('Player bootstrap could not read server Player. Falling back to QR/local session.', error);
        }
      }

      const merged = mergePlayerRecords({ stored, urlPlayer, serverPlayer });

      if (merged?.id) {
        localStorage.setItem('player', JSON.stringify(merged));
        if (!localStorage.getItem('playerSessionToken')) {
          localStorage.setItem('playerSessionToken', `qr_${merged.id}_${Date.now()}`);
        }

        const providerId = getPlayerProviderId(merged, {});
        const serverProviderId = getPlayerProviderId(serverPlayer || {}, {});
        if (providerId && (!serverPlayer || serverProviderId !== providerId || !serverPlayer.providerId || !serverPlayer.apiCredentialSetId)) {
          base44.entities.Player.update(merged.id, {
            ...buildPlayerProviderPatch(providerId),
            zoneId: merged.zoneId || '',
            isActive: true,
            role: 'player',
            updatedAt: new Date().toISOString(),
          }).catch((error) => console.warn('Could not repair player provider assignment during bootstrap.', error));
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
