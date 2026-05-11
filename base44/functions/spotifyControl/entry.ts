import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const SPOTIFY_API = 'https://api.spotify.com/v1';

async function getAccessToken(base44, providerId) {
  const tokenKey = `spotify_access_token_${providerId}`;
  const settings = await base44.asServiceRole.entities.AppSetting.filter({ key: tokenKey });
  if (!settings.length) throw new Error('No token stored for provider');
  return settings[0].value;
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

  try {
    // ── GET CURRENT PLAYBACK STATE ──────────────────────────────────────────────
    if (action === 'getCurrentPlayback') {
      const data = await spotifyRequest(accessToken, 'GET', '/me/player');
      return Response.json({ success: true, playback: data });
    }

    // ── GET DEVICES ─────────────────────────────────────────────────────────────
    if (action === 'getDevices') {
      const data = await spotifyRequest(accessToken, 'GET', '/me/player/devices');
      return Response.json({ success: true, devices: data.devices || [] });
    }

    // ── TRANSFER PLAYBACK TO DEVICE ─────────────────────────────────────────────
    if (action === 'transferPlayback') {
      if (!deviceId) return Response.json({ error: 'Missing deviceId' }, { status: 400 });
      await spotifyRequest(accessToken, 'PUT', '/me/player', { device_ids: [deviceId], play: true });
      return Response.json({ success: true });
    }

    // ── PLAY ────────────────────────────────────────────────────────────────────
    if (action === 'play') {
      const queryParams = deviceId ? `?device_id=${deviceId}` : '';
      const bodyData = {};
      if (contextUri) bodyData.context_uri = contextUri;
      if (trackUri) bodyData.uris = [trackUri];
      if (positionMs !== undefined) bodyData.position_ms = positionMs;
      await spotifyRequest(accessToken, 'PUT', `/me/player/play${queryParams}`, Object.keys(bodyData).length ? bodyData : undefined);
      return Response.json({ success: true });
    }

    // ── PAUSE ───────────────────────────────────────────────────────────────────
    if (action === 'pause') {
      const queryParams = deviceId ? `?device_id=${deviceId}` : '';
      await spotifyRequest(accessToken, 'PUT', `/me/player/pause${queryParams}`);
      return Response.json({ success: true });
    }

    // ── NEXT TRACK ──────────────────────────────────────────────────────────────
    if (action === 'next') {
      const queryParams = deviceId ? `?device_id=${deviceId}` : '';
      await spotifyRequest(accessToken, 'POST', `/me/player/next${queryParams}`);
      return Response.json({ success: true });
    }

    // ── PREVIOUS TRACK ──────────────────────────────────────────────────────────
    if (action === 'previous') {
      const queryParams = deviceId ? `?device_id=${deviceId}` : '';
      await spotifyRequest(accessToken, 'POST', `/me/player/previous${queryParams}`);
      return Response.json({ success: true });
    }

    // ── SET VOLUME ──────────────────────────────────────────────────────────────
    if (action === 'setVolume') {
      if (volume === undefined) return Response.json({ error: 'Missing volume' }, { status: 400 });
      const queryParams = deviceId ? `?volume_percent=${volume}&device_id=${deviceId}` : `?volume_percent=${volume}`;
      await spotifyRequest(accessToken, 'PUT', `/me/player/volume${queryParams}`);
      return Response.json({ success: true });
    }

    // ── PLAY PLAYLIST ───────────────────────────────────────────────────────────
    if (action === 'playPlaylist') {
      if (!contextUri) return Response.json({ error: 'Missing contextUri' }, { status: 400 });
      const queryParams = deviceId ? `?device_id=${deviceId}` : '';
      await spotifyRequest(accessToken, 'PUT', `/me/player/play${queryParams}`, { context_uri: contextUri });
      return Response.json({ success: true });
    }

    return Response.json({ error: 'Unknown action' }, { status: 400 });

  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
});