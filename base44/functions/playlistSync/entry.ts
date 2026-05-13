import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { action, providerId, playlistId } = await req.json();

    if (action === 'syncPlaylists') {
      // Fetch provider
      const providers = await base44.entities.Provider.filter({ id: providerId });
      if (!providers[0]) return Response.json({ error: 'Provider nicht gefunden' }, { status: 404 });
      
      const provider = providers[0];
      if (!provider.accessToken) {
        return Response.json({ error: 'Provider nicht mit Spotify verbunden' }, { status: 400 });
      }

      // Fetch user's playlists from Spotify
      let allPlaylists = [];
      let offset = 0;
      let hasMore = true;
      
      while (hasMore) {
        const res = await fetch(`https://api.spotify.com/v1/me/playlists?limit=50&offset=${offset}`, {
          headers: { 'Authorization': `Bearer ${provider.accessToken}` }
        });
        
        if (!res.ok) {
          return Response.json({ error: 'Spotify API error: ' + res.status }, { status: 500 });
        }

        const data = await res.json();
        allPlaylists = allPlaylists.concat(data.items || []);
        hasMore = data.next !== null;
        offset += 50;
      }

      // Upsert playlists
      const results = [];
      for (const pl of allPlaylists) {
        const existing = await base44.entities.Playlist.filter({
          providerId,
          providerPlaylistId: pl.id
        });

        if (existing[0]) {
          // Update
          await base44.entities.Playlist.update(existing[0].id, {
            name: pl.name,
            description: pl.description,
            owner: pl.owner?.display_name,
            coverUrl: pl.images?.[0]?.url,
            totalTracks: pl.tracks?.total || 0,
            lastSyncAt: new Date().toISOString(),
          });
          results.push({ action: 'updated', id: existing[0].id });
        } else {
          // Create
          await base44.entities.Playlist.create({
            providerId,
            providerPlaylistId: pl.id,
            providerPlaylistUri: pl.uri,
            name: pl.name,
            description: pl.description,
            owner: pl.owner?.display_name,
            coverUrl: pl.images?.[0]?.url,
            totalTracks: pl.tracks?.total || 0,
            syncStatus: 'pending',
            lastSyncAt: new Date().toISOString(),
          });
          results.push({ action: 'created', name: pl.name });
        }
      }

      return Response.json({ success: true, synced: results.length, results });
    }

    if (action === 'importTracks') {
      // Fetch playlist from DB
      const playlists = await base44.entities.Playlist.filter({ id: playlistId });
      if (!playlists[0]) return Response.json({ error: 'Playlist nicht gefunden' }, { status: 404 });
      
      const playlist = playlists[0];
      const provider = (await base44.entities.Provider.filter({ id: playlist.providerId }))[0];
      
      if (!provider?.accessToken) {
        return Response.json({ error: 'Provider-Token fehlt' }, { status: 400 });
      }

      // Fetch tracks from Spotify
      let allTracks = [];
      let offset = 0;
      let hasMore = true;

      while (hasMore) {
        const res = await fetch(
          `https://api.spotify.com/v1/playlists/${playlist.providerPlaylistId}/tracks?limit=100&offset=${offset}`,
          { headers: { 'Authorization': `Bearer ${provider.accessToken}` } }
        );

        if (!res.ok) {
          return Response.json({ error: 'Spotify API error' }, { status: 500 });
        }

        const data = await res.json();
        allTracks = allTracks.concat((data.items || []).map(item => item.track).filter(Boolean));
        hasMore = data.next !== null;
        offset += 100;
      }

      // Upsert tracks
      let imported = 0;
      for (const track of allTracks) {
        const existing = await base44.entities.PlaylistTrack.filter({
          playlistId,
          providerTrackId: track.id
        });

        if (!existing[0]) {
          await base44.entities.PlaylistTrack.create({
            playlistId,
            providerTrackId: track.id,
            providerTrackUri: track.uri,
            name: track.name,
            artist: track.artists?.[0]?.name,
            album: track.album?.name,
            durationMs: track.duration_ms,
            coverUrl: track.album?.images?.[0]?.url,
            explicit: track.explicit,
            sortOrder: imported,
          });
          imported++;
        }
      }

      // Update playlist status
      await base44.entities.Playlist.update(playlistId, {
        importedTracks: imported,
        syncStatus: 'synced',
      });

      return Response.json({ success: true, imported, total: allTracks.length });
    }

    return Response.json({ error: 'Unknown action' }, { status: 400 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});