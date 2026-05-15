import { createClient } from '@base44/sdk';
import { appParams } from '@/lib/app-params';
import { getUsableSpotifyAccessToken, spotifyApiRequest } from '@/lib/spotifyPkceAuth';

const { appId, token, functionsVersion, appBaseUrl } = appParams;

const client = createClient({
  appId,
  token,
  functionsVersion,
  serverUrl: '',
  requiresAuth: false,
  appBaseUrl,
});

async function getProvider(accountId) {
  if (!accountId) throw new Error('Spotify Provider ID fehlt.');
  return client.entities.Provider.get(accountId);
}

async function getAccessTokenForProvider(accountId) {
  const provider = await getProvider(accountId);
  const accessToken = await getUsableSpotifyAccessToken(provider, (id, patch) => client.entities.Provider.update(id, patch));
  return { provider, accessToken };
}

async function spotifyAccountControlFallback(payload = {}) {
  const { action, accountId, deviceId, contextUri, offset } = payload;
  if (!action) throw new Error('spotifyAccountControl action fehlt.');
  const { accessToken } = await getAccessTokenForProvider(accountId);

  if (action === 'getAccessToken') {
    return { data: { success: true, accessToken } };
  }

  if (action === 'transferPlayback') {
    await spotifyApiRequest('/me/player', {
      method: 'PUT',
      accessToken,
      body: { device_ids: [deviceId], play: false },
    });
    return { data: { success: true } };
  }

  if (action === 'playPlaylist') {
    if (!deviceId) throw new Error('Spotify Device ID fehlt.');
    if (!contextUri) throw new Error('Spotify Playlist URI fehlt.');
    await spotifyApiRequest(`/me/player/play?device_id=${encodeURIComponent(deviceId)}`, {
      method: 'PUT',
      accessToken,
      body: { context_uri: contextUri, ...(offset ? { offset } : {}) },
    });
    return { data: { success: true } };
  }

  if (action === 'getDevices') {
    const data = await spotifyApiRequest('/me/player/devices', { accessToken });
    return { data: { success: true, devices: data.devices || [] } };
  }

  if (action === 'getUserPlaylists') {
    const playlists = [];
    let offsetValue = 0;
    let total = 0;
    do {
      const data = await spotifyApiRequest(`/me/playlists?limit=50&offset=${offsetValue}`, { accessToken });
      playlists.push(...(data.items || []));
      total = data.total || playlists.length;
      offsetValue += data.limit || 50;
      if (!data.next) break;
    } while (playlists.length < total);
    return { data: { success: true, playlists, total } };
  }

  throw new Error(`Base44 Function spotifyAccountControl fehlt und es gibt keinen Fallback für action=${action}.`);
}

function isFunctionMissingError(error) {
  return error?.status === 404 || error?.response?.status === 404 || /status code 404|not found/i.test(error?.message || '');
}

const originalInvoke = client.functions.invoke.bind(client.functions);
client.functions.invoke = async (name, payload) => {
  try {
    return await originalInvoke(name, payload);
  } catch (error) {
    if (name === 'spotifyAccountControl' && isFunctionMissingError(error)) {
      return spotifyAccountControlFallback(payload);
    }
    throw error;
  }
};

export const base44 = client;
