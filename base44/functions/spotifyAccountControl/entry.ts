import { createClientFromRequest } from "npm:@base44/sdk";

const TOKEN_URL = "https://accounts.spotify.com/api/token";
const SPOTIFY_API = "https://api.spotify.com/v1";
const ADMIN_ROLES = new Set(["owner", "admin", "staff"]);
const ADMIN_ACTIONS = new Set(["getUserPlaylists", "getDevices", "importPlaylistTracks"]);

function json(data: unknown, init?: ResponseInit) {
  return Response.json(data, { ...init, headers: { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "POST, OPTIONS", "Access-Control-Allow-Headers": "Content-Type, Authorization", ...(init?.headers || {}) } });
}
function nowIso() { return new Date().toISOString(); }
async function requireAdmin(base44: any) {
  const user = await base44.auth.me().catch(() => null);
  const role = String(user?.role || "").toLowerCase();
  if (!user || !ADMIN_ROLES.has(role)) throw Object.assign(new Error("Admin login required for Spotify account control."), { status: 403, code: "ADMIN_REQUIRED" });
  return user;
}
function tokenExpiresSoon(provider: Record<string, any>) {
  if (!provider.accessToken) return true;
  if (!provider.tokenExpiresAt) return false;
  return new Date(provider.tokenExpiresAt).getTime() < Date.now() + 30000;
}
function tokenExpiryIso(expiresInSeconds = 3600) { return new Date(Date.now() + Math.max(60, Number(expiresInSeconds) - 60) * 1000).toISOString(); }

async function loadProvider(base44: any, accountId: string) {
  if (!accountId) throw Object.assign(new Error("Spotify Provider ID fehlt."), { status: 400, code: "PROVIDER_ID_MISSING" });
  const provider = await base44.asServiceRole.entities.Provider.get(accountId).catch(() => null);
  if (!provider) throw Object.assign(new Error("Spotify Provider nicht gefunden."), { status: 404, code: "PROVIDER_NOT_FOUND" });
  return provider;
}
async function getAccessToken(base44: any, provider: Record<string, any>) {
  if (!tokenExpiresSoon(provider)) return provider.accessToken;
  if (!provider.refreshToken || !provider.clientId) throw Object.assign(new Error("Provider Token fehlt oder ist abgelaufen. Spotify Provider erneut verbinden."), { status: 401, code: "TOKEN_EXPIRED" });
  const response = await fetch(TOKEN_URL, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ grant_type: "refresh_token", refresh_token: provider.refreshToken, client_id: provider.clientId }) });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    await base44.asServiceRole.entities.Provider.update(provider.id, { status: "expired", authStatus: "expired", tokenStatus: "expired", lastError: data.error_description || data.error || "Spotify Token Refresh fehlgeschlagen.", lastTokenRefreshAt: nowIso() }).catch(() => {});
    throw Object.assign(new Error(data.error_description || data.error || "Spotify Token Refresh fehlgeschlagen."), { status: 401, code: "TOKEN_REFRESH_FAILED", detail: data });
  }
  const patch = { accessToken: data.access_token, refreshToken: data.refresh_token || provider.refreshToken, tokenExpiresAt: tokenExpiryIso(data.expires_in), tokenStatus: "valid", status: "connected", authStatus: "connected", lastError: "", lastTokenRefreshAt: nowIso() };
  await base44.asServiceRole.entities.Provider.update(provider.id, patch).catch(() => {});
  return patch.accessToken;
}
async function spotifyApi(path: string, { method = "GET", accessToken, body }: Record<string, any>) {
  const response = await fetch(`${SPOTIFY_API}${path}`, { method, headers: { Authorization: `Bearer ${accessToken}`, ...(body ? { "Content-Type": "application/json" } : {}) }, body: body ? JSON.stringify(body) : undefined });
  const text = await response.text();
  const data = text ? JSON.parse(text) : null;
  if (!response.ok) {
    const message = data?.error?.message || data?.error_description || data?.error || `Spotify API failed (${response.status})`;
    throw Object.assign(new Error(message), { status: response.status, code: response.status === 403 ? "SPOTIFY_FORBIDDEN" : "SPOTIFY_API_FAILED", detail: data });
  }
  return data;
}
function normalizeDevice(provider: Record<string, any>, device: Record<string, any>) {
  return { spotifyAccountId: provider.id, providerId: provider.id, deviceId: device.id || "", name: device.name || "Spotify Device", type: device.type || "Unknown", isActive: !!device.is_active, isVisible: !device.is_restricted, isRestricted: !!device.is_restricted, currentVolume: Number.isFinite(Number(device.volume_percent)) ? Number(device.volume_percent) : undefined, lastSeenAt: nowIso(), updatedAt: nowIso() };
}
function trackPayload(playlistId: string, item: Record<string, any>, sortOrder: number) {
  const track = item.track || null;
  const album = track?.album || {};
  const images = album.images || [];
  const isTrack = track?.type === "track";
  const isLocal = !!track?.is_local;
  return { playlistId, providerTrackId: track?.id || `unsupported_${sortOrder}`, providerTrackUri: track?.uri || "", name: track?.name || item.track?.name || "Unsupported item", artist: (track?.artists || []).map((a: any) => a.name).filter(Boolean).join(", "), album: album.name || "", durationMs: Number(track?.duration_ms || 0), coverUrl: images[0]?.url || "", explicit: !!track?.explicit, sortOrder, isPlayable: !!isTrack && !isLocal && track?.is_playable !== false && !!track?.uri, isLocal, itemType: track?.type || item.type || "unknown", addedAt: item.added_at || "", lastError: isTrack ? "" : "UNSUPPORTED_ITEM_TYPE", updatedAt: nowIso() };
}
async function handleGetUserPlaylists(base44: any, provider: Record<string, any>) {
  const accessToken = await getAccessToken(base44, provider);
  const playlists: any[] = [];
  let offset = 0, total = 0;
  do {
    const data = await spotifyApi(`/me/playlists?limit=50&offset=${offset}`, { accessToken });
    playlists.push(...(data.items || []));
    total = data.total || playlists.length;
    offset += data.limit || 50;
    if (!data.next) break;
  } while (playlists.length < total);
  return { success: true, playlists, total: playlists.length };
}
async function handleGetDevices(base44: any, provider: Record<string, any>) {
  const accessToken = await getAccessToken(base44, provider);
  const data = await spotifyApi("/me/player/devices", { accessToken });
  const devices = data.devices || [];
  for (const device of devices) {
    const payload = normalizeDevice(provider, device);
    const existing = await base44.asServiceRole.entities.SpotifyDevice.filter({ spotifyAccountId: provider.id, deviceId: payload.deviceId }).catch(() => []);
    if (existing[0]?.id) await base44.asServiceRole.entities.SpotifyDevice.update(existing[0].id, payload).catch(() => {});
    else await base44.asServiceRole.entities.SpotifyDevice.create({ ...payload, createdAt: nowIso() }).catch(() => {});
  }
  return { success: true, devices };
}
async function handlePlayPlaylist(base44: any, provider: Record<string, any>, payload: Record<string, any>) {
  const accessToken = await getAccessToken(base44, provider);
  const deviceId = payload.deviceId;
  const contextUri = payload.contextUri || payload.playlistUri;
  if (!deviceId) throw Object.assign(new Error("Spotify Device ID fehlt."), { status: 400, code: "NO_SPOTIFY_DEVICE_ID" });
  if (!contextUri) throw Object.assign(new Error("Spotify Playlist URI fehlt."), { status: 400, code: "PLAYLIST_URI_MISSING" });
  await spotifyApi(`/me/player/play?device_id=${encodeURIComponent(deviceId)}`, { method: "PUT", accessToken, body: { context_uri: contextUri, ...(payload.offset ? { offset: payload.offset } : {}) } });
  return { success: true };
}
async function handleImportPlaylistTracks(base44: any, provider: Record<string, any>, payload: Record<string, any>) {
  const { playlistId, spotifyPlaylistId } = payload;
  if (!playlistId) throw Object.assign(new Error("Catalog Playlist ID fehlt."), { status: 400, code: "PLAYLIST_ID_MISSING" });
  if (!spotifyPlaylistId) throw Object.assign(new Error("Spotify Playlist ID fehlt."), { status: 400, code: "SPOTIFY_PLAYLIST_ID_MISSING" });
  const accessToken = await getAccessToken(base44, provider);
  let offset = 0, total = 0, imported = 0, skipped = 0, failed = 0, sortOrder = 0;
  await base44.asServiceRole.entities.Playlist.update(playlistId, { trackSyncStatus: "loading", syncStatus: "pending", lastError: "", updatedAt: nowIso() }).catch(() => {});
  const existingRows = await base44.asServiceRole.entities.PlaylistTrack.filter({ playlistId }).catch(() => []);
  const existingByKey = new Map<string, any>();
  for (const row of existingRows) existingByKey.set(`${row.providerTrackUri || row.providerTrackId || ""}:${row.sortOrder}`, row);
  try {
    do {
      const data = await spotifyApi(`/playlists/${encodeURIComponent(spotifyPlaylistId)}/tracks?limit=100&offset=${offset}&additional_types=track`, { accessToken });
      const items = data.items || [];
      total = data.total || total || items.length;
      for (const item of items) {
        sortOrder += 1;
        if (!item?.track) { skipped += 1; continue; }
        const row = trackPayload(playlistId, item, sortOrder);
        if (!row.isPlayable) skipped += 1;
        const key = `${row.providerTrackUri || row.providerTrackId}:${row.sortOrder}`;
        const existing = existingByKey.get(key);
        try {
          if (existing?.id) await base44.asServiceRole.entities.PlaylistTrack.update(existing.id, row);
          else await base44.asServiceRole.entities.PlaylistTrack.create({ ...row, createdAt: nowIso() });
          if (row.isPlayable) imported += 1;
        } catch (writeError) { failed += 1; }
      }
      offset += data.limit || 100;
      if (!data.next) break;
    } while (offset < total);
    const trackSyncStatus = imported > 0 && failed === 0 && (!total || imported + skipped >= total) ? "success" : imported > 0 ? "partial" : "failed";
    await base44.asServiceRole.entities.Playlist.update(playlistId, { totalTracks: total, importedTracks: imported, trackSyncStatus, syncStatus: trackSyncStatus === "success" ? "synced" : trackSyncStatus, lastTrackSyncAt: nowIso(), lastSyncAt: nowIso(), lastError: trackSyncStatus === "failed" ? "NO_TRACKS_IMPORTED" : failed > 0 ? `${failed} tracks failed.` : skipped > 0 ? `${skipped} tracks unavailable/local/unsupported.` : "", updatedAt: nowIso() });
    return { success: true, imported, importedTracks: imported, total, skipped, failed, trackSyncStatus };
  } catch (error) {
    await base44.asServiceRole.entities.Playlist.update(playlistId, { trackSyncStatus: "failed", syncStatus: "error", lastError: error?.message || "TRACK_IMPORT_FAILED", lastTrackSyncAt: nowIso(), updatedAt: nowIso() }).catch(() => {});
    throw Object.assign(error, { code: error?.code || "TRACK_IMPORT_FAILED" });
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return json({ ok: true });
  if (req.method !== "POST") return json({ success: false, error: "Method not allowed" }, { status: 405 });
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));
    const { action, accountId } = body;
    if (ADMIN_ACTIONS.has(action)) await requireAdmin(base44);
    const provider = await loadProvider(base44, accountId);
    if (action === "getUserPlaylists") return json(await handleGetUserPlaylists(base44, provider));
    if (action === "getDevices") return json(await handleGetDevices(base44, provider));
    if (action === "playPlaylist") return json(await handlePlayPlaylist(base44, provider, body));
    if (action === "importPlaylistTracks") return json(await handleImportPlaylistTracks(base44, provider, body));
    return json({ success: false, errorCode: "ACTION_INVALID", error: "Invalid spotifyAccountControl action." }, { status: 400 });
  } catch (error) {
    const status = Number(error?.status || 500);
    return json({ success: false, errorCode: error?.code || "SPOTIFY_ACCOUNT_CONTROL_ERROR", error: error?.message || "spotifyAccountControl failed.", detail: error?.detail || null }, { status });
  }
});
