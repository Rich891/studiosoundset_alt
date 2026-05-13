import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const CLIENT_ID = Deno.env.get('SPOTIFY_CLIENT_ID');
const CLIENT_SECRET = Deno.env.get('SPOTIFY_CLIENT_SECRET');
const SPOTIFY_TOKEN_URL = 'https://accounts.spotify.com/api/token';

Deno.serve(async (req) => {
  // Parse request body
  let body;
  try {
    body = await req.json();
  } catch (e) {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { action, code, redirectUri, refreshToken, providerId, scopes } = body;

  // Initialize base44 ONCE for all actions
  let base44;
  try {
    base44 = createClientFromRequest(req);
  } catch (e) {
    console.error('Base44 client initialization failed:', e.message);
    // Only getAuthUrl can work without auth
    if (action !== 'getAuthUrl') {
      return Response.json({ error: 'Authentication required' }, { status: 401 });
    }
  }

  // Validate secrets
  if (!CLIENT_ID || !CLIENT_SECRET) {
    return Response.json({ error: 'Spotify credentials not configured' }, { status: 500 });
  }

  // Build Basic Auth header for Spotify
  const authHeader = 'Basic ' + btoa(`${CLIENT_ID}:${CLIENT_SECRET}`);

  // ============================================================================
  // ACTION: GET AUTH URL (no auth required, generates Spotify OAuth link)
  // ============================================================================
  if (action === 'getAuthUrl') {
    if (!redirectUri || !providerId) {
      return Response.json({ error: 'Missing redirectUri or providerId' }, { status: 400 });
    }

    // Use provided scopes or defaults
    const scopeStr = scopes || [
      'user-read-private',
      'user-read-email',
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
      scope: scopeStr,
      state: providerId, // Store provider ID in state
    });

    return Response.json({
      url: `https://accounts.spotify.com/authorize?${params.toString()}`,
    });
  }

  // For remaining actions, require base44
  if (!base44) {
    return Response.json({ error: 'Authentication required' }, { status: 401 });
  }

  // ============================================================================
  // ACTION: EXCHANGE (OAuth callback - exchange code for access token)
  // ============================================================================
  if (action === 'exchange') {
    if (!code || !redirectUri) {
      return Response.json({ error: 'Missing code or redirectUri' }, { status: 400 });
    }

    try {
      // Exchange code for tokens via Spotify
      const tokenParams = new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: redirectUri,
      });

      const tokenRes = await fetch(SPOTIFY_TOKEN_URL, {
        method: 'POST',
        headers: {
          'Authorization': authHeader,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: tokenParams.toString(),
      });

      const tokenData = await tokenRes.json();

      if (!tokenRes.ok) {
        console.error('Spotify token exchange failed:', tokenData);
        return Response.json(
          { error: tokenData.error_description || 'Token exchange failed' },
          { status: 400 }
        );
      }

      // Fetch user info from Spotify
      let spotifyUserEmail = '';
      let spotifyUserId = '';
      try {
        const meRes = await fetch('https://api.spotify.com/v1/me', {
          headers: { 'Authorization': `Bearer ${tokenData.access_token}` },
        });
        const me = await meRes.json();
        spotifyUserEmail = me.email || '';
        spotifyUserId = me.id || '';
      } catch (e) {
        console.error('Failed to fetch Spotify user info:', e.message);
      }

      // Save tokens and user info to Provider entity
      if (providerId) {
        const expiresAt = new Date(Date.now() + tokenData.expires_in * 1000).toISOString();
        await base44.asServiceRole.entities.Provider.update(providerId, {
          accessToken: tokenData.access_token,
          refreshToken: tokenData.refresh_token || undefined,
          tokenExpiresAt: expiresAt,
          status: 'connected',
          spotifyUserEmail,
          spotifyUserId,
          lastTestAt: new Date().toISOString(),
        });
      }

      return Response.json({
        success: true,
        expiresIn: tokenData.expires_in,
        email: spotifyUserEmail,
      });
    } catch (error) {
      console.error('Exchange action failed:', error.message);
      return Response.json({ error: error.message }, { status: 500 });
    }
  }

  // ============================================================================
  // ACTION: REFRESH (Refresh expired access token)
  // ============================================================================
  if (action === 'refresh') {
    if (!refreshToken) {
      return Response.json({ error: 'Missing refreshToken' }, { status: 400 });
    }

    try {
      const refreshParams = new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
      });

      const refreshRes = await fetch(SPOTIFY_TOKEN_URL, {
        method: 'POST',
        headers: {
          'Authorization': authHeader,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: refreshParams.toString(),
      });

      const refreshData = await refreshRes.json();

      if (!refreshRes.ok) {
        console.error('Spotify token refresh failed:', refreshData);
        return Response.json(
          { error: refreshData.error_description || 'Token refresh failed' },
          { status: 400 }
        );
      }

      // Update Provider with new access token
      if (providerId) {
        const expiresAt = new Date(Date.now() + refreshData.expires_in * 1000).toISOString();
        await base44.asServiceRole.entities.Provider.update(providerId, {
          accessToken: refreshData.access_token,
          tokenExpiresAt: expiresAt,
          status: 'connected',
          lastTestAt: new Date().toISOString(),
        });
      }

      return Response.json({
        success: true,
        accessToken: refreshData.access_token,
        expiresIn: refreshData.expires_in,
      });
    } catch (error) {
      console.error('Refresh action failed:', error.message);
      return Response.json({ error: error.message }, { status: 500 });
    }
  }

  // ============================================================================
  // ACTION: GET TOKEN (internal - fetch stored access token)
  // ============================================================================
  if (action === 'getToken') {
    if (!providerId) {
      return Response.json({ error: 'Missing providerId' }, { status: 400 });
    }

    try {
      const provider = await base44.asServiceRole.entities.Provider.filter({ id: providerId });
      if (!provider.length || !provider[0].accessToken) {
        return Response.json({ error: 'No token found' }, { status: 404 });
      }
      return Response.json({ accessToken: provider[0].accessToken });
    } catch (error) {
      console.error('Get token failed:', error.message);
      return Response.json({ error: error.message }, { status: 500 });
    }
  }

  // Unknown action
  return Response.json({ error: 'Unknown action' }, { status: 400 });
});