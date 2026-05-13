import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const { email, password } = await req.json();

    if (!email || !password) {
      return Response.json({ error: 'Email und Passwort erforderlich' }, { status: 400 });
    }

    // Suche Player-User
    const playerUsers = await base44.asServiceRole.entities.PlayerUser.filter({ email });

    if (playerUsers.length === 0) {
      return Response.json({ error: 'Player nicht gefunden' }, { status: 401 });
    }

    const playerUser = playerUsers[0];

    // Einfache Passwort-Verifikation (in Produktion: bcrypt)
    // Für jetzt: prüfe ob das eingegebene Passwort dem stored Hash entspricht
    const passwordMatches = password === playerUser.passwordHash;

    if (!passwordMatches) {
      return Response.json({ error: 'Passwort falsch' }, { status: 401 });
    }

    // Update last login
    await base44.asServiceRole.entities.PlayerUser.update(playerUser.id, {
      lastLoginAt: new Date().toISOString(),
    });

    // Generiere einen einfachen Session-Token (in Produktion: JWT mit Expiry)
    const sessionToken = btoa(`${playerUser.id}:${Date.now()}:${Math.random()}`);

    return Response.json({
      success: true,
      sessionToken,
      playerUser: {
        id: playerUser.id,
        email: playerUser.email,
        deviceId: playerUser.deviceId,
        deviceName: playerUser.deviceName,
        spotifyAccountId: playerUser.spotifyAccountId,
        zoneId: playerUser.zoneId,
      },
    });
  } catch (error) {
    console.error('Player login error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});