import { base44 } from '@/api/base44Client';

export const COMMAND = {
  GET_STATE: 'GET_STATE',
  PAUSE: 'PAUSE',
  RESUME: 'RESUME',
  SKIP_NEXT: 'SKIP_NEXT',
  SKIP_PREVIOUS: 'SKIP_PREVIOUS',
  SET_VOLUME: 'SET_VOLUME',
  PLAY_PLAYLIST: 'PLAY_PLAYLIST',
};

export const COMMAND_STATUS = {
  PENDING: 'pending',
  PICKED_UP: 'picked_up',
  SUCCESS: 'success',
  FAILED: 'failed',
  TIMEOUT: 'timeout',
};

export const PLAYER_STALE_AFTER_MS = 10000;

export function nowIso() {
  return new Date().toISOString();
}

export function isPlayerOnline(player) {
  const timestamp = player?.lastSeen || player?.lastHeartbeatAt || player?.lastStatusUpdate;
  if (!timestamp) return false;
  return Date.now() - new Date(timestamp).getTime() < PLAYER_STALE_AFTER_MS;
}

export function formatMs(ms) {
  if (!Number.isFinite(ms) || ms <= 0) return '0:00';
  const s = Math.floor(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

export async function createPlayerCommand(player, type, payload = {}) {
  if (!player?.id) throw new Error('PLAYER_MISSING');
  const createdAt = nowIso();
  return base44.entities.PlayerCommand.create({
    playerId: player.id,
    providerId: player.providerId || player.spotifyAccountId || '',
    zoneId: player.zoneId || '',
    type,
    command: type,
    payload,
    status: COMMAND_STATUS.PENDING,
    createdAt,
    humanMessage: 'Command sent. Waiting for Player acknowledgement.',
  });
}

export async function markStalePendingCommands(playerId) {
  try {
    const pending = await base44.entities.PlayerCommand.filter({ playerId, status: COMMAND_STATUS.PENDING });
    const cutoff = Date.now() - PLAYER_STALE_AFTER_MS;
    await Promise.all(
      pending
        .filter((cmd) => new Date(cmd.createdAt || cmd.created_date || 0).getTime() < cutoff)
        .map((cmd) => base44.entities.PlayerCommand.update(cmd.id, {
          status: COMMAND_STATUS.TIMEOUT,
          completedAt: nowIso(),
          errorCode: 'COMMAND_TIMEOUT',
          humanMessage: 'The Player did not pick up this command in time. Open the Player screen and wait until it is online.',
          technicalMessage: 'No PlayerCommand pickup before timeout window.',
        }))
    );
  } catch (error) {
    console.warn('Could not mark stale commands:', error);
  }
}

export async function getLastCommandForPlayer(playerId) {
  try {
    const commands = await base44.entities.PlayerCommand.filter({ playerId });
    return [...commands].sort((a, b) => new Date(b.createdAt || b.created_date || 0) - new Date(a.createdAt || a.created_date || 0))[0] || null;
  } catch (error) {
    return null;
  }
}

export function normalizeSpotifyState(state, player, extra = {}) {
  const track = state?.track_window?.current_track;
  const contextUri = state?.context?.uri || state?.track_window?.current_context?.uri || '';
  return {
    isPlaying: state ? !state.paused : false,
    progressMs: state?.position || 0,
    currentTrackDuration: track?.duration_ms || 0,
    durationMs: track?.duration_ms || 0,
    currentTrackName: track?.name || '',
    currentTrackArtist: track?.artists?.map((a) => a.name).join(', ') || '',
    currentTrackAlbum: track?.album?.name || '',
    currentTrackCoverUrl: track?.album?.images?.[0]?.url || '',
    currentTrackUri: track?.uri || '',
    currentPlaylistUri: contextUri,
    playbackStateAvailable: !!state,
    lastStatusUpdate: nowIso(),
    lastSeen: nowIso(),
    lastHeartbeatAt: nowIso(),
    isOnline: true,
    sdkLoaded: true,
    ...extra,
  };
}

export async function syncPlayerStatusFromSdk({ sdkPlayer, player, spotifyDeviceId, sdkReady, sdkConnected, extra = {} }) {
  if (!player?.id) return null;
  let state = null;
  try {
    state = sdkPlayer?.getCurrentState ? await sdkPlayer.getCurrentState() : null;
  } catch (error) {
    console.warn('getCurrentState failed:', error);
  }

  let volume = extra.volume;
  try {
    if (sdkPlayer?.getVolume) {
      const sdkVolume = await sdkPlayer.getVolume();
      volume = Math.round(sdkVolume * 100);
    }
  } catch {}

  const updateData = normalizeSpotifyState(state, player, {
    spotifyDeviceId: spotifyDeviceId || player.spotifyDeviceId || '',
    sdkReady: !!sdkReady,
    sdkConnected: !!sdkConnected,
    volume: Number.isFinite(volume) ? volume : player.volume || 50,
    ...extra,
  });

  await base44.entities.Player.update(player.id, updateData);
  return { state, updateData };
}

export function spotifyCommandError(code, humanMessage, technicalMessage) {
  const err = new Error(humanMessage);
  err.errorCode = code;
  err.humanMessage = humanMessage;
  err.technicalMessage = technicalMessage || humanMessage;
  return err;
}
