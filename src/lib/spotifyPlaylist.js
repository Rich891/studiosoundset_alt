export function parseSpotifyPlaylistInput(input) {
  const value = String(input || '').trim();
  if (!value) return null;

  const uriMatch = value.match(/^spotify:playlist:([A-Za-z0-9]+)$/);
  if (uriMatch) return uriMatch[1];

  const urlMatch = value.match(/open\.spotify\.com\/playlist\/([A-Za-z0-9]+)/);
  if (urlMatch) return urlMatch[1];

  if (/^[A-Za-z0-9]{15,}$/.test(value)) return value;
  return null;
}

export function toSpotifyPlaylistUri(input) {
  const playlistId = parseSpotifyPlaylistInput(input);
  return playlistId ? `spotify:playlist:${playlistId}` : null;
}

export function getPlaylistTrackTotal(playlist) {
  return playlist?.tracks?.total ?? playlist?.items?.total ?? playlist?.totalTracks ?? 0;
}

export function getPlaylistCover(playlist) {
  return playlist?.images?.[0]?.url || playlist?.coverUrl || '';
}

export function normalizeImportedPlaylist(spotifyPlaylist, provider, player) {
  const playlistId = spotifyPlaylist.id || parseSpotifyPlaylistInput(spotifyPlaylist.uri);
  return {
    providerId: provider.id,
    spotifyAccountId: provider.id,
    playerId: player?.id || '',
    zoneId: player?.zoneId || '',
    providerPlaylistId: playlistId,
    providerPlaylistUri: spotifyPlaylist.uri || `spotify:playlist:${playlistId}`,
    externalUrl: spotifyPlaylist.external_urls?.spotify || `https://open.spotify.com/playlist/${playlistId}`,
    name: spotifyPlaylist.name || 'Untitled playlist',
    description: spotifyPlaylist.description || '',
    owner: spotifyPlaylist.owner?.display_name || spotifyPlaylist.owner?.id || '',
    coverUrl: getPlaylistCover(spotifyPlaylist),
    totalTracks: getPlaylistTrackTotal(spotifyPlaylist),
    importedTracks: spotifyPlaylist.importedTracks || 0,
    metadataSyncStatus: 'success',
    trackSyncStatus: 'loading',
    syncStatus: 'pending',
    lastSyncAt: new Date().toISOString(),
  };
}
