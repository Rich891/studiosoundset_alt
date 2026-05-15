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

function slugify(value = 'player') {
  return String(value)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'player';
}

function makePlayerEmail(name) {
  const suffix = Math.random().toString(36).slice(2, 8);
  return `${slugify(name)}-${suffix}@studiosoundset.player`;
}

function makeSessionToken(player) {
  return `player_${player.id}_${Date.now()}_${Math.random().toString(36).slice(2)}`;
}

async function getProvider(accountId) {
  if (!accountId) throw new Error('Spotify Provider ID fehlt.');
  return client.entities.Provider.get(accountId);
}

async function getAccessTokenForProvider(accountId) {
  const provider = await getProvider(accountId);
  const accessToken = await getUsableSpotifyAccessToken(provider, async (id, patch) => {
    await client.entities.Provider.update(id, patch);
  });
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

async function createPlayerUserFallback(payload = {}) {
  const name = payload.name?.trim();
  const providerId = payload.providerId;
  const passwordHash = payload.passwordHash?.trim();
  if (!name) throw new Error('Player Name fehlt.');
  if (!providerId) throw new Error('Spotify Provider fehlt.');
  if (!passwordHash) throw new Error('Player Passwort fehlt.');

  const playerPayload = {
    name,
    email: payload.email || makePlayerEmail(name),
    passwordHash,
    providerId,
    zoneId: payload.zoneId || '',
    role: 'player',
    status: 'inactive',
    isActive: true,
    isOnline: false,
    isPaired: false,
    sdkLoaded: false,
    sdkReady: false,
    sdkConnected: false,
    spotifyDeviceId: '',
    lastCommand: '',
    lastCommandStatus: '',
    lastError: '',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const playerUser = await client.entities.Player.create(playerPayload);
  return { data: { success: true, playerUser, fallback: true } };
}

async function playerAuthLoginFallback(payload = {}) {
  const email = payload.email?.trim();
  const password = payload.password?.trim();
  if (!email || !password) return { data: { success: false, error: 'Email und Passwort erforderlich.' } };

  const matches = await client.entities.Player.filter({ email });
  const player = (matches || []).find((candidate) => candidate.passwordHash === password && candidate.isActive !== false);
  if (!player) return { data: { success: false, error: 'Player Login ungültig oder Player deaktiviert.' } };

  const patch = {
    status: 'online',
    isOnline: true,
    lastSeen: new Date().toISOString(),
    lastHeartbeatAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  await client.entities.Player.update(player.id, patch).catch(() => {});

  return {
    data: {
      success: true,
      sessionToken: makeSessionToken(player),
      player: { ...player, ...patch },
      fallback: true,
    },
  };
}

function isFunctionMissingError(error) {
  return error?.status === 404 || error?.response?.status === 404 || /status code 404|not found/i.test(error?.message || '');
}

const originalInvoke = client.functions.invoke.bind(client.functions);
client.functions.invoke = async (name, payload) => {
  try {
    return await originalInvoke(name, payload);
  } catch (error) {
    if (isFunctionMissingError(error)) {
      if (name === 'spotifyAccountControl') return spotifyAccountControlFallback(payload);
      if (name === 'createPlayerUserNew') return createPlayerUserFallback(payload);
      if (name === 'playerAuthLogin') return playerAuthLoginFallback(payload);
    }
    throw error;
  }
};

export const base44 = client;
