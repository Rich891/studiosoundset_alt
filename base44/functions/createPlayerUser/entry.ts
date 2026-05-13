import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const { deviceId, deviceName, playerDeviceId } = await req.json();

    if (!deviceId || !deviceName || !playerDeviceId) {
      return Response.json({ error: 'deviceId, deviceName, playerDeviceId required' }, { status: 400 });
    }

    // Generate random password (24 chars alphanumeric)
    const password = Array.from(crypto.getRandomValues(new Uint8Array(18)))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('')
      .substring(0, 24);

    // Player email format: player-[deviceId]@studio
    const playerEmail = `player-${deviceId}@studio`;

    // Invite user as "user" role
    try {
      await base44.asServiceRole.users.inviteUser(playerEmail, 'user');
    } catch (e) {
      // If user already exists, that's fine - continue
      console.warn('User invite failed (may already exist):', e.message);
    }

    // Store credentials in PlayerDevice for the player to use
    await base44.asServiceRole.entities.PlayerDevice.update(playerDeviceId, {
      userId: playerEmail,
      playerPassword: password, // This will be stored as plain text - only accessible to the player device
    });

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