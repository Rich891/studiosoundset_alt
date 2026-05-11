import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const SPOTIFY_API = 'https://api.spotify.com/v1';

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);

  let body;
  try { body = await req.json(); } catch { return Response.json({ error: 'Invalid JSON' }, { status: 400 }); }
  const { providerId } = body;

  if (!providerId) return Response.json({ error: 'Missing providerId' }, { status: 400 });

  // Load stored access token
  const tokenKey = `spotify_access_token_${providerId}`;
  const settings = await base44.asServiceRole.entities.AppSetting.filter({ key: tokenKey });

  if (!settings.length) {
    await base44.asServiceRole.entities.Provider.update(providerId, {
      connectionStatus: 'disconnected',
      lastConnectionTestAt: new Date().toISOString(),
    });
    return Response.json({ success: false, status: 'disconnected', reason: 'No token stored' });
  }

  const accessToken = settings[0].value;

  // Test: call /me
  const meRes = await fetch(`${SPOTIFY_API}/me`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!meRes.ok) {
    await base44.asServiceRole.entities.Provider.update(providerId, {
      connectionStatus: 'expired',
      lastConnectionTestAt: new Date().toISOString(),
    });
    return Response.json({ success: false, status: 'expired', reason: 'Token invalid or expired' });
  }

  const profile = await meRes.json();

  // Test: get devices
  const devicesRes = await fetch(`${SPOTIFY_API}/me/player/devices`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const devicesData = devicesRes.ok ? await devicesRes.json() : { devices: [] };

  await base44.asServiceRole.entities.Provider.update(providerId, {
    connectionStatus: 'connected',
    lastConnectionTestAt: new Date().toISOString(),
    lastSyncAt: new Date().toISOString(),
  });

  await base44.asServiceRole.entities.AuditLog.create({
    action: 'Spotify Verbindungstest erfolgreich',
    entityType: 'Provider',
    entityId: providerId,
    status: 'success',
    newValue: profile.display_name || profile.email,
  });

  return Response.json({
    success: true,
    status: 'connected',
    profile: {
      displayName: profile.display_name,
      email: profile.email,
      country: profile.country,
      product: profile.product,
    },
    devices: devicesData.devices || [],
  });
});