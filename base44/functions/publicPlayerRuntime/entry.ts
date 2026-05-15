import { createClientFromRequest } from "npm:@base44/sdk";

const COMMAND_STATUS = {
  PENDING: "pending",
  PICKED_UP: "picked_up",
  SUCCESS: "success",
  FAILED: "failed",
  TIMEOUT: "timeout",
};

const TOKEN_URL = "https://accounts.spotify.com/api/token";
const ALLOWED_ACTIONS = [
  "bootstrap",
  "heartbeat",
  "pollCommands",
  "commandResult",
  "getAccessToken",
  "playPlaylist",
  "listPlaylists",
];

function json(data: unknown, init?: ResponseInit) {
  return Response.json(data, {
    ...init,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
      ...(init?.headers || {}),
    },
  });
}

function nowIso() {
  return new Date().toISOString();
}

function tokenExpiresSoon(provider: Record<string, any>) {
  if (!provider.accessToken) return true;
  if (!provider.tokenExpiresAt) return false;
  return new Date(provider.tokenExpiresAt).getTime() < Date.now() + 30000;
}

function tokenExpiryIso(expiresInSeconds = 3600) {
  return new Date(Date.now() + Math.max(60, Number(expiresInSeconds) - 60) * 1000).toISOString();
}

function pickPlayerPublic(player: Record<string, any>) {
  return {
    id: player.id,
    name: player.name || "StudioSoundSet Player",
    email: player.email || "",
    providerId: player.providerId || "",
    zoneId: player.zoneId || "",
    isActive: player.isActive !== false,
    isOnline: !!player.isOnline,
    sdkReady: !!player.sdkReady,
    sdkConnected: !!player.sdkConnected,
    spotifyDeviceId: player.spotifyDeviceId || "",
    currentTrackName: player.currentTrackName || "",
    currentTrackArtist: player.currentTrackArtist || "",
    currentTrackAlbum: player.currentTrackAlbum || "",
    currentTrackCoverUrl: player.currentTrackCoverUrl || "",
    isPlaying: !!player.isPlaying,
    volume: Number.isFinite(Number(player.volume)) ? Number(player.volume) : 50,
    lastError: player.lastError || "",
    lastSeen: player.lastSeen || "",
    lastHeartbeatAt: player.lastHeartbeatAt || "",
  };
}

function pickProviderPublic(provider: Record<string, any> | null) {
  if (!provider) return null;
  return {
    id: provider.id,
    name: provider.name || provider.displayName || "Spotify Provider",
    displayName: provider.displayName || provider.name || "Spotify Provider",
    status: provider.status || provider.authStatus || "disconnected",
    authStatus: provider.authStatus || provider.status || "disconnected",
    tokenStatus: provider.tokenStatus || "",
    spotifyUserEmail: provider.spotifyUserEmail || "",
    spotifyDisplayName: provider.spotifyDisplayName || "",
  };
}

function pickPlaylistPublic(playlist: Record<string, any>) {
  return {
    id: playlist.id,
    playerId: playlist.playerId || "",
    providerId: playlist.providerId || playlist.spotifyAccountId || "",
    zoneId: playlist.zoneId || "",
    name: playlist.name || "Spotify Playlist",
    coverUrl: playlist.coverUrl || "",
    importedTracks: Number(playlist.importedTracks || 0),
    totalTracks: Number(playlist.totalTracks || 0),
    providerPlaylistUri: playlist.providerPlaylistUri || playlist.spotifyUri || playlist.uri || "",
    externalUrl: playlist.externalUrl || "",
    trackSyncStatus: playlist.trackSyncStatus || "",
    metadataSyncStatus: playlist.metadataSyncStatus || "",
  };
}

function sanitizeHeartbeat(payload: Record<string, any> = {}) {
  const updateData: Record<string, any> = {
    lastSeen: nowIso(),
    lastHeartbeatAt: nowIso(),
    isOnline: true,
    sdkReady: !!payload.sdkReady,
    sdkConnected: !!payload.sdkConnected,
    spotifyDeviceId: String(payload.spotifyDeviceId || ""),
    currentTrackName: String(payload.currentTrackName || ""),
    currentTrackArtist: String(payload.currentTrackArtist || ""),
    currentTrackAlbum: String(payload.currentTrackAlbum || ""),
    currentTrackCoverUrl: String(payload.currentTrackCoverUrl || ""),
    isPlaying: !!payload.isPlaying,
    lastError: String(payload.lastError || ""),
  };

  if (Number.isFinite(Number(payload.volume))) updateData.volume = Number(payload.volume);
  if (Number.isFinite(Number(payload.progressMs))) updateData.progressMs = Number(payload.progressMs);
  if (Number.isFinite(Number(payload.durationMs))) updateData.durationMs = Number(payload.durationMs);
  if (payload.currentTrackUri !== undefined) updateData.currentTrackUri = String(payload.currentTrackUri || "");
  if (payload.currentPlaylistUri !== undefined) updateData.currentPlaylistUri = String(payload.currentPlaylistUri || "");
  if (payload.playbackStateAvailable !== undefined) updateData.playbackStateAvailable = payload.playbackStateAvailable !== false;
  updateData.lastStatusUpdate = nowIso();

  return updateData;
}

async function findPlayer(base44: any, playerId: string) {
  if (!playerId) throw Object.assign(new Error("playerId fehlt."), { status: 400, code: "PLAYER_ID_MISSING" });
  const player = await base44.asServiceRole.entities.Player.get(playerId).catch(() => null);
  if (!player) throw Object.assign(new Error("Player nicht gefunden."), { status: 404, code: "PLAYER_NOT_FOUND" });
  return player;
}

function validatePlayerSession(player: Record<string, any>, sessionToken: string) {
  if (!sessionToken) throw Object.assign(new Error("sessionToken fehlt."), { status: 401, code: "SESSION_TOKEN_MISSING" });
  if (player.isActive === false) throw Object.assign(new Error("Player ist deaktiviert."), { status: 403, code: "PLAYER_INACTIVE" });
  const validTokens = [player.sessionToken, player.setupToken].filter(Boolean).map(String);
  if (!validTokens.includes(String(sessionToken))) {
    throw Object.assign(new Error("Player Session ist ungültig. Öffne den aktuellen Player-Link aus dem Admin."), { status: 403, code: "SESSION_TOKEN_INVALID" });
  }
}

async function loadProvider(base44: any, player: Record<string, any>) {
  if (!player.providerId) return null;
  return await base44.asServiceRole.entities.Provider.get(player.providerId).catch(() => null);
}

async function getProviderAccessToken(base44: any, provider: Record<string, any>) {
  if (!provider) throw Object.assign(new Error("Player hat keinen Provider."), { status: 400, code: "PROVIDER_MISSING" });
  if (!tokenExpiresSoon(provider)) return provider.accessToken;
  if (!provider.refreshToken || !provider.clientId) {
    throw Object.assign(new Error("Provider Token fehlt oder ist abgelaufen. Spotify Provider erneut verbinden."), { status: 401, code: "TOKEN_EXPIRED" });
  }

  const body = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: provider.refreshToken,
    client_id: provider.clientId,
  });

  const response = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw Object.assign(new Error(data.error_description || data.error || "Spotify Token Refresh fehlgeschlagen."), { status: 401, code: "TOKEN_REFRESH_FAILED" });
  }

  const patch = {
    accessToken: data.access_token,
    refreshToken: data.refresh_token || provider.refreshToken,
    tokenExpiresAt: tokenExpiryIso(data.expires_in),
    tokenStatus: "valid",
    status: "connected",
    authStatus: "connected",
    lastError: "",
    lastTokenRefreshAt: nowIso(),
  };
  await base44.asServiceRole.entities.Provider.update(provider.id, patch).catch(() => {});
  return patch.accessToken;
}

async function spotifyApi(path: string, { method = "GET", accessToken, body }: Record<string, any>) {
  const response = await fetch(`https://api.spotify.com/v1${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await response.text();
  const data = text ? JSON.parse(text) : null;
  if (!response.ok) {
    throw Object.assign(new Error(data?.error?.message || data?.error || `Spotify API failed (${response.status})`), { status: response.status, code: "SPOTIFY_API_FAILED" });
  }
  return data;
}

async function handleBootstrap(base44: any, player: Record<string, any>) {
  const provider = await loadProvider(base44, player);
  const zone = player.zoneId ? await base44.asServiceRole.entities.Zone.get(player.zoneId).catch(() => null) : null;
  await base44.asServiceRole.entities.Player.update(player.id, {
    lastSeen: nowIso(),
    lastHeartbeatAt: nowIso(),
    isOnline: true,
    lastError: player.providerId ? "" : "Player has no providerId assigned.",
  });
  return {
    success: true,
    player: pickPlayerPublic(player),
    provider: pickProviderPublic(provider),
    zone: zone ? { id: zone.id, name: zone.name || "", providerId: zone.providerId || "" } : null,
  };
}

async function handleHeartbeat(base44: any, player: Record<string, any>, payload: Record<string, any>) {
  const updateData = sanitizeHeartbeat(payload);
  await base44.asServiceRole.entities.Player.update(player.id, updateData);
  return { success: true, playerId: player.id, updatedAt: updateData.lastHeartbeatAt };
}

async function handleGetAccessToken(base44: any, player: Record<string, any>) {
  const provider = await loadProvider(base44, player);
  const accessToken = await getProviderAccessToken(base44, provider);
  return { success: true, accessToken, provider: pickProviderPublic(provider) };
}

async function handlePlayPlaylist(base44: any, player: Record<string, any>, payload: Record<string, any>) {
  const provider = await loadProvider(base44, player);
  const accessToken = await getProviderAccessToken(base44, provider);
  const deviceId = payload.deviceId || player.spotifyDeviceId;
  const contextUri = payload.contextUri || payload.playlistUri;
  if (!deviceId) throw Object.assign(new Error("Spotify Device ID fehlt."), { status: 400, code: "NO_SPOTIFY_DEVICE_ID" });
  if (!contextUri) throw Object.assign(new Error("Playlist URI fehlt."), { status: 400, code: "PLAYLIST_URI_MISSING" });
  await spotifyApi(`/me/player/play?device_id=${encodeURIComponent(deviceId)}`, {
    method: "PUT",
    accessToken,
    body: { context_uri: contextUri, ...(payload.offset ? { offset: payload.offset } : {}) },
  });
  return { success: true };
}

async function handleListPlaylists(base44: any, player: Record<string, any>) {
  if (!player.providerId) return { success: true, playlists: [] };
  const byProvider = await base44.asServiceRole.entities.Playlist.filter({ providerId: player.providerId }).catch(() => []);
  const bySpotifyAccount = await base44.asServiceRole.entities.Playlist.filter({ spotifyAccountId: player.providerId }).catch(() => []);
  const merged = [...byProvider, ...bySpotifyAccount];
  const seen = new Set<string>();
  const playlists = merged
    .filter((playlist: any) => {
      if (!playlist?.id || seen.has(playlist.id)) return false;
      seen.add(playlist.id);
      return !playlist.playerId || playlist.playerId === player.id || playlist.providerId === player.providerId || playlist.spotifyAccountId === player.providerId;
    })
    .map(pickPlaylistPublic)
    .sort((a: any, b: any) => String(a.name).localeCompare(String(b.name)));
  return { success: true, playlists };
}

async function handlePollCommands(base44: any, player: Record<string, any>) {
  const commands = await base44.asServiceRole.entities.PlayerCommand.filter({ playerId: player.id, status: COMMAND_STATUS.PENDING }).catch(() => []);
  const sorted = [...commands].sort((a: any, b: any) => new Date(a.createdAt || a.created_date || 0).getTime() - new Date(b.createdAt || b.created_date || 0).getTime());
  const command = sorted[0] || null;
  if (!command) return { success: true, command: null };

  await base44.asServiceRole.entities.PlayerCommand.update(command.id, {
    status: COMMAND_STATUS.PICKED_UP,
    pickedUpAt: nowIso(),
    humanMessage: "Player picked up command and is executing it.",
  });
  await base44.asServiceRole.entities.Player.update(player.id, {
    lastSeen: nowIso(),
    lastHeartbeatAt: nowIso(),
    isOnline: true,
    lastCommand: command.type || command.command || "",
    lastCommandStatus: COMMAND_STATUS.PICKED_UP,
    lastError: "",
  });

  return {
    success: true,
    command: {
      id: command.id,
      playerId: command.playerId,
      providerId: command.providerId || player.providerId || "",
      zoneId: command.zoneId || player.zoneId || "",
      type: command.type || command.command,
      command: command.command || command.type,
      payload: command.payload || {},
      createdAt: command.createdAt || command.created_date || "",
    },
  };
}

async function handleCommandResult(base44: any, player: Record<string, any>, payload: Record<string, any>) {
  const commandId = payload.commandId;
  if (!commandId) throw Object.assign(new Error("commandId fehlt."), { status: 400, code: "COMMAND_ID_MISSING" });
  const command = await base44.asServiceRole.entities.PlayerCommand.get(commandId).catch(() => null);
  if (!command || command.playerId !== player.id) {
    throw Object.assign(new Error("Command gehört nicht zu diesem Player."), { status: 403, code: "COMMAND_FORBIDDEN" });
  }

  const status = payload.status === COMMAND_STATUS.SUCCESS ? COMMAND_STATUS.SUCCESS : COMMAND_STATUS.FAILED;
  const patch = {
    status,
    completedAt: nowIso(),
    result: payload.result || {},
    errorCode: payload.errorCode || "",
    humanMessage: payload.humanMessage || (status === COMMAND_STATUS.SUCCESS ? "Command confirmed by Player." : "Command failed on Player."),
    technicalMessage: payload.technicalMessage || "",
    suggestedFix: payload.suggestedFix || "",
  };
  await base44.asServiceRole.entities.PlayerCommand.update(command.id, patch);
  await base44.asServiceRole.entities.Player.update(player.id, {
    lastSeen: nowIso(),
    lastHeartbeatAt: nowIso(),
    isOnline: true,
    lastCommand: command.type || command.command || "",
    lastCommandStatus: status,
    lastError: status === COMMAND_STATUS.SUCCESS ? "" : patch.humanMessage,
    lastCommandCompletedAt: nowIso(),
  });
  return { success: true, commandId: command.id, status };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return json({ ok: true });
  if (req.method !== "POST") return json({ success: false, error: "Method not allowed" }, { status: 405 });

  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));
    const { action, playerId, sessionToken, payload = {} } = body;

    if (!ALLOWED_ACTIONS.includes(action)) {
      return json({ success: false, errorCode: "ACTION_INVALID", error: "Invalid publicPlayerRuntime action." }, { status: 400 });
    }

    const player = await findPlayer(base44, playerId);
    validatePlayerSession(player, sessionToken);

    if (action === "bootstrap") return json(await handleBootstrap(base44, player));
    if (action === "heartbeat") return json(await handleHeartbeat(base44, player, payload));
    if (action === "pollCommands") return json(await handlePollCommands(base44, player));
    if (action === "commandResult") return json(await handleCommandResult(base44, player, payload));
    if (action === "getAccessToken") return json(await handleGetAccessToken(base44, player));
    if (action === "playPlaylist") return json(await handlePlayPlaylist(base44, player, payload));
    if (action === "listPlaylists") return json(await handleListPlaylists(base44, player));
  } catch (error) {
    const status = Number(error?.status || 500);
    return json({ success: false, errorCode: error?.code || "PUBLIC_PLAYER_RUNTIME_ERROR", error: error?.message || "publicPlayerRuntime failed." }, { status });
  }

  return json({ success: false, errorCode: "UNREACHABLE", error: "Unhandled action." }, { status: 500 });
});
