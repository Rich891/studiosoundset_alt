import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const CLIENT_ID = Deno.env.get('SPOTIFY_CLIENT_ID');
const CLIENT_SECRET = Deno.env.get('SPOTIFY_CLIENT_SECRET');
const SPOTIFY_TOKEN_URL = 'https://accounts.spotify.com/api/token';

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);

  const body = await req.json();
  const { action, code, redirectUri, refreshToken, providerId, scopes } = body;

  // exchange action doesn't require auth (called after Spotify redirect, no user token available)
  if (action !== 'exchange') {
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Build auth header
  const authHeader = 'Basic ' + btoa(`${CLIENT_ID}:${CLIENT_SECRET}`);

  // ── GET AUTH URL (frontend doesn't need client_id) ───────────────────────────
  if (action === 'getAuthUrl') {
    if (!redirectUri || !providerId) return Response.json({ error: 'Missing redirectUri or providerId' }, { status: 400 });
    const scopeStr = scopes || [
      'user-read-private', 'user-read-email',
      'user-read-playback-state', 'user-modify-playback-state',
      'user-read-currently-playing', 'playlist-read-private',
      'playlist-read-collaborative', 'streaming',
    ].join(' ');
    const params = new URLSearchParams({
      client_id: CLIENT_ID,
      response_type: 'code',
      redirect_uri: redirectUri,
      scope: scopeStr,
      state: providerId,
    });
    return Response.json({ url: `https://accounts.spotify.com/authorize?${params.toString()}` });
  }

  // ── EXCHANGE CODE FOR TOKEN ──────────────────────────────────────────────────
  if (action === 'exchange') {
    if (!code || !redirectUri) return Response.json({ error: 'Missing code or redirectUri' }, { status: 400 });

    const params = new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri,
    });

    const res = await fetch(SPOTIFY_TOKEN_URL, {
      method: 'POST',
      headers: { Authorization: authHeader, 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
    });
    const data = await res.json();
    if (!res.ok) return Response.json({ error: data.error_description || 'Token exchange failed' }, { status: 400 });

    // Persist tokens in Provider entity
    if (providerId) {
      const expiresAt = new Date(Date.now() + data.expires_in * 1000).toISOString();
      await base44.asServiceRole.entities.Provider.update(providerId, {
        accessTokenStored: true,
        refreshTokenStored: !!data.refresh_token,
        tokenExpiresAt: expiresAt,
        connectionStatus: 'connected',
        lastConnectionTestAt: new Date().toISOString(),
      });
      // Store tokens in AppSetting (keyed by providerId)
      const tokenKey = `spotify_access_token_${providerId}`;
      const refreshKey = `spotify_refresh_token_${providerId}`;
      await upsertSetting(base44, tokenKey, data.access_token, 'spotify_tokens');
      if (data.refresh_token) {
        await upsertSetting(base44, refreshKey, data.refresh_token, 'spotify_tokens');
      }
    }

    return Response.json({ success: true, expiresIn: data.expires_in });
  }

  // ── REFRESH TOKEN ────────────────────────────────────────────────────────────
  if (action === 'refresh') {
    if (!refreshToken) return Response.json({ error: 'Missing refreshToken' }, { status: 400 });

    const params = new URLSearchParams({ grant_type: 'refresh_token', refresh_token: refreshToken });
    const res = await fetch(SPOTIFY_TOKEN_URL, {
      method: 'POST',
      headers: { Authorization: authHeader, 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
    });
    const data = await res.json();
    if (!res.ok) return Response.json({ error: data.error_description || 'Refresh failed' }, { status: 400 });

    if (providerId) {
      const expiresAt = new Date(Date.now() + data.expires_in * 1000).toISOString();
      await base44.asServiceRole.entities.Provider.update(providerId, {
        accessTokenStored: true,
        tokenExpiresAt: expiresAt,
        connectionStatus: 'connected',
      });
      const tokenKey = `spotify_access_token_${providerId}`;
      await upsertSetting(base44, tokenKey, data.access_token, 'spotify_tokens');
    }

    return Response.json({ success: true, accessToken: data.access_token });
  }

  // ── GET ACCESS TOKEN (for internal use) ──────────────────────────────────────
  if (action === 'getToken') {
    if (!providerId) return Response.json({ error: 'Missing providerId' }, { status: 400 });
    const tokenKey = `spotify_access_token_${providerId}`;
    const settings = await base44.asServiceRole.entities.AppSetting.filter({ key: tokenKey });
    if (!settings.length) return Response.json({ error: 'No token stored' }, { status: 404 });
    return Response.json({ accessToken: settings[0].value });
  }

  return Response.json({ error: 'Unknown action' }, { status: 400 });
});

async function upsertSetting(base44, key, value, category) {
  const existing = await base44.asServiceRole.entities.AppSetting.filter({ key });
  if (existing.length > 0) {
    await base44.asServiceRole.entities.AppSetting.update(existing[0].id, { value, category });
  } else {
    await base44.asServiceRole.entities.AppSetting.create({ key, value, category });
  }
}