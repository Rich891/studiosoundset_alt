import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const SPOTIFY_API = 'https://api.spotify.com/v1';

async function getAccessToken(base44, providerId) {
  const tokenKey = `spotify_access_token_${providerId}`;
  const settings = await base44.asServiceRole.entities.AppSetting.filter({ key: tokenKey });
  if (!settings.length) throw new Error('No token stored for provider');
  return settings[0].value;
}

async function tryRefreshToken(base44, providerId) {
  const refreshKey = `spotify_refresh_token_${providerId}`;
  const settings = await base44.asServiceRole.entities.AppSetting.filter({ key: refreshKey });
  if (!settings.length) return null;
  const refreshToken = settings[0].value;

  const CLIENT_ID = Deno.env.get('SPOTIFY_CLIENT_ID');
  const CLIENT_SECRET = Deno.env.get('SPOTIFY_CLIENT_SECRET');
  const authHeader = 'Basic ' + btoa(`${CLIENT_ID}:${CLIENT_SECRET}`);

  const res = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: { Authorization: authHeader, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'refresh_token', refresh_token: refreshToken }).toString(),
  });
  if (!res.ok) return null;
  const data = await res.json();

  // Store new access token
  const tokenKey = `spotify_access_token_${providerId}`;
  const existing = await base44.asServiceRole.entities.AppSetting.filter({ key: tokenKey });
  if (existing.length) {
    await base44.asServiceRole.entities.AppSetting.update(existing[0].id, { value: data.access_token });
  } else {
    await base44.asServiceRole.entities.AppSetting.create({ key: tokenKey, value: data.access_token, category: 'spotify_tokens' });
  }
  const expiresAt = new Date(Date.now() + data.expires_in * 1000).toISOString();
  await base44.asServiceRole.entities.Provider.update(providerId, { accessTokenStored: true, tokenExpiresAt: expiresAt, connectionStatus: 'connected' });

  return data.access_token;
}

async function spotifyRequest(accessToken, method, path, body) {
  const res = await fetch(`${SPOTIFY_API}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (res.status === 204) return { ok: true };
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error?.message || `Spotify API error ${res.status}`);
  }
  return res.json().catch(() => ({ ok: true }));
}

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);

  let body;
  try { body = await req.json(); } catch { return Response.json({ error: 'Invalid JSON' }, { status: 400 }); }

  const { action, providerId, deviceId, volume, contextUri, trackUri, positionMs } = body;
  if (!providerId) return Response.json({ error: 'Missing providerId' }, { status: 400 });

  let accessToken;
  try {
    accessToken = await getAccessToken(base44, providerId);
  } catch (e) {
    return Response.json({ error: e.message }, { status: 401 });
  }

  // Helper: auto-refresh on 401
  async function spotifyRequestWithRefresh(method, path, body) {
    try {
      return await spotifyRequest(accessToken, method, path, body);
    } catch (e) {
      if (e.message && e.message.includes('401')) {
        const newToken = await tryRefreshToken(base44, providerId);
        if (newToken) {
          accessToken = newToken;
          return await spotifyRequest(accessToken, method, path, body);
        }
      }
      throw e;
    }
  }

  try {
    // ── GET CURRENT PLAYBACK STATE ──────────────────────────────────────────────
    if (action === 'getCurrentPlayback') {
      const data = await spotifyRequestWithRefresh('GET', '/me/player');
      return Response.json({ success: true, playback: data });
    }

    // ── GET DEVICES ─────────────────────────────────────────────────────────────
    if (action === 'getDevices') {
      const data = await spotifyRequestWithRefresh('GET', '/me/player/devices');
      return Response.json({ success: true, devices: data.devices || [] });
    }

    // ── GET SPOTIFY PLAYLIST METADATA ───────────────────────────────────────────
    if (action === 'getPlaylistInfo') {
      const { playlistId } = body;
      if (!playlistId) return Response.json({ error: 'Missing playlistId' }, { status: 400 });
      const data = await spotifyRequestWithRefresh('GET', `/playlists/${playlistId}?fields=id,name,description,images,owner,tracks.total,uri,external_urls`);
      return Response.json({ success: true, playlist: data });
    }

    // ── TRANSFER PLAYBACK TO DEVICE ─────────────────────────────────────────────
    if (action === 'transferPlayback') {
      if (!deviceId) return Response.json({ error: 'Missing deviceId' }, { status: 400 });
      await spotifyRequestWithRefresh('PUT', '/me/player', { device_ids: [deviceId], play: true });
      return Response.json({ success: true });
    }

    // ── PLAY ────────────────────────────────────────────────────────────────────
    if (action === 'play') {
      const queryParams = deviceId ? `?device_id=${deviceId}` : '';
      const bodyData = {};
      if (contextUri) bodyData.context_uri = contextUri;
      if (trackUri) bodyData.uris = [trackUri];
      if (positionMs !== undefined) bodyData.position_ms = positionMs;
      await spotifyRequestWithRefresh('PUT', `/me/player/play${queryParams}`, Object.keys(bodyData).length ? bodyData : undefined);
      return Response.json({ success: true });
    }

    // ── PAUSE ───────────────────────────────────────────────────────────────────
    if (action === 'pause') {
      const queryParams = deviceId ? `?device_id=${deviceId}` : '';
      await spotifyRequestWithRefresh('PUT', `/me/player/pause${queryParams}`);
      return Response.json({ success: true });
    }

    // ── NEXT TRACK ──────────────────────────────────────────────────────────────
    if (action === 'next') {
      const queryParams = deviceId ? `?device_id=${deviceId}` : '';
      await spotifyRequestWithRefresh('POST', `/me/player/next${queryParams}`);
      return Response.json({ success: true });
    }

    // ── PREVIOUS TRACK ──────────────────────────────────────────────────────────
    if (action === 'previous') {
      const queryParams = deviceId ? `?device_id=${deviceId}` : '';
      await spotifyRequestWithRefresh('POST', `/me/player/previous${queryParams}`);
      return Response.json({ success: true });
    }

    // ── SET VOLUME ──────────────────────────────────────────────────────────────
    if (action === 'setVolume') {
      if (volume === undefined) return Response.json({ error: 'Missing volume' }, { status: 400 });
      const queryParams = deviceId ? `?volume_percent=${volume}&device_id=${deviceId}` : `?volume_percent=${volume}`;
      await spotifyRequestWithRefresh('PUT', `/me/player/volume${queryParams}`);
      return Response.json({ success: true });
    }

    // ── PLAY PLAYLIST ───────────────────────────────────────────────────────────
    if (action === 'playPlaylist') {
      if (!contextUri) return Response.json({ error: 'Missing contextUri' }, { status: 400 });
      const queryParams = deviceId ? `?device_id=${deviceId}` : '';
      await spotifyRequestWithRefresh('PUT', `/me/player/play${queryParams}`, { context_uri: contextUri });
      return Response.json({ success: true });
    }

    return Response.json({ error: 'Unknown action' }, { status: 400 });

  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
});