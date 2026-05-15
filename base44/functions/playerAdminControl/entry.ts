import { createClientFromRequest } from "npm:@base44/sdk";

const ADMIN_ROLES = new Set(["owner", "admin", "staff"]);

function json(data: unknown, init?: ResponseInit) {
  return Response.json(data, { ...init, headers: { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "POST, OPTIONS", "Access-Control-Allow-Headers": "Content-Type, Authorization", ...(init?.headers || {}) } });
}
function nowIso() { return new Date().toISOString(); }
function randomToken(prefix = "session") {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return `${prefix}_${Array.from(bytes, b => b.toString(16).padStart(2, "0")).join("")}`;
}
function runtimeSessionKey(playerId: string) { return `player_runtime_session_${playerId}`; }

async function requireAdmin(base44: any) {
  const user = await base44.auth.me().catch(() => null);
  const role = String(user?.role || "").toLowerCase();
  if (!user || !ADMIN_ROLES.has(role)) throw Object.assign(new Error("Nur Owner/Admin/Staff dürfen Player verwalten."), { status: 403, code: "ADMIN_REQUIRED" });
  return user;
}

async function upsertSetting(base44: any, key: string, value: unknown, category = "player_runtime") {
  const rows = await base44.asServiceRole.entities.AppSetting.filter({ key }).catch(() => []);
  const payload = { key, value: JSON.stringify(value), category, updatedAt: nowIso() };
  if (rows[0]?.id) return base44.asServiceRole.entities.AppSetting.update(rows[0].id, payload);
  return base44.asServiceRole.entities.AppSetting.create({ ...payload, createdAt: nowIso() });
}

async function readRuntimeSession(base44: any, playerId: string) {
  const rows = await base44.asServiceRole.entities.AppSetting.filter({ key: runtimeSessionKey(playerId) }).catch(() => []);
  const raw = rows[0]?.value;
  if (!raw) return null;
  try { return typeof raw === "string" ? JSON.parse(raw) : raw; }
  catch { return null; }
}

function publicPlayer(player: Record<string, any>, runtimeSession?: Record<string, any> | null) {
  return { id: player.id, name: player.name || "StudioSoundSet Player", email: player.email || "", providerId: player.providerId || "", apiCredentialSetId: player.apiCredentialSetId || player.providerId || "", spotifyAccountId: player.spotifyAccountId || player.providerId || "", spotifyClientId: player.spotifyClientId || "", zoneId: player.zoneId || "", sessionToken: player.sessionToken || runtimeSession?.sessionToken || "", setupToken: player.setupToken || runtimeSession?.setupToken || "", isActive: player.isActive !== false, updatedAt: player.updatedAt || player.updated_date || "" };
}

async function ensureAssignment(base44: any, body: Record<string, any>) {
  const { playerId, providerId, zoneId = "", spotifyClientId = "", forceNewSession = false } = body;
  if (!playerId) throw Object.assign(new Error("playerId fehlt."), { status: 400, code: "PLAYER_ID_MISSING" });
  if (!providerId) throw Object.assign(new Error("providerId fehlt."), { status: 400, code: "PROVIDER_ID_MISSING" });
  const player = await base44.asServiceRole.entities.Player.get(playerId).catch(() => null);
  if (!player) throw Object.assign(new Error("Player nicht gefunden."), { status: 404, code: "PLAYER_NOT_FOUND" });
  const provider = await base44.asServiceRole.entities.Provider.get(providerId).catch(() => null);
  if (!provider) throw Object.assign(new Error("Provider nicht gefunden."), { status: 404, code: "PROVIDER_NOT_FOUND" });

  const currentSession = await readRuntimeSession(base44, playerId);
  const sessionToken = forceNewSession ? randomToken("session") : player.sessionToken || currentSession?.sessionToken || randomToken("session");
  const setupToken = forceNewSession ? randomToken("setup") : player.setupToken || currentSession?.setupToken || randomToken("setup");
  const patch = { providerId, apiCredentialSetId: providerId, spotifyAccountId: providerId, spotifyClientId: spotifyClientId || provider.clientId || player.spotifyClientId || "", zoneId: zoneId || "", sessionToken, setupToken, isActive: true, role: "player", lastError: "", updatedAt: nowIso() };
  const updated = await base44.asServiceRole.entities.Player.update(playerId, patch).catch(() => ({}));
  const runtimeSession = { playerId, providerId, zoneId: zoneId || "", sessionToken, setupToken, isActive: true, updatedAt: nowIso() };
  await upsertSetting(base44, runtimeSessionKey(playerId), runtimeSession);
  return { success: true, player: publicPlayer({ ...player, ...updated, ...patch }, runtimeSession) };
}

async function repairAll(base44: any) {
  const players = await base44.asServiceRole.entities.Player.list().catch(() => []);
  const repaired: any[] = [];
  for (const player of players) {
    const providerId = player.providerId || player.apiCredentialSetId || player.spotifyAccountId || "";
    if (!providerId) continue;
    const currentSession = await readRuntimeSession(base44, player.id);
    const runtimeSession = { playerId: player.id, providerId, zoneId: player.zoneId || "", sessionToken: player.sessionToken || currentSession?.sessionToken || randomToken("session"), setupToken: player.setupToken || currentSession?.setupToken || randomToken("setup"), isActive: player.isActive !== false, updatedAt: nowIso() };
    await upsertSetting(base44, runtimeSessionKey(player.id), runtimeSession);
    const patch = { providerId, apiCredentialSetId: providerId, spotifyAccountId: providerId, sessionToken: runtimeSession.sessionToken, setupToken: runtimeSession.setupToken, isActive: runtimeSession.isActive, role: "player", updatedAt: nowIso() };
    const updated = await base44.asServiceRole.entities.Player.update(player.id, patch).catch(() => ({}));
    repaired.push(publicPlayer({ ...player, ...updated, ...patch }, runtimeSession));
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
