import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const SCRIPT_FILE = fileURLToPath(import.meta.url);
const SCRIPT_DIR = path.dirname(SCRIPT_FILE);
const SAAS_ROOT = path.resolve(SCRIPT_DIR, "..", "..");
const RUPTUR_ROOT = path.resolve(SAAS_ROOT, "..");
const GITHUB_ROOT = path.resolve(SAAS_ROOT, "..", "..", "..");
const STATE_ROOT = path.join(GITHUB_ROOT, "state");
const OMEGA_ROOT = path.join(GITHUB_ROOT, "omega");
const CONNECTOME_FILE = path.join(RUPTUR_ROOT, "connectome", "status.json");
const LOCAL_SESSIONS_DIR = path.join(RUPTUR_ROOT, "sessions");
const OMEGA_SESSIONS_DIR = path.join(OMEGA_ROOT, "sessions");
const ACTIVATION_MENU_FILE = path.join(STATE_ROOT, "knowledge", "jarvis-activation-menu.md");
const FULL_MODE_FILE = path.join(STATE_ROOT, "playbooks", "jarvis.full-mode.md");

function readJson(filePath) {
  if (!filePath || !existsSync(filePath)) return null;
  try {
    return JSON.parse(readFileSync(filePath, "utf8"));
  } catch {
    return null;
  }
}

function listSessionFiles(dirPath) {
  if (!existsSync(dirPath)) return [];
  return readdirSync(dirPath)
    .filter((entry) => entry.endsWith(".json"))
    .map((entry) => path.join(dirPath, entry))
    .sort((left, right) => statSync(right).mtimeMs - statSync(left).mtimeMs);
}

function extractCapabilities(...sources) {
  const seen = new Set();
  for (const source of sources) {
    if (!Array.isArray(source)) continue;
    for (const item of source) {
      const normalized = String(item ?? "").trim();
      if (!normalized) continue;
      seen.add(normalized);
    }
  }
  return Array.from(seen);
}

function pickActiveConnectomeSession(connectome) {
  const sessions = Array.isArray(connectome?.active_sessions) ? connectome.active_sessions : [];
  return (
    sessions.find((session) => String(session?.agent ?? "").toLowerCase() === "jarvis" && String(session?.status ?? "").toLowerCase() === "active")
    || sessions.find((session) => String(session?.status ?? "").toLowerCase() === "active")
    || sessions[0]
    || null
  );
}

function pickActiveSessionFile(files) {
  const sessions = files
    .map((filePath) => ({ filePath, payload: readJson(filePath) }))
    .filter((entry) => entry.payload && entry.payload.session_id);

  return (
    sessions.find((entry) => String(entry.payload.status ?? "").toLowerCase() === "active")
    || sessions[0]
    || null
  );
}

function resolveSessionPaths(activeConnectomeSession) {
  const sessionId = activeConnectomeSession?.session_id ?? null;
  const localSessionPath = activeConnectomeSession?.local_session_ref
    ? path.resolve(RUPTUR_ROOT, activeConnectomeSession.local_session_ref)
    : (sessionId ? path.join(LOCAL_SESSIONS_DIR, `${sessionId}.json`) : null);

  const omegaSessionPath = activeConnectomeSession?.omega_session_ref
    ? path.resolve(RUPTUR_ROOT, activeConnectomeSession.omega_session_ref)
    : (sessionId ? path.join(OMEGA_SESSIONS_DIR, `${sessionId}.json`) : null);

  return { sessionId, localSessionPath, omegaSessionPath };
}

function buildSummary() {
  const connectome = readJson(CONNECTOME_FILE);
  const activeConnectomeSession = pickActiveConnectomeSession(connectome);

  const latestLocalSession = pickActiveSessionFile(listSessionFiles(LOCAL_SESSIONS_DIR));
  const latestOmegaSession = pickActiveSessionFile(listSessionFiles(OMEGA_SESSIONS_DIR));

  const resolvedFromConnectome = resolveSessionPaths(activeConnectomeSession);
  const localSession = readJson(resolvedFromConnectome.localSessionPath) || latestLocalSession?.payload || null;
  const omegaSession = readJson(resolvedFromConnectome.omegaSessionPath) || latestOmegaSession?.payload || null;

  const sessionId = activeConnectomeSession?.session_id
    || localSession?.session_id
    || omegaSession?.session_id
    || null;

  const operator = localSession?.metadata?.operator
    || omegaSession?.metadata?.operator
    || connectome?.operator
    || null;

  const capabilities = extractCapabilities(
    activeConnectomeSession?.capabilities_active,
    localSession?.metadata?.capabilities_active,
    omegaSession?.metadata?.capabilities_active,
  );

  const engagedAgents = extractCapabilities(
    activeConnectomeSession?.engaged_agents,
    localSession?.metadata?.agent_multiverse?.engaged_agents,
    omegaSession?.metadata?.agent_multiverse?.engaged_agents,
    connectome?.agent_multiverse?.engaged_agents,
  );

  return {
    generated_at: new Date().toISOString(),
    project: "saas",
    activation_triggers: [
      "Jarvis",
      "Jarvis ativar",
      "Jarvis Iniciar",
      "Jarvis Start",
      "Modo Full",
    ],
    meaning: "Reusar a sessão oficial ativa do Jarvis e tratar esta superfície como acoplada, sem criar nova gênese.",
    authority_layers: {
      alpha: "gênese / identidade raiz",
      state: "governança canônica",
      omega: "lifecycle de sessão",
      ruptur: "execução viva",
      saas: "atalho operacional local",
    },
    session: {
      session_id: sessionId,
      status: activeConnectomeSession?.status || localSession?.status || omegaSession?.status || null,
      lifecycle_stage: activeConnectomeSession?.lifecycle_stage || localSession?.lifecycle_stage || omegaSession?.lifecycle_stage || null,
      mode: activeConnectomeSession?.mode || localSession?.mode || omegaSession?.mode || null,
      operator,
      manifestation_id: "jarvis.ruptur.control_plane",
    },
    telemetry: {
      connectome_last_updated: connectome?.last_updated || null,
      connectome_last_activity_at: activeConnectomeSession?.last_activity_at || null,
      connectome_last_heartbeat_at: activeConnectomeSession?.last_heartbeat_at || null,
      local_last_activity_at: localSession?.last_activity_at || null,
      omega_last_activity_at: omegaSession?.last_activity_at || null,
    },
    capabilities,
    engaged_agents: engagedAgents,
    refs: {
      connectome: CONNECTOME_FILE,
      local_session: sessionId ? path.join(LOCAL_SESSIONS_DIR, `${sessionId}.json`) : (latestLocalSession?.filePath || null),
      omega_session: sessionId ? path.join(OMEGA_SESSIONS_DIR, `${sessionId}.json`) : (latestOmegaSession?.filePath || null),
      activation_menu: existsSync(ACTIVATION_MENU_FILE) ? ACTIVATION_MENU_FILE : null,
      full_mode_playbook: existsSync(FULL_MODE_FILE) ? FULL_MODE_FILE : null,
    },
    limits: [
      "o chat local não substitui a sessão canônica",
      "não inventar heartbeat novo sem evidência material",
      "se não houver sessão reconciliável, declarar gap explicitamente",
    ],
  };
}

function printHuman(summary) {
  const capabilitiesPreview = summary.capabilities.length ? summary.capabilities.map((item) => `- ${item}`).join("\n") : "- nenhuma capability reconciliada";
  const agentsPreview = summary.engaged_agents.length ? summary.engaged_agents.join(", ") : "nenhum agente reconciliado";

  console.log(`🧬 🧠 🦾 ⌬ ∞ | J.A.R.V.I.S.: ativação local reconciliada`);
  console.log(`projeto: ${summary.project}`);
  console.log(`sessão oficial: ${summary.session.session_id ?? "não encontrada"}`);
  console.log(`status / estágio: ${summary.session.status ?? "?"} / ${summary.session.lifecycle_stage ?? "?"}`);
  console.log(`modo: ${summary.session.mode ?? "não informado"}`);
  console.log(`operador: ${summary.session.operator ?? "não informado"}`);
  console.log(`connectome.last_updated: ${summary.telemetry.connectome_last_updated ?? "não informado"}`);
  console.log(`última atividade local: ${summary.telemetry.local_last_activity_at ?? "não informada"}`);
  console.log(`última atividade omega: ${summary.telemetry.omega_last_activity_at ?? "não informada"}`);
  console.log(`\ncapabilities reconciliadas:`);
  console.log(capabilitiesPreview);
  console.log(`\nagentes engajados:`);
  console.log(agentsPreview);
  console.log(`\natalhos:`);
  console.log(`- npm run jarvis:ativar`);
  console.log(`- npm run jarvis:ativar:json`);
}

const summary = buildSummary();

if (process.argv.includes("--json")) {
  console.log(JSON.stringify(summary, null, 2));
} else {
  printHuman(summary);
}
