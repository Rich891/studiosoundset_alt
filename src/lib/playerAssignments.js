export function getPlayerProviderId(player = {}) {
  return player.providerId
    || player.apiCredentialSetId
    || player.spotifyAccountId
    || player.accountId
    || '';
}

export function getPlayerProviderAssignmentState(player = {}) {
  const playerProviderId = getPlayerProviderId(player);

  if (playerProviderId) {
    return {
      providerId: playerProviderId,
      source: 'player',
      status: player.spotifyAccountId ? 'spotify_connected_or_assigned' : 'api_assigned',
      label: player.spotifyAccountId ? 'Spotify-Konto / API am Player' : 'API-Verbindung am Player',
      message: 'API-Verbindung ist direkt am Player gespeichert.',
      needsRepair: false,
    };
  }

  return {
    providerId: '',
    source: 'missing',
    status: 'missing',
    label: 'Keine API-Verbindung',
    message: 'Diesem Player ist noch keine API-Verbindung zugewiesen.',
    needsRepair: true,
  };
}

export function getProviderDisplayName(provider) {
  return provider?.name || provider?.displayName || provider?.spotifyDisplayName || '—';
}

export function providerStatus(provider) {
  return provider?.status || provider?.authStatus || provider?.tokenStatus || 'disconnected';
}

export function buildPlayerProviderPatch(providerId) {
  return {
    providerId: providerId || '',
    apiCredentialSetId: providerId || '',
    spotifyAccountId: providerId || '',
    updatedAt: new Date().toISOString(),
  };
}
