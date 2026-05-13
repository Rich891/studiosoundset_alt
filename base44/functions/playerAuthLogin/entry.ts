import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const { email, password } = await req.json();

    if (!email || !password) {
      return Response.json({ error: 'Email und Passwort erforderlich' }, { status: 400 });
    }

    // Suche Player
    const players = await base44.asServiceRole.entities.Player.filter({ email });

    if (players.length === 0) {
      return Response.json({ error: 'Player nicht gefunden' }, { status: 401 });
    }

    const player = players[0];

    // Passwort-Verifikation
    const passwordMatches = password === player.passwordHash;

    if (!passwordMatches) {
      return Response.json({ error: 'Passwort falsch' }, { status: 401 });
    }

    // Update last login
    await base44.asServiceRole.entities.Player.update(player.id, {
      lastLoginAt: new Date().toISOString(),
    });

    // Generiere Session-Token
    const sessionToken = btoa(`${player.id}:${Date.now()}:${Math.random()}`);

    return Response.json({
      success: true,
      sessionToken,
      player: {
        id: player.id,
        email: player.email,
        name: player.name,
        zoneId: player.zoneId,
        pairingToken: player.pairingToken,
      },
    });
  } catch (error) {
    console.error('Player login error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});