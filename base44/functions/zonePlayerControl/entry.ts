import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { action, zoneId, playerId, data } = await req.json();

    // Zone actions
    if (action === 'createZone') {
      const zone = await base44.entities.Zone.create({
        name: data.name,
        providerId: data.providerId,
        description: data.description || '',
        color: data.color || '#6366f1',
        defaultVolume: data.defaultVolume || 50,
        minVolume: data.minVolume || 0,
        maxVolume: data.maxVolume || 100,
        isActive: true,
      });
      return Response.json({ success: true, zone });
    }

    if (action === 'updateZone') {
      const zone = await base44.entities.Zone.update(zoneId, {
        name: data.name,
        providerId: data.providerId,
        description: data.description,
        color: data.color,
        defaultVolume: data.defaultVolume,
        minVolume: data.minVolume,
        maxVolume: data.maxVolume,
        isActive: data.isActive !== undefined ? data.isActive : true,
      });
      return Response.json({ success: true, zone });
    }

    if (action === 'deleteZone') {
      await base44.entities.Zone.delete(zoneId);
      return Response.json({ success: true });
    }

    // Player actions
    if (action === 'createPlayer') {
      const player = await base44.entities.Player.create({
        name: data.name,
        zoneId: data.zoneId,
        email: data.email,
        passwordHash: data.passwordHash,
        deviceId: data.deviceId,
        isPaired: data.isPaired || false,
        isActive: true,
        isOnline: false,
        volume: data.volume || 50,
      });
      return Response.json({ success: true, player });
    }

    if (action === 'updatePlayer') {
      const player = await base44.entities.Player.update(playerId, {
        name: data.name,
        volume: data.volume,
        isActive: data.isActive,
        isPaired: data.isPaired,
        isOnline: data.isOnline,
        currentTrackName: data.currentTrackName,
        currentTrackArtist: data.currentTrackArtist,
        currentTrackAlbum: data.currentTrackAlbum,
        currentTrackCoverUrl: data.currentTrackCoverUrl,
        isPlaying: data.isPlaying,
        progressMs: data.progressMs,
        lastStatusUpdate: new Date().toISOString(),
      });
      return Response.json({ success: true, player });
    }

    if (action === 'deletePlayer') {
      await base44.entities.Player.delete(playerId);
      return Response.json({ success: true });
    }

    return Response.json({ error: 'Unknown action' }, { status: 400 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});