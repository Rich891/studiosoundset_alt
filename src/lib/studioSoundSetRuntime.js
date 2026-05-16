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

export const PLAYER_STALE_AFTER_MS = 20000;
export const PLAYER_HEARTBEAT_INTERVAL_MS = 5000;
export const PLAYER_COMMAND_POLL_INTERVAL_MS = 3000;
export const ADMIN_LIVE_REFETCH_INTERVAL_MS = 5000;
export const ADMIN_TIMEOUT_SWEEP_INTERVAL_MS = 15000;
export const COMMAND_PENDING_TIMEOUT_MS = 20000;
export const COMMAND_PICKED_UP_TIMEOUT_MS = 30000;

export function nowIso() {
  return new Date().toISOString();
}

export function isRateLimitError(error) {
  return error?.status === 429
    || error?.response?.status === 429
    || /status code 429|\b429\b|rate limit|too many requests/i.test(error?.message || '');
}

export function isForbiddenError(error) {
  return error?.status === 403
    || error?.response?.status === 403
    || /status code 403|\b403\b|forbidden/i.test(error?.message || '');
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

function isMissingFunctionError(error) {
  return error?.status === 404 || error?.response?.status === 404 || /status code 404|not found/i.test(error?.message || '');
}

function runtimeDiagnosticError(action, error) {
  const diagnostic = new Error(
    `Backend-Funktion publicPlayerRuntime ist in der veroeffentlichten Base44-App nicht erreichbar (${action}). GitHub-Code ist vorhanden, aber Base44 hat die Function nicht deployed oder nicht registriert.`
  );
  diagnostic.errorCode = 'PUBLIC_PLAYER_RUNTIME_NOT_DEPLOYED';
  diagnostic.technicalMessage = error?.message || String(error || 'missing function');
  diagnostic.suggestedFix = 'publicPlayerRuntime in Base44 Functions deployen/registrieren und danach Player-Link neu oeffnen.';
  return diagnostic;
}

function rateLimitDiagnosticError(action, error) {
  const diagnostic = new Error(`Base44 Rate Limit erreicht (${action}). Synchronisation wird automatisch gedrosselt.`);
  diagnostic.errorCode = 'RATE_LIMITED';
  diagnostic.technicalMessage = error?.message || String(error || 'rate limit');
  diagnostic.suggestedFix = 'Weniger Admin/Player Tabs offen lassen oder kurz warten. Die App reduziert die Polling-Frequenz automatisch.';
  return diagnostic;
}

function forbiddenDiagnosticError(action, error) {
  const diagnostic = new Error(`Runtime Session wurde vom Backend abgelehnt (${action}). Oeffne im Admin den Player-Link/QR-Code neu und lade den Player auf dem Geraet neu.`);
  diagnostic.errorCode = 'RUNTIME_SESSION_FORBIDDEN';
  diagnostic.technicalMessage = error?.message || String(error || 'forbidden');
  diagnostic.suggestedFix = 'Im Admin bei diesem Player auf Player-Link/QR klicken, den neuen Link auf dem Player-Geraet oeffnen und alte Player-Tabs schliessen.';
  return diagnostic;
}

async function playerCommandControl(action, payload = {}) {
  let response;
  try {
    response = await base44.functions.invoke('playerCommandControl', { action, payload });
  } catch (error) {
    if (isRateLimitError(error)) throw rateLimitDiagnosticError(`playerCommandControl:${action}`, error);
    if (isForbiddenError(error)) throw forbiddenDiagnosticError(`playerCommandControl:${action}`, error);
    throw error;
  }
  if (!response.data?.success) {
    const error = new Error(response.data?.error || `playerCommandControl ${action} failed.`);
    error.errorCode = response.data?.errorCode || 'PLAYER_COMMAND_CONTROL_FAILED';
    throw error;
  }
  return response.data;
}

export async function listPlayerCommands(playerId = '') {
  const result = await playerCommandControl('list', playerId ? { playerId } : {});
  return result.commands || [];
}

export async function createPlayerCommand(player, type, payload = {}) {
  if (!player?.id) throw new Error('PLAYER_MISSING');
  const result = await playerCommandControl('create', {
    playerId: player.id,
    providerId: player.providerId || player.spotifyAccountId || player.apiCredentialSetId || '',
    zoneId: player.zoneId || '',
    type,
    command: type,
    payload,
    humanMessage: 'Command sent. Waiting for Player acknowledgement.',
  });
  return result.command;
}

export async function markStalePendingCommands(playerId) {
  try {
    await playerCommandControl('markTimeouts', {
      playerId,
      pendingTimeoutMs: COMMAND_PENDING_TIMEOUT_MS,
      pickedUpTimeoutMs: COMMAND_PICKED_UP_TIMEOUT_MS,
    });
  } catch (error) {
    console.warn('Could not mark stale commands:', error);
  }
}

export async function getLastCommandForPlayer(playerId) {
  try {
    const commands = await listPlayerCommands(playerId);
    return [...commands].sort((a, b) => new Date(b.createdAt || b.created_date || 0) - new Date(a.createdAt || a.created_date || 0))[0] || null;
  } catch (error) {
    return null;
  }
}

export function normalizeSpotifyState(state, player, extra = {}) {
  const track = state?.track_window?.current_track;
  const contextUri = state?.context?.uri || state?.track_window?.current_context?.uri || '';
  return {
    isPlaying: state ? !state.paused : !!extra.isPlaying,
    progressMs: state?.position ?? extra.progressMs ?? 0,
    currentTrackDuration: track?.duration_ms || extra.durationMs || extra.currentTrackDuration || 0,
    durationMs: track?.duration_ms || extra.durationMs || extra.currentTrackDuration || 0,
    currentTrackName: track?.name || extra.currentTrackName || '',
    currentTrackArtist: track?.artists?.map((a) => a.name).join(', ') || extra.currentTrackArtist || '',
    currentTrackAlbum: track?.album?.name || extra.currentTrackAlbum || '',
    currentTrackCoverUrl: track?.album?.images?.[0]?.url || extra.currentTrackCoverUrl || '',
    currentTrackUri: track?.uri || extra.currentTrackUri || '',
    currentPlaylistUri: contextUri || extra.currentPlaylistUri || '',
    playbackStateAvailable: !!state,
    lastStatusUpdate: nowIso(),
    lastSeen: nowIso(),
    lastHeartbeatAt: nowIso(),
    isOnline: true,
    sdkLoaded: true,
    ...extra,
  };
}

function getStoredPlayerSessionToken(player) {
  return player?.sessionToken || localStorage.getItem('playerSessionToken') || player?.setupToken || '';
}

export async function publicPlayerRuntime(action, { playerId, sessionToken, payload = {} } = {}) {
  let response;
  try {
    response = await base44.functions.invoke('publicPlayerRuntime', {
      action,
      playerId,
      sessionToken,
      payload,
    });
  } catch (error) {
    if (isMissingFunctionError(error)) throw runtimeDiagnosticError(action, error);
    if (isRateLimitError(error)) throw rateLimitDiagnosticError(`publicPlayerRuntime:${action}`, error);
    if (isForbiddenError(error)) throw forbiddenDiagnosticError(`publicPlayerRuntime:${action}`, error);
    throw error;
  }

  if (!response.data?.success) {
    const error = new Error(response.data?.error || `publicPlayerRuntime ${action} failed.`);
    error.errorCode = response.data?.errorCode || 'PUBLIC_PLAYER_RUNTIME_FAILED';
    error.technicalMessage = response.data?.technicalMessage || '';
    error.suggestedFix = response.data?.suggestedFix || '';
    throw error;
  }
  return response.data;
}

export async function bootstrapPublicPlayer(player) {
  return publicPlayerRuntime('bootstrap', {
    playerId: player?.id,
    sessionToken: getStoredPlayerSessionToken(player),
  });
}

export async function pollPublicPlayerCommands(player) {
  return publicPlayerRuntime('pollCommands', {
    playerId: player?.id,
    sessionToken: getStoredPlayerSessionToken(player),
  });
}

export async function sendPublicPlayerCommandResult(player, payload) {
  return publicPlayerRuntime('commandResult', {
    playerId: player?.id,
    sessionToken: getStoredPlayerSessionToken(player),
    payload,
  });
}

export async function listPublicPlayerPlaylists(player) {
  return publicPlayerRuntime('listPlaylists', {
    playerId: player?.id,
    sessionToken: getStoredPlayerSessionToken(player),
  });
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

  const effectiveDeviceId = spotifyDeviceId || player.spotifyDeviceId || '';
  const effectiveSdkReady = Boolean(sdkReady || extra.sdkReady || effectiveDeviceId || sdkPlayer);
  const effectiveSdkConnected = Boolean(sdkConnected || extra.sdkConnected || effectiveSdkReady);
  const updateData = normalizeSpotifyState(state, player, {
    spotifyDeviceId: effectiveDeviceId,
    sdkReady: effectiveSdkReady,
    sdkConnected: effectiveSdkConnected,
    volume: Number.isFinite(volume) ? volume : player.volume || 50,
    ...extra,
  });

  const runtime = await publicPlayerRuntime('heartbeat', {
    playerId: player.id,
    sessionToken: getStoredPlayerSessionToken(player),
    payload: updateData,
  });
  return { state, updateData, runtime };
}

export function spotifyCommandError(code, humanMessage, technicalMessage) {
  const err = new Error(humanMessage);
  err.errorCode = code;
  err.humanMessage = humanMessage;
  err.technicalMessage = technicalMessage || humanMessage;
  return err;
}
