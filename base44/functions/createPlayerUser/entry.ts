import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const { deviceId, deviceName } = await req.json();

    if (!deviceId || !deviceName) {
      return Response.json({ error: 'deviceId and deviceName required' }, { status: 400 });
    }

    // Generate random password (24 chars)
    const password = Array.from(crypto.getRandomValues(new Uint8Array(18)))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('')
      .substring(0, 24);

    // Create player user with email format: player-[deviceId]@studio
    const playerEmail = `player-${deviceId}@studio`;

    // Invite user as "user" role (using service role for public pairing flow)
    await base44.asServiceRole.users.inviteUser(playerEmail, 'user');

    // Return the player credentials for the device to use
    return Response.json({
      success: true,
      playerEmail,
      playerPassword: password,
      deviceName,
    });
  } catch (error) {
    console.error('Error creating player user:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});