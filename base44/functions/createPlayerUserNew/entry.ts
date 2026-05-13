import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    // Nur Admins können Player erstellen
    if (user?.role !== 'admin') {
      return Response.json({ error: 'Nur Admins können Player erstellen' }, { status: 403 });
    }

    const { name, providerId, zoneId, passwordHash } = await req.json();

     if (!name || !providerId || !passwordHash) {
       return Response.json({ error: 'name, providerId und passwordHash erforderlich' }, { status: 400 });
     }

     // Generiere kurze Geräte-ID
     const shortId = Math.random().toString(36).substr(2, 6).toUpperCase();
     const deviceId = `player-${shortId}`;

     // Generiere Email
     const email = `p${shortId}@studio`;

     // Erstelle Player
     const player = await base44.asServiceRole.entities.Player.create({
       name,
       email,
       passwordHash,
       zoneId: zoneId || '',
       deviceId,
       isActive: true,
       isPaired: false,
     });

     return Response.json({
       success: true,
       playerUser: {
         id: player.id,
         deviceId,
         email,
         name,
       },
     });
  } catch (error) {
    console.error('Create player user error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});