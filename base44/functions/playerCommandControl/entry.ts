import { createClientFromRequest } from "npm:@base44/sdk";

const ADMIN_ROLES = new Set(["owner", "admin", "staff"]);
const COMMAND_STATUS = {
  PENDING: "pending",
  PICKED_UP: "picked_up",
  SUCCESS: "success",
  FAILED: "failed",
  TIMEOUT: "timeout",
};
const STORE_KEY = "player_command_store_v1";
const MAX_COMMANDS = 500;

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

async function requireAdmin(base44: any) {
  const user = await base44.auth.me().catch(() => null);
  const role = String(user?.role || "").toLowerCase();
  if (!user || !ADMIN_ROLES.has(role)) {
    throw Object.assign(new Error("Nur Owner/Admin/Staff dürfen PlayerCommands verwalten."), {
      status: 403,
      code: "ADMIN_REQUIRED",
    });
  }
  return user;
}

async function readStoreRow(base44: any) {
  const rows = await base44.asServiceRole.entities.AppSetting.filter({ key: STORE_KEY }).catch(() => []);
  return rows[0] || null;
}

async function readCommands(base44: any) {
  const row = await readStoreRow(base44);
  const raw = row?.value;
  if (!raw) return [];
  try {
    const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function writeCommands(base44: any, commands: any[]) {
  const trimmed = [...commands]
    .sort((a, b) => new Date(b.createdAt || b.created_date || 0).getTime() - new Date(a.createdAt || a.created_date || 0).getTime())
    .slice(0, MAX_COMMANDS);
  const row = await readStoreRow(base44);
  const payload = { key: STORE_KEY, value: JSON.stringify(trimmed), category: "player_commands", updatedAt: nowIso() };
  if (row?.id) await base44.asServiceRole.entities.AppSetting.update(row.id, payload);
  else await base44.asServiceRole.entities.AppSetting.create({ ...payload, createdAt: nowIso() });
  return trimmed;
}

function normalizeCommand(input: Record<string, any>) {
  const type = input.type || input.command;
  if (!input.playerId) throw Object.assign(new Error("playerId fehlt."), { status: 400, code: "PLAYER_ID_MISSING" });
  if (!type) throw Object.assign(new Error("Command type fehlt."), { status: 400, code: "COMMAND_TYPE_MISSING" });
  const createdAt = nowIso();
  return {
    id: crypto.randomUUID(),
    playerId: input.playerId,
    providerId: input.providerId || "",
    zoneId: input.zoneId || "",
    type,
    command: type,
    payload: input.payload || {},
    status: COMMAND_STATUS.PENDING,
    createdAt,
    created_date: createdAt,
    pickedUpAt: "",
    completedAt: "",
    result: {},
    errorCode: "",
    humanMessage: input.humanMessage || "Command sent. Waiting for Player acknowledgement.",
    technicalMessage: "",
    suggestedFix: "",
  };
}

async function createCommand(base44: any, payload: Record<string, any>) {
  const commands = await readCommands(base44);
  const command = normalizeCommand(payload);
  await writeCommands(base44, [command, ...commands]);
  return { success: true, command };
}

async function listCommands(base44: any, payload: Record<string, any>) {
  const commands = await readCommands(base44);
  const filtered = payload.playerId ? commands.filter((cmd) => cmd.playerId === payload.playerId) : commands;
  return { success: true, commands: filtered };
}

async function markTimeouts(base44: any, payload: Record<string, any>) {
  const playerId = payload.playerId;
  const timeoutMs = Number(payload.timeoutMs || 10000);
  const cutoff = Date.now() - timeoutMs;
  const commands = await readCommands(base44);
  let changed = 0;
  const updated = commands.map((cmd) => {
    if (playerId && cmd.playerId !== playerId) return cmd;
    if (cmd.status !== COMMAND_STATUS.PENDING) return cmd;
    if (new Date(cmd.createdAt || cmd.created_date || 0).getTime() >= cutoff) return cmd;
    changed += 1;
    return {
      ...cmd,
      status: COMMAND_STATUS.TIMEOUT,
      completedAt: nowIso(),
      errorCode: "COMMAND_TIMEOUT",
      humanMessage: "The Player did not pick up this command in time. Open the Player screen and wait until it is online.",
      technicalMessage: "No PlayerCommand pickup before timeout window.",
    };
  });
  await writeCommands(base44, updated);
  return { success: true, changed };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return json({ ok: true });
  if (req.method !== "POST") return json({ success: false, error: "Method not allowed" }, { status: 405 });

  try {
    const base44 = createClientFromRequest(req);
    await requireAdmin(base44);
    const body = await req.json().catch(() => ({}));
    const action = body.action || "list";
    const payload = body.payload || body;

    if (action === "create") return json(await createCommand(base44, payload));
    if (action === "list") return json(await listCommands(base44, payload));
    if (action === "markTimeouts") return json(await markTimeouts(base44, payload));

    return json({ success: false, errorCode: "ACTION_INVALID", error: "Invalid playerCommandControl action." }, { status: 400 });
  } catch (error) {
    const status = Number(error?.status || 500);
    return json({ success: false, errorCode: error?.code || "PLAYER_COMMAND_CONTROL_ERROR", error: error?.message || "playerCommandControl failed." }, { status });
  }
});
