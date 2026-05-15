import { createClientFromRequest } from "npm:@base44/sdk";

const ADMIN_ROLES = new Set(["owner", "admin", "staff"]);

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

function randomToken(prefix = "session") {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return `${prefix}_${Array.from(bytes, b => b.toString(16).padStart(2, "0")).join("")}`;
}

async function requireAdmin(base44: any) {
  const user = await base44.auth.me().catch(() => null);
  const role = String(user?.role || "").toLowerCase();
  if (!user || !ADMIN_ROLES.has(role)) {
    throw Object.assign(new Error("Nur Owner/Admin/Staff dürfen Player verwalten."), { status: 403, code: "ADMIN_REQUIRED" });
  }
  return user;
}

function publicPlayer(player: Record<string, any>) {
  return {
    id: player.id,
    name: player.name || "StudioSoundSet Player",
    email: player.email || "",
    providerId: player.providerId || "",
    apiCredentialSetId: player.apiCredentialSetId || player.providerId || "",
    spotifyAccountId: player.spotifyAccountId || player.providerId || "",
    spotifyClientId: player.spotifyClientId || "",
    zoneId: player.zoneId || "",
    sessionToken: player.sessionToken || "",
    setupToken: player.setupToken || "",
    isActive: player.isActive !== false,
    updatedAt: player.updatedAt || player.updated_date || "",
  };
}

async function ensureAssignment(base44: any, body: Record<string, any>) {
  const { playerId, providerId, zoneId = "", spotifyClientId = "", forceNewSession = false } = body;
  if (!playerId) throw Object.assign(new Error("playerId fehlt."), { status: 400, code: "PLAYER_ID_MISSING" });
  if (!providerId) throw Object.assign(new Error("providerId fehlt."), { status: 400, code: "PROVIDER_ID_MISSING" });

  const player = await base44.asServiceRole.entities.Player.get(playerId).catch(() => null);
  if (!player) throw Object.assign(new Error("Player nicht gefunden."), { status: 404, code: "PLAYER_NOT_FOUND" });

  const provider = await base44.asServiceRole.entities.Provider.get(providerId).catch(() => null);
  if (!provider) throw Object.assign(new Error("Provider nicht gefunden."), { status: 404, code: "PROVIDER_NOT_FOUND" });

  const patch = {
    providerId,
    apiCredentialSetId: providerId,
    spotifyAccountId: providerId,
    spotifyClientId: spotifyClientId || provider.clientId || player.spotifyClientId || "",
    zoneId: zoneId || "",
    sessionToken: forceNewSession || !player.sessionToken ? randomToken("session") : player.sessionToken,
    setupToken: forceNewSession || !player.setupToken ? randomToken("setup") : player.setupToken,
    isActive: true,
    role: "player",
    lastError: "",
    updatedAt: nowIso(),
  };

  const updated = await base44.asServiceRole.entities.Player.update(playerId, patch);
  return { success: true, player: publicPlayer({ ...player, ...updated, ...patch }) };
}

async function repairAll(base44: any) {
  const players = await base44.asServiceRole.entities.Player.list().catch(() => []);
  const repaired: any[] = [];
  for (const player of players) {
    const providerId = player.providerId || player.apiCredentialSetId || player.spotifyAccountId || "";
    if (!providerId) continue;
    if (player.sessionToken && player.setupToken) continue;
    const patch = {
      providerId,
      apiCredentialSetId: providerId,
      spotifyAccountId: providerId,
      sessionToken: player.sessionToken || randomToken("session"),
      setupToken: player.setupToken || randomToken("setup"),
      isActive: player.isActive !== false,
      role: "player",
      updatedAt: nowIso(),
    };
    const updated = await base44.asServiceRole.entities.Player.update(player.id, patch).catch(() => null);
    if (updated) repaired.push(publicPlayer({ ...player, ...updated, ...patch }));
  }
  return { success: true, repairedCount: repaired.length, repaired };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return json({ ok: true });
  if (req.method !== "POST") return json({ success: false, error: "Method not allowed" }, { status: 405 });
  try {
    const base44 = createClientFromRequest(req);
    await requireAdmin(base44);
    const body = await req.json().catch(() => ({}));
    const action = body.action || "ensureAssignment";
    if (action === "ensureAssignment") return json(await ensureAssignment(base44, body));
    if (action === "repairAll") return json(await repairAll(base44));
    return json({ success: false, errorCode: "ACTION_INVALID", error: "Invalid playerAdminControl action." }, { status: 400 });
  } catch (error) {
    const status = Number(error?.status || 500);
    return json({ success: false, errorCode: error?.code || "PLAYER_ADMIN_CONTROL_ERROR", error: error?.message || "playerAdminControl failed." }, { status });
  }
});
