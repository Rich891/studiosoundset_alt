const STORAGE_KEY = 'sss_player_configs_v2';

function readStore() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {}; }
  catch { return {}; }
}

function writeStore(store) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  return store;
}

export function getProviderIdFromConfig(config) {
  return config?.providerId || config?.apiId || '';
}

export async function listPlayerConfigs() {
  return readStore();
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
  const store = readStore();
  store[playerId] = payload;
  writeStore(store);
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
