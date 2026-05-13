import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { action, providerId, data } = await req.json();

    if (action === 'create') {
      const provider = await base44.entities.Provider.create({
        name: data.name,
        type: 'spotify',
        clientId: data.clientId,
        clientSecret: data.clientSecret,
        status: 'disconnected',
      });
      return Response.json({ success: true, provider });
    }

    if (action === 'update') {
      const provider = await base44.entities.Provider.update(providerId, {
        name: data.name,
        clientId: data.clientId,
        ...(data.clientSecret && { clientSecret: data.clientSecret }),
      });
      return Response.json({ success: true, provider });
    }

    if (action === 'delete') {
      await base44.entities.Provider.delete(providerId);
      return Response.json({ success: true });
    }

    if (action === 'testConnection') {
      const provider = await base44.entities.Provider.list({ id: providerId });
      if (!provider[0]) return Response.json({ error: 'Provider nicht gefunden' }, { status: 404 });
      
      const p = provider[0];
      if (!p.accessToken) {
        return Response.json({ error: 'Nicht mit Spotify verbunden', status: 'disconnected' });
      }

      try {
        const meRes = await fetch('https://api.spotify.com/v1/me', {
          headers: { 'Authorization': `Bearer ${p.accessToken}` }
        });
        if (!meRes.ok) {
          return Response.json({ error: 'Token abgelaufen oder ungültig', status: 'expired' });
        }
        const me = await meRes.json();
        return Response.json({
          success: true,
          status: 'connected',
          spotifyUserEmail: me.email,
          spotifyUserId: me.id,
        });
      } catch (e) {
        return Response.json({ error: e.message, status: 'error' });
      }
    }

    return Response.json({ error: 'Unknown action' }, { status: 400 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});