/**
 * spotifyAccountControl — Multi-Account Spotify Control Backend
 * Jeder SpotifyAccount hat eigene Tokens gespeichert in AppSetting.
 * Key-Schema: spotify_access_token_{accountId}, spotify_refresh_token_{accountId}
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const SPOTIFY_API = 'https://api.spotify.com/v1';
const SPOTIFY_TOKEN_URL = 'https://accounts.spotify.com/api/token';
const CLIENT_ID = Deno.env.get('SPOTIFY_CLIENT_ID');
const CLIENT_SECRET = Deno.env.get('SPOTIFY_CLIENT_SECRET');

async function upsertSetting(base44, key, value, category = 'spotify_tokens') {
  const existing = await base44.asServiceRole.entities.AppSetting.filter({ key });
  if (existing.length > 0) {
    await base44.asServiceRole.entities.AppSetting.update(existing[0].id, { value, category });
  } else {
    await base44.asServiceRole.entities.AppSetting.create({ key, value, category });
  }
}

async function getTokens(base44, accountId) {
  const [accessSettings, refreshSettings] = await Promise.all([
    base44.asServiceRole.entities.AppSetting.filter({ key: `spotify_access_token_${accountId}` }),
    base44.asServiceRole.entities.AppSetting.filter({ key: `spotify_refresh_token_${accountId}` }),
  ]);
  return {
    accessToken: accessSettings[0]?.value || null,
    refreshToken: refreshSettings[0]?.value || null,
  };
}

async function refreshAccessToken(base44, accountId, refreshToken) {
  const authHeader = 'Basic ' + btoa(`${CLIENT_ID}:${CLIENT_SECRET}`);
  const res = await fetch(SPOTIFY_TOKEN_URL, {
    method: 'POST',
    headers: { Authorization: authHeader, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'refresh_token', refresh_token: refreshToken }).toString(),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(`Token refresh failed: ${err.error_description || res.status}`);
  }
  const data = await res.json();
  const expiresAt = new Date(Date.now() + data.expires_in * 1000).toISOString();
  await Promise.all([
    upsertSetting(base44, `spotify_access_token_${accountId}`, data.access_token),
    base44.asServiceRole.entities.SpotifyAccount.update(accountId, {
      tokenStatus: 'valid',
      tokenExpiresAt: expiresAt,
      authStatus: 'connected',
    }),
  ]);
  return data.access_token;
}

async function spotifyFetch(accessToken, method, path, body) {
  const res = await fetch(`${SPOTIFY_API}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  if (res.status === 204) return { ok: true };
  if (res.status === 401) throw new Error('TOKEN_EXPIRED');
  if (res.status === 403) {
    const err = await res.json().catch(() => ({}));
    throw new Error(`FORBIDDEN: ${err?.error?.message || 'Premium required or scope missing'}`);
  }
  if (res.status === 404) throw new Error('NOT_FOUND');
  if (res.status === 429) throw new Error('RATE_LIMITED');
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error?.message || `Spotify API ${res.status}`);
  }
  return res.json().catch(() => ({ ok: true }));
}

async function spotifyFetchWithRefresh(base44, accountId, tokens, method, path, body) {
  try {
    return await spotifyFetch(tokens.accessToken, method, path, body);
  } catch (e) {
    if (e.message === 'TOKEN_EXPIRED' && tokens.refreshToken) {
      const newToken = await refreshAccessToken(base44, accountId, tokens.refreshToken);
      tokens.accessToken = newToken;
      return await spotifyFetch(newToken, method, path, body);
    }
    throw e;
  }
}

Deno.serve(async (req) => {
  let body;
  try { body = await req.json(); } catch { return Response.json({ error: 'Invalid JSON' }, { status: 400 }); }

  const { action, accountId } = body;

  let base44;
  try {
    base44 = createClientFromRequest(req);
    await base44.auth.me(); // validate user
  } catch (e) {
    // Allow getAuthUrl without auth
    if (action !== 'getAuthUrl') {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }
  }

  // ── GET AUTH URL ────────────────────────────────────────────────────────────
  if (action === 'getAuthUrl') {
    const { redirectUri, accountId: aid } = body;
    if (!redirectUri || !aid) return Response.json({ error: 'Missing redirectUri or accountId' }, { status: 400 });
    if (!CLIENT_ID) return Response.json({ error: 'SPOTIFY_CLIENT_ID not configured' }, { status: 500 });

    const scopes = [
      'user-read-playback-state',
      'user-modify-playback-state',
      'user-read-currently-playing',
      'playlist-read-private',
      'playlist-read-collaborative',
      'streaming',
    ].join(' ');

    const params = new URLSearchParams({
      client_id: CLIENT_ID,
      response_type: 'code',
      redirect_uri: redirectUri,
      scope: scopes,
      state: aid,
    });
    return Response.json({ url: `https://accounts.spotify.com/authorize?${params.toString()}` });
  }

  // ── EXCHANGE CODE ───────────────────────────────────────────────────────────
  if (action === 'exchange') {
    const { code, redirectUri, accountId: aid } = body;
    if (!code || !redirectUri || !aid) return Response.json({ error: 'Missing code, redirectUri or accountId' }, { status: 400 });

    const authHeader = 'Basic ' + btoa(`${CLIENT_ID}:${CLIENT_SECRET}`);
    const res = await fetch(SPOTIFY_TOKEN_URL, {
      method: 'POST',
      headers: { Authorization: authHeader, 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ grant_type: 'authorization_code', code, redirect_uri: redirectUri }).toString(),
    });
    const data = await res.json();
    if (!res.ok) return Response.json({ error: data.error_description || 'Token exchange failed' }, { status: 400 });

    const expiresAt = new Date(Date.now() + data.expires_in * 1000).toISOString();
    await Promise.all([
      upsertSetting(base44, `spotify_access_token_${aid}`, data.access_token),
      data.refresh_token ? upsertSetting(base44, `spotify_refresh_token_${aid}`, data.refresh_token) : Promise.resolve(),
    ]);

    // Fetch user info
    let spotifyUserId = '', spotifyUserEmail = '';
    try {
      const userRes = await fetch(`${SPOTIFY_API}/me`, { headers: { Authorization: `Bearer ${data.access_token}` } });
      if (userRes.ok) {
        const userData = await userRes.json();
        spotifyUserId = userData.id || '';
        spotifyUserEmail = userData.email || '';
      }
    } catch {}

    await base44.asServiceRole.entities.SpotifyAccount.update(aid, {
      authStatus: 'connected',
      tokenStatus: 'valid',
      tokenExpiresAt: expiresAt,
      scopes: 'user-read-playback-state user-modify-playback-state user-read-currently-playing playlist-read-private playlist-read-collaborative streaming',
      spotifyUserId,
      spotifyUserEmail,
      lastError: '',
    });

    return Response.json({ success: true });
  }

  // All subsequent actions require accountId and valid token
  if (!accountId) return Response.json({ error: 'Missing accountId' }, { status: 400 });

  let tokens;
  try {
    tokens = await getTokens(base44, accountId);
    if (!tokens.accessToken) throw new Error('NO_TOKEN');
  } catch (e) {
    await base44.asServiceRole.entities.SpotifyAccount.update(accountId, {
      tokenStatus: 'missing',
      authStatus: 'disconnected',
    }).catch(() => {});
    return Response.json({ error: 'No token stored for this account', code: 'NO_TOKEN' }, { status: 401 });
  }

  try {
    // ── GET DEVICES ───────────────────────────────────────────────────────────
    if (action === 'getDevices') {
      const data = await spotifyFetchWithRefresh(base44, accountId, tokens, 'GET', '/me/player/devices');
      const devices = data.devices || [];

      // Sync to SpotifyDevice entities
      const existingDevices = await base44.asServiceRole.entities.SpotifyDevice.filter({ spotifyAccountId: accountId });

      for (const d of devices) {
        const existing = existingDevices.find(e => e.providerDeviceId === d.id);
        const deviceData = {
          spotifyAccountId: accountId,
          providerDeviceId: d.id,
          name: d.name,
          type: d.type,
          isActive: d.is_active,
          isVisible: true,
          currentVolume: d.volume_percent,
          lastSeenAt: new Date().toISOString(),
        };
        if (existing) {
          await base44.asServiceRole.entities.SpotifyDevice.update(existing.id, deviceData);
        } else {
          await base44.asServiceRole.entities.SpotifyDevice.create(deviceData);
        }
      }

      // Mark devices not in response as not visible
      for (const e of existingDevices) {
        if (!devices.find(d => d.id === e.providerDeviceId)) {
          await base44.asServiceRole.entities.SpotifyDevice.update(e.id, { isVisible: false, isActive: false });
        }
      }

      await base44.asServiceRole.entities.SpotifyAccount.update(accountId, {
        lastApiTestAt: new Date().toISOString(),
        lastApiTestStatus: 'success',
        lastError: '',
      });

      return Response.json({ success: true, devices });
    }

    // ── GET PLAYBACK STATE ────────────────────────────────────────────────────
    if (action === 'getPlaybackState') {
      const data = await spotifyFetchWithRefresh(base44, accountId, tokens, 'GET', '/me/player');
      return Response.json({ success: true, playback: data });
    }

    // ── TRANSFER PLAYBACK ─────────────────────────────────────────────────────
    if (action === 'transferPlayback') {
      const { deviceId } = body;
      if (!deviceId) return Response.json({ error: 'Missing deviceId' }, { status: 400 });
      await spotifyFetchWithRefresh(base44, accountId, tokens, 'PUT', '/me/player', {
        device_ids: [deviceId], play: false,
      });
      return Response.json({ success: true });
    }

    // ── PLAY PLAYLIST ─────────────────────────────────────────────────────────
    if (action === 'playPlaylist') {
      const { contextUri, deviceId } = body;
      if (!contextUri) return Response.json({ error: 'Missing contextUri' }, { status: 400 });
      const qs = deviceId ? `?device_id=${deviceId}` : '';
      await spotifyFetchWithRefresh(base44, accountId, tokens, 'PUT', `/me/player/play${qs}`, { context_uri: contextUri });
      return Response.json({ success: true });
    }

    // ── PAUSE ─────────────────────────────────────────────────────────────────
    if (action === 'pause') {
      const { deviceId } = body;
      const qs = deviceId ? `?device_id=${deviceId}` : '';
      await spotifyFetchWithRefresh(base44, accountId, tokens, 'PUT', `/me/player/pause${qs}`);
      return Response.json({ success: true });
    }

    // ── RESUME ────────────────────────────────────────────────────────────────
    if (action === 'resume') {
      const { deviceId } = body;
      const qs = deviceId ? `?device_id=${deviceId}` : '';
      await spotifyFetchWithRefresh(base44, accountId, tokens, 'PUT', `/me/player/play${qs}`);
      return Response.json({ success: true });
    }

    // ── SET VOLUME ────────────────────────────────────────────────────────────
    if (action === 'setVolume') {
      const { volume, deviceId } = body;
      if (volume === undefined) return Response.json({ error: 'Missing volume' }, { status: 400 });
      const vol = Math.round(Math.max(0, Math.min(100, volume)));
      const qs = deviceId ? `?volume_percent=${vol}&device_id=${deviceId}` : `?volume_percent=${vol}`;
      await spotifyFetchWithRefresh(base44, accountId, tokens, 'PUT', `/me/player/volume${qs}`);
      return Response.json({ success: true });
    }

    // ── NEXT / PREVIOUS ───────────────────────────────────────────────────────
    if (action === 'next') {
      const { deviceId } = body;
      const qs = deviceId ? `?device_id=${deviceId}` : '';
      await spotifyFetchWithRefresh(base44, accountId, tokens, 'POST', `/me/player/next${qs}`);
      return Response.json({ success: true });
    }
    if (action === 'previous') {
      const { deviceId } = body;
      const qs = deviceId ? `?device_id=${deviceId}` : '';
      await spotifyFetchWithRefresh(base44, accountId, tokens, 'POST', `/me/player/previous${qs}`);
      return Response.json({ success: true });
    }

    // ── GET USER PLAYLISTS ────────────────────────────────────────────────────
    if (action === 'getUserPlaylists') {
      const limit = body.limit || 50;
      const offset = body.offset || 0;
      const data = await spotifyFetchWithRefresh(base44, accountId, tokens, 'GET', `/me/playlists?limit=${limit}&offset=${offset}`);
      return Response.json({ success: true, playlists: data.items || [], total: data.total || 0, next: data.next });
    }

    // ── GET PLAYLIST TRACKS ───────────────────────────────────────────────────
    if (action === 'getPlaylistTracks') {
      const { playlistId, offset = 0 } = body;
      if (!playlistId) return Response.json({ error: 'Missing playlistId' }, { status: 400 });
      const data = await spotifyFetchWithRefresh(base44, accountId, tokens, 'GET',
        `/playlists/${playlistId}/tracks?limit=50&offset=${offset}&fields=items(track(id,uri,name,artists,album,duration_ms,explicit)),total,next`
      );
      return Response.json({ success: true, tracks: data.items || [], total: data.total || 0, next: data.next });
    }

    // ── IMPORT PLAYLIST TRACKS (paginated, saves to DB) ───────────────────────
    if (action === 'importPlaylistTracks') {
      const { playlistId: dbPlaylistId, spotifyPlaylistId } = body;
      if (!dbPlaylistId || !spotifyPlaylistId) return Response.json({ error: 'Missing playlistId or spotifyPlaylistId' }, { status: 400 });

      // Delete existing tracks
      const existing = await base44.asServiceRole.entities.PlaylistTrack.filter({ playlistId: dbPlaylistId });
      await Promise.all(existing.map(t => base44.asServiceRole.entities.PlaylistTrack.delete(t.id)));

      let offset = 0;
      let totalImported = 0;
      let hasMore = true;

      while (hasMore) {
        const data = await spotifyFetchWithRefresh(base44, accountId, tokens, 'GET',
          `/playlists/${spotifyPlaylistId}/tracks?limit=50&offset=${offset}&fields=items(track(id,uri,name,artists,album,duration_ms,explicit)),total,next`
        );
        const items = data.items || [];
        for (let i = 0; i < items.length; i++) {
          const t = items[i]?.track;
          if (!t || !t.id) continue;
          await base44.asServiceRole.entities.PlaylistTrack.create({
            playlistId: dbPlaylistId,
            providerTrackId: t.id,
            providerTrackUri: t.uri,
            name: t.name,
            artist: t.artists?.map(a => a.name).join(', ') || '',
            album: t.album?.name || '',
            durationMs: t.duration_ms || 0,
            coverUrl: t.album?.images?.[0]?.url || '',
            explicit: t.explicit || false,
            sortOrder: offset + i,
          });
          totalImported++;
        }
        offset += 50;
        hasMore = !!data.next && items.length === 50;
      }

      await base44.asServiceRole.entities.Playlist.update(dbPlaylistId, {
        importedTracks: totalImported,
        syncStatus: 'synced',
        lastSyncAt: new Date().toISOString(),
      });

      return Response.json({ success: true, imported: totalImported });
    }

    // ── TEST DEVICE SEQUENCE ──────────────────────────────────────────────────
    if (action === 'testDevice') {
      const { deviceId: targetDeviceId, playlistUri } = body;
      const results = [];

      const step = (name, status, tech, human, fix = '') => {
        results.push({ name, status, tech, human, fix });
      };

      // Step 1: Token check
      step('Token prüfen', 'running', '', '');
      try {
        await spotifyFetchWithRefresh(base44, accountId, tokens, 'GET', '/me');
        results[results.length - 1] = { name: 'Token prüfen', status: 'success', tech: 'API /me returned 200', human: 'Token ist gültig.' };
      } catch (e) {
        results[results.length - 1] = { name: 'Token prüfen', status: 'error', tech: e.message, human: 'Token ungültig oder abgelaufen.', fix: 'Spotify Account erneut verbinden.' };
        return Response.json({ success: false, results });
      }

      // Step 2: Get devices
      let devices = [];
      try {
        const devData = await spotifyFetchWithRefresh(base44, accountId, tokens, 'GET', '/me/player/devices');
        devices = devData.devices || [];
        step('Geräte laden', 'success', `${devices.length} Gerät(e) gefunden`, `${devices.length} Gerät(e) für diesen Account sichtbar.`);
      } catch (e) {
        step('Geräte laden', 'error', e.message, 'Spotify-Geräte konnten nicht abgerufen werden.', 'Prüfe ob Spotify auf dem Zielgerät offen ist.');
        return Response.json({ success: false, results });
      }

      if (devices.length === 0) {
        step('Zielgerät suchen', 'error', 'No devices returned', 'Kein Spotify-Gerät für diesen Account gefunden.', 'Öffne die Spotify App auf dem Gerät und starte kurz eine Wiedergabe. Dann erneut testen.');
        return Response.json({ success: false, results });
      }

      // Step 3: Find target device
      const target = targetDeviceId ? devices.find(d => d.id === targetDeviceId) : devices[0];
      if (!target) {
        step('Zielgerät suchen', 'warning', `Target deviceId ${targetDeviceId} not in list`, 'Das ausgewählte Zielgerät ist aktuell nicht sichtbar.', 'Öffne Spotify auf dem Zielgerät oder wähle ein anderes Gerät.');
      } else {
        step('Zielgerät suchen', 'success', `Found: ${target.name} (${target.type})`, `Zielgerät "${target.name}" ist sichtbar.`);
      }

      // Step 4: Playback state
      let playbackState = null;
      try {
        playbackState = await spotifyFetchWithRefresh(base44, accountId, tokens, 'GET', '/me/player');
        step('Playback State abrufen', 'success', `device: ${playbackState?.device?.name || 'none'}, playing: ${playbackState?.is_playing}`, 'Wiedergabestatus erfolgreich abgerufen.');
      } catch (e) {
        step('Playback State abrufen', 'warning', e.message, 'Wiedergabestatus konnte nicht abgerufen werden.', 'Kein aktiver Player gefunden. Starte Wiedergabe auf dem Gerät.');
      }

      // Step 5: Transfer playback
      if (target) {
        try {
          await spotifyFetchWithRefresh(base44, accountId, tokens, 'PUT', '/me/player', { device_ids: [target.id], play: false });
          step('Playback Transfer', 'success', `Transferred to ${target.id}`, `Wiedergabe auf "${target.name}" übertragen.`);
        } catch (e) {
          step('Playback Transfer', 'error', e.message,
            'Wiedergabe konnte nicht auf das Gerät übertragen werden.',
            'Stelle sicher, dass Spotify auf dem Gerät aktiv ist und der richtige Account angemeldet ist.');
        }
      }

      // Step 6: Set volume
      if (target) {
        try {
          await spotifyFetchWithRefresh(base44, accountId, tokens, 'PUT', `/me/player/volume?volume_percent=50&device_id=${target.id}`);
          step('Lautstärke setzen (50%)', 'success', 'volume_percent=50 OK', 'Lautstärke konnte gesetzt werden.');

          // Update device record
          const existing = await base44.asServiceRole.entities.SpotifyDevice.filter({ providerDeviceId: target.id, spotifyAccountId: accountId });
          if (existing.length) {
            await base44.asServiceRole.entities.SpotifyDevice.update(existing[0].id, {
              isControllable: true, volumeControllable: true, lastTestAt: new Date().toISOString(), lastTestStatus: 'success',
            });
          }
        } catch (e) {
          step('Lautstärke setzen', 'warning', e.message,
            'Das Gerät ist sichtbar, aber Lautstärke konnte nicht gesetzt werden.',
            'Möglicherweise unterstützt dieses Gerät oder die aktuelle Spotify-Situation keine Remote-Lautstärke. Öffne Spotify direkt auf dem Gerät.');

          const existing = await base44.asServiceRole.entities.SpotifyDevice.filter({ providerDeviceId: target.id, spotifyAccountId: accountId });
          if (existing.length) {
            await base44.asServiceRole.entities.SpotifyDevice.update(existing[0].id, {
              isControllable: true, volumeControllable: false, lastTestAt: new Date().toISOString(), lastTestStatus: 'partial',
            });
          }
        }
      }

      const hasError = results.some(r => r.status === 'error');
      const hasWarning = results.some(r => r.status === 'warning');

      await base44.asServiceRole.entities.Zone.update(body.zoneId || '', {
        lastTestAt: new Date().toISOString(),
        currentStatus: hasError ? 'error' : 'ready',
        lastError: hasError ? results.find(r => r.status === 'error')?.tech : '',
      }).catch(() => {});

      return Response.json({ success: !hasError, results });
    }

    return Response.json({ error: 'Unknown action' }, { status: 400 });

  } catch (e) {
    // Mark token expired if relevant
    if (e.message === 'TOKEN_EXPIRED') {
      await base44.asServiceRole.entities.SpotifyAccount.update(accountId, {
        tokenStatus: 'expired', authStatus: 'expired', lastError: 'Token abgelaufen',
      }).catch(() => {});
      return Response.json({ error: 'Token expired. Please reconnect this Spotify account.', code: 'TOKEN_EXPIRED' }, { status: 401 });
    }
    return Response.json({ error: e.message }, { status: 500 });
  }
});