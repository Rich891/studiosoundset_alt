import { createClientFromRequest } from 'npm:@base44/sdk';

const ADMIN_ROLES = new Set(['owner', 'admin', 'staff']);

function randomToken(prefix = 'session') {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return `${prefix}_${Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('')}`;
}

function slugify(value = 'player') {
  return String(value).trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'player';
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch(() => null);
    const role = String(user?.role || '').toLowerCase();

    if (!user || !ADMIN_ROLES.has(role)) {
      return Response.json({ success: false, error: 'Nur Owner/Admin/Staff können Player erstellen' }, { status: 403 });
    }

    const { name, providerId, apiCredentialSetId, spotifyAccountId, spotifyClientId, zoneId, passwordHash, email } = await req.json();
    const resolvedProviderId = providerId || apiCredentialSetId || spotifyAccountId || '';

    if (!name || !resolvedProviderId || !passwordHash) {
      return Response.json({ success: false, error: 'name, providerId und passwordHash erforderlich' }, { status: 400 });
    }

    const provider = await base44.asServiceRole.entities.Provider.get(resolvedProviderId).catch(() => null);
    if (!provider) {
      return Response.json({ success: false, error: 'Provider nicht gefunden' }, { status: 404 });
    }

    const shortId = Math.random().toString(36).slice(2, 8).toUpperCase();
    const deviceId = `player-${shortId}`;
    const playerEmail = email || `${slugify(name)}-${shortId.toLowerCase()}@studiosoundset.player`;
    const sessionToken = randomToken('session');
    const setupToken = randomToken('setup');

    const player = await base44.asServiceRole.entities.Player.create({
      name,
      email: playerEmail,
      passwordHash,
      zoneId: zoneId || '',
      deviceId,
      providerId: resolvedProviderId,
      apiCredentialSetId: resolvedProviderId,
      spotifyAccountId: resolvedProviderId,
      spotifyClientId: spotifyClientId || provider.clientId || '',
      role: 'player',
      isActive: true,
      isOnline: false,
      isPaired: false,
      sdkLoaded: false,
      sdkReady: false,
      sdkConnected: false,
      spotifyDeviceId: '',
      sessionToken,
      setupToken,
      lastCommand: '',
      lastCommandStatus: '',
      lastError: '',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    return Response.json({
      success: true,
      playerUser: {
        ...player,
        id: player.id,
        deviceId,
        email: playerEmail,
        name,
        providerId: resolvedProviderId,
        apiCredentialSetId: resolvedProviderId,
        spotifyAccountId: resolvedProviderId,
        spotifyClientId: spotifyClientId || provider.clientId || '',
        zoneId: zoneId || '',
        sessionToken,
        setupToken,
      },
    });
  } catch (error) {
    console.error('Create player user error:', error);
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
});
