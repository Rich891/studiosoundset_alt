import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { playerDeviceId, command, payload } = await req.json();

    if (!playerDeviceId || !command) {
      return Response.json({ error: 'Missing playerDeviceId or command' }, { status: 400 });
    }

    // playerDeviceId ist jetzt PlayerUser.id, finde PlayerDevice mit userId
    const devices = await base44.asServiceRole.entities.PlayerDevice.filter({ userId: playerDeviceId });
    const device = devices[0];
    
    if (!device) {
      return Response.json({ error: 'PlayerDevice nicht gefunden' }, { status: 404 });
    }

    // Hole Spotify Account
    const account = await base44.entities.SpotifyAccount.get(device.spotifyAccountId);
    if (!account || account.authStatus !== 'connected') {
      return Response.json({ error: 'Spotify Account nicht verbunden' }, { status: 400 });
    }

    // Command ausführen via spotifyAccountControl
    let result = {};
    
    try {
      const res = await base44.asServiceRole.functions.invoke('spotifyAccountControl', {
        action: command,
        accountId: account.id,
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

    // Nach erfolgreichem Command: Aktualisiere PlayerDevice Status
    // Bei Volume: sofort speichern
    if (command === 'setVolume' && payload?.volume !== undefined) {
      await base44.entities.PlayerDevice.update(playerDeviceId, {
        volume: payload.volume,
        lastStatusUpdate: new Date().toISOString(),
      });
    }

    // Bei Play/Pause/Next/Previous: Status abrufen
    if (['resume', 'pause', 'next', 'previous', 'playPlaylist'].includes(command)) {
      try {
        const pbRes = await base44.asServiceRole.functions.invoke('spotifyAccountControl', {
          action: 'getPlaybackState',
          accountId: account.id,
        });

        if (pbRes?.playback) {
          const pb = pbRes.playback;
          const track = pb.item || {};
          
          await base44.entities.PlayerDevice.update(playerDeviceId, {
            isPlaying: pb.is_playing || false,
            volume: pb.device?.volume_percent || device.volume,
            progressMs: pb.progress_ms || 0,
            currentTrackName: track.name || '',
            currentTrackArtist: track.artists?.[0]?.name || '',
            currentTrackAlbum: track.album?.name || '',
            currentTrackCoverUrl: track.album?.images?.[0]?.url || '',
            currentTrackUri: track.uri || '',
            currentTrackDuration: track.duration_ms || 0,
            lastStatusUpdate: new Date().toISOString(),
          });
        }
      } catch (statusError) {
        // Fehler beim Status-Update ist nicht kritisch
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