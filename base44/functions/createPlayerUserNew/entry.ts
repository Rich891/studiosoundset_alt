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
    const playerUser = await base44.asServiceRole.entities.PlayerUser.create({
      deviceId,
      email,
      passwordHash: password,
      deviceName,
      spotifyAccountId,
      zoneId: zoneId || '',
      isActive: true,
      createdAt: new Date().toISOString(),
    });

    // Erstelle oder aktualisiere PlayerDevice und verknüpfe mit PlayerUser
    const playerDevices = await base44.asServiceRole.entities.PlayerDevice.filter({ 
      spotifyAccountId, 
      name: deviceName 
    });
    
    let playerDevice;
    if (playerDevices.length > 0) {
      // Update bestehenden Device
      playerDevice = playerDevices[0];
      await base44.asServiceRole.entities.PlayerDevice.update(playerDevice.id, {
        userId: playerUser.id,
        isPaired: true,
        pairedAt: new Date().toISOString(),
        isActive: true,
      });
    } else {
      // Erstelle neuen Device
      playerDevice = await base44.asServiceRole.entities.PlayerDevice.create({
        name: deviceName,
        spotifyAccountId,
        zoneId: zoneId || '',
        userId: playerUser.id,
        isPaired: true,
        pairedAt: new Date().toISOString(),
        isActive: true,
        pairingToken: Math.random().toString(36).substr(2, 10),
        pairingExpiresAt: new Date(Date.now() + 15 * 60000).toISOString(),
      });
    }

    return Response.json({
      success: true,
      playerUser: {
        id: playerUser.id,
        deviceId,
        email,
        deviceName,
        spotifyAccountId,
        zoneId,
      },
      playerDevice: {
        id: playerDevice.id,
        userId: playerUser.id,
        isPaired: true,
      },
    });
  } catch (error) {
    console.error('Create player user error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});