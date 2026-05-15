const AUTH_URL = 'https://accounts.spotify.com/authorize';
const TOKEN_URL = 'https://accounts.spotify.com/api/token';

export const SPOTIFY_SCOPES = [
  'streaming',
  'user-read-email',
  'user-read-private',
  'user-read-playback-state',
  'user-modify-playback-state',
  'user-read-currently-playing',
  'playlist-read-private',
  'playlist-read-collaborative',
].join(' ');

function base64UrlEncode(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  bytes.forEach((byte) => { binary += String.fromCharCode(byte); });
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function randomString(length = 64) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~';
  const random = new Uint8Array(length);
  crypto.getRandomValues(random);
  return Array.from(random, (byte) => chars[byte % chars.length]).join('');
}

export async function createCodeChallenge(verifier) {
  const encoded = new TextEncoder().encode(verifier);
  const digest = await crypto.subtle.digest('SHA-256', encoded);
  return base64UrlEncode(digest);
}

export function getSpotifyRedirectUri() {
  return `${window.location.origin}/spotify-callback`;
}

export function getPkceStorageKey(state) {
  return `studiosoundset_spotify_pkce_${state}`;
}

export async function buildSpotifyAuthorizeUrl({ provider, redirectUri = getSpotifyRedirectUri(), scopes = SPOTIFY_SCOPES }) {
  if (!provider?.id) throw new Error('Provider fehlt.');
  if (!provider.clientId) throw new Error('Spotify Client ID fehlt.');
  if (!window.crypto?.subtle) throw new Error('Dieser Browser unterstützt kein Web Crypto PKCE. Bitte aktuellen Chrome/Safari verwenden.');

  const state = provider.id;
  const codeVerifier = randomString(96);
  const codeChallenge = await createCodeChallenge(codeVerifier);

  sessionStorage.setItem(getPkceStorageKey(state), JSON.stringify({
    providerId: provider.id,
    codeVerifier,
    redirectUri,
    createdAt: new Date().toISOString(),
  }));

  const params = new URLSearchParams({
    response_type: 'code',
    client_id: provider.clientId,
    scope: scopes,
    redirect_uri: redirectUri,
    state,
    code_challenge_method: 'S256',
    code_challenge: codeChallenge,
    show_dialog: 'true',
  });

  return `${AUTH_URL}?${params.toString()}`;
}

export async function exchangeSpotifyCodeWithPkce({ code, provider, state, redirectUri = getSpotifyRedirectUri() }) {
  if (!code) throw new Error('Spotify Callback enthält keinen Code.');
  if (!provider?.clientId) throw new Error('Provider hat keine Spotify Client ID.');

  const storedRaw = sessionStorage.getItem(getPkceStorageKey(state || provider.id));
  if (!storedRaw) {
    throw new Error('PKCE Session fehlt. Starte Spotify Connect bitte erneut aus derselben Browser-Session.');
  }

  const stored = JSON.parse(storedRaw);
  if (!stored.codeVerifier) throw new Error('PKCE Code Verifier fehlt. Starte Spotify Connect erneut.');

  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    redirect_uri: stored.redirectUri || redirectUri,
    client_id: provider.clientId,
    code_verifier: stored.codeVerifier,
  });

  const response = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error_description || data.error || `Spotify Token Exchange failed (${response.status})`);
  }

  sessionStorage.removeItem(getPkceStorageKey(state || provider.id));
  return data;
}

export async function refreshSpotifyAccessToken(provider) {
  if (!provider?.clientId) throw new Error('Provider hat keine Spotify Client ID.');
  if (!provider?.refreshToken) throw new Error('Provider hat keinen Spotify Refresh Token. Bitte erneut verbinden.');

  const response = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: provider.refreshToken,
      client_id: provider.clientId,
    }),
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error_description || data.error || `Spotify Token Refresh failed (${response.status})`);
  }

  return data;
}

export function getTokenExpiryIso(expiresInSeconds = 3600) {
  return new Date(Date.now() + Math.max(60, Number(expiresInSeconds) - 60) * 1000).toISOString();
}

export async function fetchSpotifyMe(accessToken) {
  const response = await fetch('https://api.spotify.com/v1/me', {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error?.message || data.error || `Spotify profile failed (${response.status})`);
  return data;
}
