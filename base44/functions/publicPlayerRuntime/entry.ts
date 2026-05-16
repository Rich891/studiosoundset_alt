import { createClientFromRequest } from "npm:@base44/sdk";

const COMMAND_STATUS = { PENDING: "pending", PICKED_UP: "picked_up", SUCCESS: "success", FAILED: "failed", TIMEOUT: "timeout" };
const TOKEN_URL = "https://accounts.spotify.com/api/token";
const STORE_KEY = "player_command_store_v1";
const MAX_COMMANDS = 500;
const ALLOWED_ACTIONS = ["bootstrap", "heartbeat", "pollCommands", "commandResult", "getAccessToken", "playPlaylist", "listPlaylists"];

function json(data: unknown, init?: ResponseInit) {
  return Response.json(data, { ...init, headers: { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "POST, OPTIONS", "Access-Control-Allow-Headers": "Content-Type, Authorization", ...(init?.headers || {}) } });
}
function nowIso() { return new Date().toISOString(); }
function runtimeSessionKey(playerId: string) { return `player_runtime_session_${playerId}`; }

async function readSetting(base44: any, key: string) {
  const rows = await base44.asServiceRole.entities.AppSetting.filter({ key }).catch(() => []);
  return rows[0] || null;
}
async function getRuntimeSession(base44: any, playerId: string) {
  const row = await readSetting(base44, runtimeSessionKey(playerId));
  const raw = row?.value;
  if (!raw) return null;
  try { return typeof raw === "string" ? JSON.parse(raw) : raw; } catch { return { sessionToken: String(raw) }; }
}
async function readCommands(base44: any) {
  const row = await readSetting(base44, STORE_KEY);
  const raw = row?.value;
  if (!raw) return [];
  try { const parsed = typeof raw === "string" ? JSON.parse(raw) : raw; return Array.isArray(parsed) ? parsed : []; } catch { return []; }
}
async function writeCommands(base44: any, commands: any[]) {
  const trimmed = [...commands].sort((a, b) => new Date(b.createdAt || b.created_date || 0).getTime() - new Date(a.createdAt || a.created_date || 0).getTime()).slice(0, MAX_COMMANDS);
  const row = await readSetting(base44, STORE_KEY);
  const payload = { key: STORE_KEY, value: JSON.stringify(trimmed), category: "player_commands", updatedAt: nowIso() };
  if (row?.id) await base44.asServiceRole.entities.AppSetting.update(row.id, payload);
  else await base44.asServiceRole.entities.AppSetting.create({ ...payload, createdAt: nowIso() });
  return trimmed;
}

function resolveProviderId(player: Record<string, any>, runtimeSession?: Record<string, any> | null) {
  return String(player.providerId || player.apiCredentialSetId || player.spotifyAccountId || runtimeSession?.providerId || runtimeSession?.apiCredentialSetId || runtimeSession?.spotifyAccountId || "");
}
function resolveZoneId(player: Record<string, any>, runtimeSession?: Record<string, any> | null) {
  return String(player.zoneId || runtimeSession?.zoneId || "");
}
function applyRuntimeContext(player: Record<string, any>, runtimeSession?: Record<string, any> | null) {
  const providerId = resolveProviderId(player, runtimeSession);
  const zoneId = resolveZoneId(player, runtimeSession);
  return { ...player, providerId, apiCredentialSetId: player.apiCredentialSetId || providerId, spotifyAccountId: player.spotifyAccountId || providerId, zoneId };
}
function tokenExpiresSoon(provider: Record<string, any>) {
  if (!provider.accessToken) return true;
  if (!provider.tokenExpiresAt) return false;
  return new Date(provider.tokenExpiresAt).getTime() < Date.now() + 30000;
}
function tokenExpiryIso(expiresInSeconds = 3600) {
  return new Date(Date.now() + Math.max(60, Number(expiresInSeconds) - 60) * 1000).toISOString();
}
function pickPlayerPublic(player: Record<string, any>, runtimeSession?: Record<string, any> | null) {
  const p = applyRuntimeContext(player, runtimeSession);
  return {
    id: p.id,
    name: p.name || "StudioSoundSet Player",
    email: p.email || "",
    providerId: p.providerId || "",
    zoneId: p.zoneId || "",
    isActive: p.isActive !== false,
    isOnline: !!p.isOnline,
    sdkReady: !!p.sdkReady,
    sdkConnected: !!p.sdkConnected,
    spotifyDeviceId: p.spotifyDeviceId || "",
    currentTrackName: p.currentTrackName || "",
    currentTrackArtist: p.currentTrackArtist || "",
    currentTrackAlbum: p.currentTrackAlbum || "",
    currentTrackCoverUrl: p.currentTrackCoverUrl || "",
    currentTrackUri: p.currentTrackUri || "",
    currentPlaylistUri: p.currentPlaylistUri || "",
    progressMs: Number(p.progressMs || 0),
    durationMs: Number(p.durationMs || p.currentTrackDuration || 0),
    currentTrackDuration: Number(p.currentTrackDuration || p.durationMs || 0),
    isPlaying: !!p.isPlaying,
    volume: Number.isFinite(Number(p.volume)) ? Number(p.volume) : 50,
    lastCommand: p.lastCommand || "",
    lastCommandStatus: p.lastCommandStatus || "",
    lastError: p.lastError || "",
    lastSeen: p.lastSeen || "",
    lastHeartbeatAt: p.lastHeartbeatAt || "",
    lastStatusUpdate: p.lastStatusUpdate || "",
  };
}
function pickProviderPublic(provider: Record<string, any> | null) {
  if (!provider) return null;
  return { id: provider.id, name: provider.name || provider.displayName || "Spotify Provider", displayName: provider.displayName || provider.name || "Spotify Provider", status: provider.status || provider.authStatus || "disconnected", authStatus: provider.authStatus || provider.status || "disconnected", tokenStatus: provider.tokenStatus || "", spotifyUserEmail: provider.spotifyUserEmail || "", spotifyDisplayName: provider.spotifyDisplayName || "" };
}
function pickPlaylistPublic(playlist: Record<string, any>) {
  return { id: playlist.id, playerId: playlist.playerId || "", providerId: playlist.providerId || playlist.spotifyAccountId || "", zoneId: playlist.zoneId || "", name: playlist.name || "Spotify Playlist", coverUrl: playlist.coverUrl || "", importedTracks: Number(playlist.importedTracks || 0), totalTracks: Number(playlist.totalTracks || 0), providerPlaylistUri: playlist.providerPlaylistUri || playlist.spotifyUri || playlist.uri || "", externalUrl: playlist.externalUrl || "", trackSyncStatus: playlist.trackSyncStatus || "", metadataSyncStatus: playlist.metadataSyncStatus || "" };
}
function heartbeatField(payload: Record<string, any>, current: Record<string, any>, name: string, fallback = "") {
  return payload[name] !== undefined ? String(payload[name] || "") : String(current[name] || fallback || "");
}
function sanitizeHeartbeat(payload: Record<string, any> = {}, currentPlayer: Record<string, any> = {}) {
  const updateData: Record<string, any> = {
    lastSeen: nowIso(),
    lastHeartbeatAt: nowIso(),
    isOnline: true,
    sdkReady: payload.sdkReady !== undefined ? !!payload.sdkReady : !!currentPlayer.sdkReady,
    sdkConnected: payload.sdkConnected !== undefined ? !!payload.sdkConnected : !!currentPlayer.sdkConnected,
    spotifyDeviceId: heartbeatField(payload, currentPlayer, "spotifyDeviceId"),
    currentTrackName: heartbeatField(payload, currentPlayer, "currentTrackName"),
    currentTrackArtist: heartbeatField(payload, currentPlayer, "currentTrackArtist"),
    currentTrackAlbum: heartbeatField(payload, currentPlayer, "currentTrackAlbum"),
    currentTrackCoverUrl: heartbeatField(payload, currentPlayer, "currentTrackCoverUrl"),
    isPlaying: payload.isPlaying !== undefined ? !!payload.isPlaying : !!currentPlayer.isPlaying,
    lastError: payload.lastError !== undefined ? String(payload.lastError || "") : String(currentPlayer.lastError || ""),
  };
  if (Number.isFinite(Number(payload.volume))) updateData.volume = Number(payload.volume);
  else if (Number.isFinite(Number(currentPlayer.volume))) updateData.volume = Number(currentPlayer.volume);
  if (Number.isFinite(Number(payload.progressMs))) updateData.progressMs = Number(payload.progressMs);
  else if (Number.isFinite(Number(currentPlayer.progressMs))) updateData.progressMs = Number(currentPlayer.progressMs);
  if (Number.isFinite(Number(payload.durationMs))) { updateData.durationMs = Number(payload.durationMs); updateData.currentTrackDuration = Number(payload.durationMs); }
  else if (Number.isFinite(Number(currentPlayer.durationMs || currentPlayer.currentTrackDuration))) { updateData.durationMs = Number(currentPlayer.durationMs || currentPlayer.currentTrackDuration); updateData.currentTrackDuration = Number(currentPlayer.currentTrackDuration || currentPlayer.durationMs); }
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
async function validatePlayerSession(base44: any, player: Record<string, any>, sessionToken: string) {
  if (!sessionToken) throw Object.assign(new Error("sessionToken fehlt."), { status: 401, code: "SESSION_TOKEN_MISSING" });
  if (player.isActive === false) throw Object.assign(new Error("Player ist deaktiviert."), { status: 403, code: "PLAYER_INACTIVE" });
  const runtimeSession = await getRuntimeSession(base44, player.id);
  const validTokens = [player.sessionToken, player.setupToken, runtimeSession?.sessionToken, runtimeSession?.setupToken].filter(Boolean).map(String);
  if (!validTokens.includes(String(sessionToken))) throw Object.assign(new Error("Player Session ist ungueltig. Oeffne den aktuellen Player-Link aus dem Admin."), { status: 403, code: "SESSION_TOKEN_INVALID" });
  return runtimeSession;
}
async function loadProvider(base44: any, player: Record<string, any>, runtimeSession?: Record<string, any> | null) {
  const providerId = resolveProviderId(player, runtimeSession);
  if (!providerId) return null;
  return await base44.asServiceRole.entities.Provider.get(providerId).catch(() => null);
}
async function getProviderAccessToken(base44: any, provider: Record<string, any> | null) {
  if (!provider) throw Object.assign(new Error("Player hat keinen Provider/API Account. Weise dem Player im Admin einen Spotify Provider zu und oeffne danach den neuen Player-Link."), { status: 400, code: "PROVIDER_MISSING" });
  if (!tokenExpiresSoon(provider)) return provider.accessToken;
  if (!provider.refreshToken || !provider.clientId) throw Object.assign(new Error("Provider Token fehlt oder ist abgelaufen. Spotify Provider erneut verbinden."), { status: 401, code: "TOKEN_EXPIRED" });
  const response = await fetch(TOKEN_URL, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ grant_type: "refresh_token", refresh_token: provider.refreshToken, client_id: provider.clientId }) });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw Object.assign(new Error(data.error_description || data.error || "Spotify Token Refresh fehlgeschlagen."), { status: 401, code: "TOKEN_REFRESH_FAILED" });
  const patch = { accessToken: data.access_token, refreshToken: data.refresh_token || provider.refreshToken, tokenExpiresAt: tokenExpiryIso(data.expires_in), tokenStatus: "valid", status: "connected", authStatus: "connected", lastError: "", lastTokenRefreshAt: nowIso() };
  await base44.asServiceRole.entities.Provider.update(provider.id, patch).catch(() => {});
  return patch.accessToken;
}
async function spotifyApi(path: string, { method = "GET", accessToken, body }: Record<string, any>) {
  const response = await fetch(`https://api.spotify.com/v1${path}`, { method, headers: { Authorization: `Bearer ${accessToken}`, ...(body ? { "Content-Type": "application/json" } : {}) }, body: body ? JSON.stringify(body) : undefined });
  const text = await response.text();
  const data = text ? JSON.parse(text) : null;
  if (!response.ok) throw Object.assign(new Error(data?.error?.message || data?.error || `Spotify API failed (${response.status})`), { status: response.status, code: "SPOTIFY_API_FAILED" });
  return data;
}

async function handleBootstrap(base44: any, player: Record<string, any>, runtimeSession?: Record<string, any> | null) {
  const contextPlayer = applyRuntimeContext(player, runtimeSession);
  const provider = await loadProvider(base44, contextPlayer, runtimeSession);
  const zone = contextPlayer.zoneId ? await base44.asServiceRole.entities.Zone.get(contextPlayer.zoneId).catch(() => null) : null;
  const patch: Record<string, any> = { lastSeen: nowIso(), lastHeartbeatAt: nowIso(), isOnline: true, lastError: contextPlayer.providerId ? "" : "Player has no providerId assigned." };
  if (contextPlayer.providerId && !player.providerId) { patch.providerId = contextPlayer.providerId; patch.apiCredentialSetId = contextPlayer.providerId; patch.spotifyAccountId = contextPlayer.providerId; }
  if (contextPlayer.zoneId && !player.zoneId) patch.zoneId = contextPlayer.zoneId;
  await base44.asServiceRole.entities.Player.update(player.id, patch).catch(() => {});
  return { success: true, player: pickPlayerPublic({ ...contextPlayer, ...patch }, runtimeSession), provider: pickProviderPublic(provider), zone: zone ? { id: zone.id, name: zone.name || "", providerId: zone.providerId || "" } : null, serverTime: nowIso() };
}
async function handleHeartbeat(base44: any, player: Record<string, any>, payload: Record<string, any>, runtimeSession?: Record<string, any> | null) {
  const updateData = sanitizeHeartbeat(payload, player);
  await base44.asServiceRole.entities.Player.update(player.id, updateData);
  return { success: true, playerId: player.id, updatedAt: updateData.lastHeartbeatAt, player: pickPlayerPublic({ ...player, ...updateData }, runtimeSession), serverTime: nowIso() };
}
async function handleGetAccessToken(base44: any, player: Record<string, any>, runtimeSession?: Record<string, any> | null) {
  const provider = await loadProvider(base44, player, runtimeSession);
  const accessToken = await getProviderAccessToken(base44, provider);
  return { success: true, accessToken, provider: pickProviderPublic(provider), serverTime: nowIso() };
}
async function handlePlayPlaylist(base44: any, player: Record<string, any>, payload: Record<string, any>, runtimeSession?: Record<string, any> | null) {
  const provider = await loadProvider(base44, player, runtimeSession);
  const accessToken = await getProviderAccessToken(base44, provider);
  const deviceId = payload.deviceId || player.spotifyDeviceId;
  const contextUri = payload.contextUri || payload.playlistUri;
  if (!deviceId) throw Object.assign(new Error("Spotify Device ID fehlt."), { status: 400, code: "NO_SPOTIFY_DEVICE_ID" });
  if (!contextUri) throw Object.assign(new Error("Playlist URI fehlt."), { status: 400, code: "PLAYLIST_URI_MISSING" });
  await spotifyApi(`/me/player/play?device_id=${encodeURIComponent(deviceId)}`, { method: "PUT", accessToken, body: { context_uri: contextUri, ...(payload.offset ? { offset: payload.offset } : {}) } });
  return { success: true, serverTime: nowIso() };
}
async function handleListPlaylists(base44: any, player: Record<string, any>, runtimeSession?: Record<string, any> | null) {
  const providerId = resolveProviderId(player, runtimeSession);
  if (!providerId) return { success: true, playlists: [], serverTime: nowIso() };
  const byProvider = await base44.asServiceRole.entities.Playlist.filter({ providerId }).catch(() => []);
  const bySpotifyAccount = await base44.asServiceRole.entities.Playlist.filter({ spotifyAccountId: providerId }).catch(() => []);
  const byPlayer = await base44.asServiceRole.entities.Playlist.filter({ playerId: player.id }).catch(() => []);
  const merged = [...byProvider, ...bySpotifyAccount, ...byPlayer];
  const seen = new Set<string>();
  const playlists = merged.filter((playlist: any) => { if (!playlist?.id || seen.has(playlist.id)) return false; seen.add(playlist.id); const playlistProviderId = playlist.providerId || playlist.spotifyAccountId || ""; return !playlist.playerId || playlist.playerId === player.id || playlistProviderId === providerId; }).map(pickPlaylistPublic).sort((a: any, b: any) => String(a.name).localeCompare(String(b.name)));
  return { success: true, playlists, serverTime: nowIso() };
}
async function handlePollCommands(base44: any, player: Record<string, any>, runtimeSession?: Record<string, any> | null) {
  const providerId = resolveProviderId(player, runtimeSession);
  const zoneId = resolveZoneId(player, runtimeSession);
  const commands = await readCommands(base44);
  const sorted = commands.filter((cmd: any) => cmd.playerId === player.id && cmd.status === COMMAND_STATUS.PENDING).sort((a: any, b: any) => new Date(a.createdAt || a.created_date || 0).getTime() - new Date(b.createdAt || b.created_date || 0).getTime());
  const command = sorted[0] || null;
  const heartbeatPatch = { lastSeen: nowIso(), lastHeartbeatAt: nowIso(), isOnline: true };
  if (!command) {
    await base44.asServiceRole.entities.Player.update(player.id, heartbeatPatch).catch(() => {});
    return { success: true, command: null, player: pickPlayerPublic({ ...player, ...heartbeatPatch }, runtimeSession), serverTime: nowIso() };
  }
  const updatedCommand = { ...command, status: COMMAND_STATUS.PICKED_UP, pickedUpAt: nowIso(), humanMessage: "Player picked up command and is executing it." };
  await writeCommands(base44, commands.map((cmd: any) => cmd.id === command.id ? updatedCommand : cmd));
  const patch = { ...heartbeatPatch, lastCommand: command.type || command.command || "", lastCommandStatus: COMMAND_STATUS.PICKED_UP, lastError: "" };
  await base44.asServiceRole.entities.Player.update(player.id, patch);
  return { success: true, player: pickPlayerPublic({ ...player, ...patch }, runtimeSession), serverTime: nowIso(), command: { id: updatedCommand.id, playerId: updatedCommand.playerId, providerId: updatedCommand.providerId || providerId || "", zoneId: updatedCommand.zoneId || zoneId || "", type: updatedCommand.type || updatedCommand.command, command: updatedCommand.command || updatedCommand.type, payload: updatedCommand.payload || {}, createdAt: updatedCommand.createdAt || updatedCommand.created_date || "" } };
}
async function handleCommandResult(base44: any, player: Record<string, any>, payload: Record<string, any>, runtimeSession?: Record<string, any> | null) {
  const commandId = payload.commandId;
  if (!commandId) throw Object.assign(new Error("commandId fehlt."), { status: 400, code: "COMMAND_ID_MISSING" });
  const commands = await readCommands(base44);
  const command = commands.find((cmd: any) => cmd.id === commandId);
  if (!command || command.playerId !== player.id) throw Object.assign(new Error("Command gehoert nicht zu diesem Player."), { status: 403, code: "COMMAND_FORBIDDEN" });
  const status = payload.status === COMMAND_STATUS.SUCCESS ? COMMAND_STATUS.SUCCESS : COMMAND_STATUS.FAILED;
  const completedAt = nowIso();
  const updatedCommand = { ...command, status, completedAt, result: payload.result || {}, errorCode: payload.errorCode || "", humanMessage: payload.humanMessage || (status === COMMAND_STATUS.SUCCESS ? "Command confirmed by Player." : "Command failed on Player."), technicalMessage: payload.technicalMessage || "", suggestedFix: payload.suggestedFix || "" };
  await writeCommands(base44, commands.map((cmd: any) => cmd.id === command.id ? updatedCommand : cmd));
  const patch = { lastSeen: nowIso(), lastHeartbeatAt: nowIso(), isOnline: true, lastCommand: command.type || command.command || "", lastCommandStatus: status, lastError: status === COMMAND_STATUS.SUCCESS ? "" : updatedCommand.humanMessage, lastCommandCompletedAt: completedAt };
  await base44.asServiceRole.entities.Player.update(player.id, patch);
  return { success: true, commandId: command.id, status, player: pickPlayerPublic({ ...player, ...patch }, runtimeSession), serverTime: nowIso() };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return json({ ok: true });
  if (req.method !== "POST") return json({ success: false, error: "Method not allowed" }, { status: 405 });
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));
    const { action, playerId, sessionToken, payload = {} } = body;
    if (!ALLOWED_ACTIONS.includes(action)) return json({ success: false, errorCode: "ACTION_INVALID", error: "Invalid publicPlayerRuntime action." }, { status: 400 });
    const player = await findPlayer(base44, playerId);
    const runtimeSession = await validatePlayerSession(base44, player, sessionToken);
    const contextPlayer = applyRuntimeContext(player, runtimeSession);
    if (action === "bootstrap") return json(await handleBootstrap(base44, player, runtimeSession));
    if (action === "heartbeat") return json(await handleHeartbeat(base44, contextPlayer, payload, runtimeSession));
    if (action === "pollCommands") return json(await handlePollCommands(base44, contextPlayer, runtimeSession));
    if (action === "commandResult") return json(await handleCommandResult(base44, contextPlayer, payload, runtimeSession));
    if (action === "getAccessToken") return json(await handleGetAccessToken(base44, contextPlayer, runtimeSession));
    if (action === "playPlaylist") return json(await handlePlayPlaylist(base44, contextPlayer, payload, runtimeSession));
    if (action === "listPlaylists") return json(await handleListPlaylists(base44, contextPlayer, runtimeSession));
  } catch (error) {
    const status = Number(error?.status || 500);
    return json({ success: false, errorCode: error?.code || "PUBLIC_PLAYER_RUNTIME_ERROR", error: error?.message || "publicPlayerRuntime failed." }, { status });
  }
  return json({ success: false, errorCode: "UNREACHABLE", error: "Unhandled action." }, { status: 500 });
});
