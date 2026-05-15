export function getPlayerProviderId(player = {}, zone = {}) {
  return player.apiCredentialSetId
    || player.providerId
    || player.spotifyAccountId
    || player.accountId
    || zone?.apiCredentialSetId
    || zone?.providerId
    || zone?.spotifyAccountId
    || '';
}

export function getPlayerProviderAssignmentState(player = {}, zone = {}) {
  const playerProviderId = player.apiCredentialSetId || player.providerId || player.spotifyAccountId || player.accountId || '';
  const legacyZoneProviderId = zone?.apiCredentialSetId || zone?.providerId || zone?.spotifyAccountId || '';

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

  if (legacyZoneProviderId) {
    return {
      providerId: legacyZoneProviderId,
      source: 'zone_legacy',
      status: 'legacy_zone_assignment',
      label: 'Legacy-Zonen-Zuweisung',
      message: 'Diese API-Verbindung liegt noch an der Zone. Verschiebe sie auf den Player, damit der Flow eindeutig ist.',
      needsRepair: true,
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
    // In the current Base44 app Provider is also the connected Spotify account record.
    // Keep this alias for backwards compatibility until a separate SpotifyPlayerAccount entity exists.
    spotifyAccountId: providerId || '',
    updatedAt: new Date().toISOString(),
  };
}
