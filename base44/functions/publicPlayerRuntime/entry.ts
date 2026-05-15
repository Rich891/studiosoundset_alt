import { createClientFromRequest } from "npm:@base44/sdk";

const COMMAND_STATUS = {
  PENDING: "pending",
  PICKED_UP: "picked_up",
  SUCCESS: "success",
  FAILED: "failed",
  TIMEOUT: "timeout",
};

function json(data: unknown, init?: ResponseInit) {
  return Response.json(data, {
    ...init,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
      ...(init?.headers || {}),
    },
  });
}

function nowIso() {
  return new Date().toISOString();
}

function pickPlayerPublic(player: Record<string, any>) {
  return {
    id: player.id,
    name: player.name || "StudioSoundSet Player",
    email: player.email || "",
    providerId: player.providerId || "",
    zoneId: player.zoneId || "",
    isActive: player.isActive !== false,
    isOnline: !!player.isOnline,
    sdkReady: !!player.sdkReady,
    sdkConnected: !!player.sdkConnected,
    spotifyDeviceId: player.spotifyDeviceId || "",
    lastError: player.lastError || "",
    lastSeen: player.lastSeen || "",
    lastHeartbeatAt: player.lastHeartbeatAt || "",
  };
}

function pickProviderPublic(provider: Record<string, any> | null) {
  if (!provider) return null;
  return {
    id: provider.id,
    name: provider.name || provider.displayName || "Spotify Provider",
    displayName: provider.displayName || provider.name || "Spotify Provider",
    status: provider.status || provider.authStatus || "disconnected",
    authStatus: provider.authStatus || provider.status || "disconnected",
    tokenStatus: provider.tokenStatus || "",
    spotifyUserEmail: provider.spotifyUserEmail || "",
    spotifyDisplayName: provider.spotifyDisplayName || "",
  };
}

function sanitizeHeartbeat(payload: Record<string, any> = {}) {
  return {
    lastSeen: nowIso(),
    lastHeartbeatAt: nowIso(),
    isOnline: true,
    sdkReady: !!payload.sdkReady,
    sdkConnected: !!payload.sdkConnected,
    spotifyDeviceId: String(payload.spotifyDeviceId || ""),
    currentTrackName: String(payload.currentTrackName || ""),
    currentTrackArtist: String(payload.currentTrackArtist || ""),
    currentTrackAlbum: String(payload.currentTrackAlbum || ""),
    currentTrackCoverUrl: String(payload.currentTrackCoverUrl || ""),
    currentTrackUri: String(payload.currentTrackUri || ""),
    currentPlaylistUri: String(payload.currentPlaylistUri || ""),
    isPlaying: !!payload.isPlaying,
    progressMs: Number.isFinite(Number(payload.progressMs)) ? Number(payload.progressMs) : 0,
    durationMs: Number.isFinite(Number(payload.durationMs)) ? Number(payload.durationMs) : 0,
    volume: Number.isFinite(Number(payload.volume)) ? Number(payload.volume) : undefined,
    lastError: String(payload.lastError || ""),
    playbackStateAvailable: payload.playbackStateAvailable !== false,
    lastStatusUpdate: nowIso(),
  };
}

async function findPlayer(base44: any, playerId: string) {
  if (!playerId) throw Object.assign(new Error("playerId fehlt."), { status: 400, code: "PLAYER_ID_MISSING" });
  const player = await base44.asServiceRole.entities.Player.get(playerId).catch(() => null);
  if (!player) throw Object.assign(new Error("Player nicht gefunden."), { status: 404, code: "PLAYER_NOT_FOUND" });
  return player;
}

function validatePlayerSession(player: Record<string, any>, sessionToken: string) {
  if (!sessionToken) throw Object.assign(new Error("sessionToken fehlt."), { status: 401, code: "SESSION_TOKEN_MISSING" });
  if (player.isActive === false) throw Object.assign(new Error("Player ist deaktiviert."), { status: 403, code: "PLAYER_INACTIVE" });
  const validTokens = [player.sessionToken, player.setupToken].filter(Boolean).map(String);
  if (!validTokens.includes(String(sessionToken))) {
    throw Object.assign(new Error("Player Session ist ungültig."), { status: 403, code: "SESSION_TOKEN_INVALID" });
  }
}

async function loadProvider(base44: any, player: Record<string, any>) {
  if (!player.providerId) return null;
  return await base44.asServiceRole.entities.Provider.get(player.providerId).catch(() => null);
}

async function handleBootstrap(base44: any, player: Record<string, any>) {
  const provider = await loadProvider(base44, player);
  const zone = player.zoneId ? await base44.asServiceRole.entities.Zone.get(player.zoneId).catch(() => null) : null;
  await base44.asServiceRole.entities.Player.update(player.id, {
    lastSeen: nowIso(),
    lastHeartbeatAt: nowIso(),
    isOnline: true,
    lastError: player.providerId ? "" : "Player has no providerId assigned.",
  });
  return {
    success: true,
    player: pickPlayerPublic(player),
    provider: pickProviderPublic(provider),
    zone: zone ? { id: zone.id, name: zone.name || "", providerId: zone.providerId || "" } : null,
  };
}

async function handleHeartbeat(base44: any, player: Record<string, any>, payload: Record<string, any>) {
  const updateData = sanitizeHeartbeat(payload);
  await base44.asServiceRole.entities.Player.update(player.id, updateData);
  return { success: true, playerId: player.id, updatedAt: updateData.lastHeartbeatAt };
}

async function handlePollCommands(base44: any, player: Record<string, any>) {
  const commands = await base44.asServiceRole.entities.PlayerCommand.filter({
    playerId: player.id,
    status: COMMAND_STATUS.PENDING,
  }).catch(() => []);
  const sorted = [...commands].sort((a: any, b: any) => new Date(a.createdAt || a.created_date || 0).getTime() - new Date(b.createdAt || b.created_date || 0).getTime());
  const command = sorted[0] || null;
  if (!command) return { success: true, command: null };

  await base44.asServiceRole.entities.PlayerCommand.update(command.id, {
    status: COMMAND_STATUS.PICKED_UP,
    pickedUpAt: nowIso(),
    humanMessage: "Player picked up command and is executing it.",
  });
  await base44.asServiceRole.entities.Player.update(player.id, {
    lastSeen: nowIso(),
    lastHeartbeatAt: nowIso(),
    isOnline: true,
    lastCommand: command.type || command.command || "",
    lastCommandStatus: COMMAND_STATUS.PICKED_UP,
    lastError: "",
  });

  return {
    success: true,
    command: {
      id: command.id,
      playerId: command.playerId,
      providerId: command.providerId || player.providerId || "",
      zoneId: command.zoneId || player.zoneId || "",
      type: command.type || command.command,
      command: command.command || command.type,
      payload: command.payload || {},
      createdAt: command.createdAt || command.created_date || "",
    },
  };
}

async function handleCommandResult(base44: any, player: Record<string, any>, payload: Record<string, any>) {
  const commandId = payload.commandId;
  if (!commandId) throw Object.assign(new Error("commandId fehlt."), { status: 400, code: "COMMAND_ID_MISSING" });
  const command = await base44.asServiceRole.entities.PlayerCommand.get(commandId).catch(() => null);
  if (!command || command.playerId !== player.id) {
    throw Object.assign(new Error("Command gehört nicht zu diesem Player."), { status: 403, code: "COMMAND_FORBIDDEN" });
  }

  const status = payload.status === COMMAND_STATUS.SUCCESS ? COMMAND_STATUS.SUCCESS : COMMAND_STATUS.FAILED;
  const patch = {
    status,
    completedAt: nowIso(),
    result: payload.result || {},
    errorCode: payload.errorCode || "",
    humanMessage: payload.humanMessage || (status === COMMAND_STATUS.SUCCESS ? "Command confirmed by Player." : "Command failed on Player."),
    technicalMessage: payload.technicalMessage || "",
    suggestedFix: payload.suggestedFix || "",
  };
  await base44.asServiceRole.entities.PlayerCommand.update(command.id, patch);
  await base44.asServiceRole.entities.Player.update(player.id, {
    lastSeen: nowIso(),
    lastHeartbeatAt: nowIso(),
    isOnline: true,
    lastCommand: command.type || command.command || "",
    lastCommandStatus: status,
    lastError: status === COMMAND_STATUS.SUCCESS ? "" : patch.humanMessage,
    lastCommandCompletedAt: nowIso(),
  });

  return { success: true, commandId: command.id, status };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return json({ ok: true });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, { status: 405 });

  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));
    const { action, playerId, sessionToken, payload = {} } = body;

    if (!["bootstrap", "heartbeat", "pollCommands", "commandResult"].includes(action)) {
      return json({ success: false, errorCode: "ACTION_INVALID", error: "Invalid publicPlayerRuntime action." }, { status: 400 });
    }

    const player = await findPlayer(base44, playerId);
    validatePlayerSession(player, sessionToken);

    if (action === "bootstrap") return json(await handleBootstrap(base44, player));
    if (action === "heartbeat") return json(await handleHeartbeat(base44, player, payload));
    if (action === "pollCommands") return json(await handlePollCommands(base44, player));
    if (action === "commandResult") return json(await handleCommandResult(base44, player, payload));
  } catch (error) {
    const status = Number(error?.status || 500);
    return json({
      success: false,
      errorCode: error?.code || "PUBLIC_PLAYER_RUNTIME_ERROR",
      error: error?.message || "publicPlayerRuntime failed.",
    }, { status });
  }

  return json({ success: false, errorCode: "UNREACHABLE", error: "Unhandled action." }, { status: 500 });
});
