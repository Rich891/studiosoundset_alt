import { base44 } from '@/api/base44Client';

export const PLAYER_CONFIG_TYPE = 'PLAYER_CONFIG';

export function getProviderIdFromConfig(config) {
  return config?.providerId || config?.apiId || '';
}

export async function listPlayerConfigs() {
  try {
    const rows = await base44.entities.PlayerCommand.filter({ type: PLAYER_CONFIG_TYPE });
    const sorted = [...(rows || [])].sort((a, b) => new Date(b.createdAt || b.created_date || 0) - new Date(a.createdAt || a.created_date || 0));
    const byPlayer = {};
    for (const row of sorted) {
      const playerId = row.playerId || row.targetPlayerId;
      if (!playerId || byPlayer[playerId]) continue;
      byPlayer[playerId] = row.payload || {};
    }
    return byPlayer;
  } catch (error) {
    console.warn('Could not load player configs', error);
    return {};
  }
}

export async function savePlayerConfig(player, config) {
  const playerId = player?.id || config?.playerId;
  if (!playerId) throw new Error('Player fehlt.');
  const payload = {
    playerId,
    playerName: player?.name || config?.playerName || '',
    providerId: config.providerId || '',
    apiId: config.providerId || '',
    providerName: config.providerName || '',
    spotifyClientId: config.spotifyClientId || '',
    zoneId: config.zoneId || '',
    zoneName: config.zoneName || '',
    updatedAt: new Date().toISOString(),
  };
  await base44.entities.PlayerCommand.create({
    playerId,
    targetPlayerId: playerId,
    type: PLAYER_CONFIG_TYPE,
    command: PLAYER_CONFIG_TYPE,
    payload,
    status: 'success',
    createdAt: new Date().toISOString(),
    completedAt: new Date().toISOString(),
    humanMessage: 'Player setup configuration saved.',
  });
  return payload;
}

export function mergePlayerWithConfig(player, config) {
  const providerId = player?.providerId || player?.apiCredentialSetId || player?.spotifyAccountId || config?.providerId || config?.apiId || '';
  return {
    ...(player || {}),
    providerId,
    apiCredentialSetId: providerId,
    spotifyAccountId: providerId,
    spotifyClientId: player?.spotifyClientId || config?.spotifyClientId || '',
    zoneId: player?.zoneId || config?.zoneId || '',
    zoneName: config?.zoneName || '',
  };
}
