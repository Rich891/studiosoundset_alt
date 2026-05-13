import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    // Nur Admins können Player erstellen
    if (user?.role !== 'admin') {
      return Response.json({ error: 'Nur Admins können Player erstellen' }, { status: 403 });
    }

    const { deviceName, spotifyAccountId, zoneId, password } = await req.json();

    if (!deviceName || !spotifyAccountId || !password) {
      return Response.json({ error: 'deviceName, spotifyAccountId und password erforderlich' }, { status: 400 });
    }

    // Generiere kurze Geräte-ID
    const shortId = Math.random().toString(36).substr(2, 6).toUpperCase();
    const deviceId = `player-${shortId}`;
    
    // Generiere kurze Email
    const email = `p${shortId}@studio`;

    // Erstelle PlayerUser
    const result = await base44.asServiceRole.entities.PlayerUser.create({
      deviceId,
      email,
      passwordHash: password, // Für jetzt im Klartext (in Produktion: bcrypt)
      deviceName,
      spotifyAccountId,
      zoneId: zoneId || '',
      isActive: true,
      createdAt: new Date().toISOString(),
    });

    return Response.json({
      success: true,
      playerUser: {
        id: result.id,
        deviceId,
        email,
        deviceName,
        spotifyAccountId,
        zoneId,
      },
    });
  } catch (error) {
    console.error('Create player user error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});