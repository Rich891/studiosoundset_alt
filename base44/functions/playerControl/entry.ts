import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { playerId, command, payload } = await req.json();

    if (!playerId || !command) {
      return Response.json({ error: 'Missing playerId or command' }, { status: 400 });
    }

    // Hole Player
    const player = await base44.entities.Player.get(playerId);
    if (!player) {
      return Response.json({ error: 'Player nicht gefunden' }, { status: 404 });
    }

    // Hole Zone
    const zone = await base44.entities.Zone.get(player.zoneId);
    if (!zone) {
      return Response.json({ error: 'Zone nicht gefunden' }, { status: 404 });
    }

    // Hole Provider
    const provider = await base44.entities.Provider.get(zone.providerId);
    if (!provider || provider.status !== 'connected') {
      return Response.json({ error: 'Provider nicht verbunden' }, { status: 400 });
    }

    // syncStatus ist speziell: nur DB update
    if (command === 'syncStatus') {
      try {
        await base44.asServiceRole.entities.Player.update(playerId, {
          isPlaying: payload?.isPlaying,
          progressMs: payload?.progressMs,
          volume: payload?.volume,
          lastStatusUpdate: payload?.lastStatusUpdate,
          lastSeen: payload?.lastSeen,
          currentTrackName: payload?.currentTrackName,
          currentTrackArtist: payload?.currentTrackArtist,
          currentTrackAlbum: payload?.currentTrackAlbum,
          currentTrackCoverUrl: payload?.currentTrackCoverUrl,
          currentPlaylistUri: payload?.currentPlaylistUri,
        });
        return Response.json({ success: true, command: 'syncStatus' });
      } catch (e) {
        return Response.json({ error: e.message }, { status: 500 });
      }
    }

    // Andere Commands via spotifyAccountControl
    let result = {};
    
    try {
      const res = await base44.asServiceRole.functions.invoke('spotifyAccountControl', {
        action: command,
        accountId: provider.id,
        deviceId: payload?.deviceId,
        volume: payload?.volume,
        contextUri: payload?.contextUri,
      });

      if (res.error) {
        return Response.json({ error: res.error }, { status: 400 });
      }

      result = res;
    } catch (spotifyError) {
      return Response.json({ error: spotifyError.message }, { status: 500 });
    }

    // Nach erfolgreichem Command: Status abrufen und speichern
    if (['resume', 'pause', 'next', 'previous', 'playPlaylist'].includes(command)) {
      try {
        const pbRes = await base44.asServiceRole.functions.invoke('spotifyAccountControl', {
          action: 'getPlaybackState',
          accountId: provider.id,
        });

        if (pbRes?.playback) {
          const pb = pbRes.playback;
          const track = pb.item || {};
          
          await base44.asServiceRole.entities.Player.update(playerId, {
            isPlaying: pb.is_playing || false,
            volume: pb.device?.volume_percent || player.volume,
            progressMs: pb.progress_ms || 0,
            currentTrackName: track.name || '',
            currentTrackArtist: track.artists?.[0]?.name || '',
            currentTrackAlbum: track.album?.name || '',
            currentTrackCoverUrl: track.album?.images?.[0]?.url || '',
            lastStatusUpdate: new Date().toISOString(),
            lastSeen: new Date().toISOString(),
          });
        }
      } catch (statusError) {
        console.error('Status update error:', statusError.message);
      }
    }

    return Response.json({
      success: true,
      command,
      result,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});