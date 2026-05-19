import { isPlayerOnline } from '@/lib/studioSoundSetRuntime';
import { getPlayerProviderId } from '@/lib/playerAssignments';

export function getPlayerTrackName(player = {}) {
  if (typeof player.currentTrack === 'string') return player.currentTrack;
  return player.currentTrackName
    || player.currentTrackTitle
    || player.trackName
    || player.nowPlayingTrack
    || player.currentTrack?.name
    || '';
}

export function getPlayerTrackArtist(player = {}) {
  return player.currentTrackArtist
    || player.currentArtist
    || player.artist
    || player.trackArtist
    || player.currentTrack?.artist
    || player.currentTrack?.artists?.map?.((artist) => artist.name).join(', ')
    || '';
}

export function getPlayerTrackAlbum(player = {}) {
  return player.currentTrackAlbum
    || player.currentAlbum
    || player.album
    || player.trackAlbum
    || player.currentTrack?.album?.name
    || '';
}

export function getPlayerCoverUrl(player = {}) {
  return player.currentTrackCoverUrl
    || player.currentCoverUrl
    || player.coverUrl
    || player.albumCoverUrl
    || player.currentTrack?.coverUrl
    || player.currentTrack?.album?.images?.[0]?.url
    || '';
}

export function getPlayerProgressMs(player = {}) {
  const value = player.progressMs ?? player.positionMs ?? player.currentPositionMs ?? player.position ?? 0;
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

export function getPlayerDurationMs(player = {}) {
  const value = player.durationMs ?? player.currentTrackDuration ?? player.currentDurationMs ?? player.duration ?? 0;
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

export function getPlayerVolume(player = {}) {
  const value = player.currentVolume ?? player.volume ?? player.volumePercent ?? 0;
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

export function normalizePlayerLiveState(player = {}) {
  const providerId = getPlayerProviderId(player);
  const trackName = getPlayerTrackName(player);
  const progressMs = getPlayerProgressMs(player);
  const durationMs = getPlayerDurationMs(player);
  return {
    id: player.id || '',
    name: player.name || 'Player',
    providerId,
    online: isPlayerOnline(player),
    lastSeen: player.lastSeen || player.lastHeartbeatAt || player.lastStatusUpdate || '',
    lastHeartbeatAt: player.lastHeartbeatAt || player.lastSeen || player.lastStatusUpdate || '',
    sdkLoaded: Boolean(player.sdkLoaded || player.sdkReady || player.spotifyDeviceId),
    sdkReady: Boolean(player.sdkReady || player.spotifyDeviceId),
    sdkConnected: Boolean(player.sdkConnected || player.sdkReady || player.spotifyDeviceId),
    spotifyDeviceId: player.spotifyDeviceId || player.deviceId || '',
    trackName,
    artist: getPlayerTrackArtist(player),
    album: getPlayerTrackAlbum(player),
    coverUrl: getPlayerCoverUrl(player),
    currentTrackUri: player.currentTrackUri || player.trackUri || player.currentTrack?.uri || '',
    currentPlaylistUri: player.currentPlaylistUri || player.currentContextUri || player.contextUri || '',
    progressMs,
    durationMs,
    progressPct: durationMs ? Math.min(100, Math.max(0, Math.round((progressMs / durationMs) * 100))) : 0,
    isPlaying: Boolean(player.isPlaying),
    volume: getPlayerVolume(player),
    playbackStateAvailable: Boolean(player.playbackStateAvailable || trackName),
    lastCommand: player.lastCommand || '',
    lastCommandStatus: player.lastCommandStatus || '',
    lastError: player.lastError || player.error || '',
    raw: player,
  };
}
