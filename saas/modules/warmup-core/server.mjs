import { createReadStream, existsSync } from "node:fs";
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import http from "node:http";
import path from "node:path";
import crypto from "node:crypto";

// Import new modules
import { inboxManager } from '../inbox/index.js';
import { campaignManager } from '../campaigns/index.js';
import { walletManager } from '../wallet/index.js';

const HOST = process.env.WARMUP_RUNTIME_HOST || "0.0.0.0";
const PORT = Number(process.env.WARMUP_RUNTIME_PORT || process.env.PORT || 8787);
const TICK_INTERVAL_MS = Number(process.env.WARMUP_TICK_INTERVAL_MS || 60_000);
const DATA_DIR = path.resolve(process.cwd(), "runtime-data");
const STATE_FILE = path.join(DATA_DIR, "warmup-state.json");
const DNA_DIR = path.join(DATA_DIR, "instance-dna");

function resolveAssetDir(dirname) {
  const rootDir = path.resolve(process.cwd(), dirname);
  if (existsSync(rootDir)) return rootDir;
  return path.resolve(process.cwd(), "web", dirname);
}

const FRONT_DIST_DIR = resolveAssetDir("dist"); // Front Lindona
const DASHBOARD_DIST_DIR = resolveAssetDir("dashboard-dist"); // Legacy Dashboard SafeFlow
const MANAGER_DIST_DIR = resolveAssetDir("manager-dist"); // Warmup Manager

/**
 * Estratégia de Isolamento Triple-Path (Conforme SITEMAP.md v2.0):
 * 1.  /               -> Servido via FRONT_DIST_DIR (Landing Page / Redirect)
 * 2.  /warmup/        -> Servido via MANAGER_DIST_DIR (Standalone Assets)
 * 3.  /state/ruptur/  -> Iframe Bridge (Bridge de Isolamento de Roteamento)
 * 4.  /state/ruptur/portal/ -> Servido via STATE_RUPTUR_DIST_DIR (Dashboard Real)
 */
const BRANDING_CONFIG_PATH = path.resolve(process.cwd(), "shared", "ecosystem-branding.json");
const WARMUP_BASE_PATH = "/warmup";
const WARMUP_TRACK_SOURCE = "warmup_manager";
const DEFAULT_WARMUP_24X7_ID = "warmup-default-24x7";
const ACTIVITY_WINDOW_VERSION = 1;
const MAX_QUEUE_EXECUTIONS_PER_TICK = 6;
const MAX_REGENERATION_ENTRIES_PER_ROUND = 2;
const REGENERATION_RECEIVE_INTERVAL_MS = 2 * 60 * 60 * 1000;
const MIME_TYPES = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".ico": "image/x-icon",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".txt": "text/plain; charset=utf-8",
};

const WARMUP_MANAGER_BUTTON_MARKER = "codex-warmup-manager-link";
const WARMUP_TOKEN_CLEAR_MARKER = "codex-runtime-token-clear-action";
const ECOSYSTEM_CHROME_MARKER = "codex-ecosystem-global-chrome";
const ECOSYSTEM_SUPPORT_MARKER = "codex-ecosystem-support-link";
const ECOSYSTEM_THEME_MARKER = "codex-ecosystem-theme-toggle";
const ECOSYSTEM_THEME_STORAGE_KEY = "ruptur:theme";
const DEFAULT_ECOSYSTEM_BRANDING = {
  product: {
    shortName: "Ruptur",
    frontName: "Front Lindona",
    warmupName: "Warmup Manager",
  },
  browser: {
    defaultTitle: "Ruptur",
    defaultDescription: "Ecossistema Ruptur com front principal, operação comercial e Warmup Manager.",
  },
  domains: {
    canonicalAppUrl: "https://app.ruptur.cloud",
    canonicalLandingUrl: "https://ruptur.cloud",
    warmupPath: "/warmup/",
  },
  footer: {
    copyrightText: "© 2025 All Rights Reserved. Status Persianas",
    madeWithText: "Feito com 💙 por",
  },
  company: {
    name: "2DL Company",
    instagramUrl: "https://instagram.com/2dlcompany.oficial",
  },
  support: {
    whatsappNumber: "5531989131980",
    whatsappBaseUrl: "https://wa.me/5531989131980",
    defaultIntent: "Preciso de ajuda",
  },
};

async function loadEcosystemBranding() {
  try {
    const raw = await readFile(BRANDING_CONFIG_PATH, "utf8");
    const parsed = JSON.parse(raw);
    return {
      ...DEFAULT_ECOSYSTEM_BRANDING,
      ...parsed,
      product: { ...DEFAULT_ECOSYSTEM_BRANDING.product, ...(parsed.product ?? {}) },
      browser: { ...DEFAULT_ECOSYSTEM_BRANDING.browser, ...(parsed.browser ?? {}) },
      domains: { ...DEFAULT_ECOSYSTEM_BRANDING.domains, ...(parsed.domains ?? {}) },
      footer: { ...DEFAULT_ECOSYSTEM_BRANDING.footer, ...(parsed.footer ?? {}) },
      company: { ...DEFAULT_ECOSYSTEM_BRANDING.company, ...(parsed.company ?? {}) },
      support: { ...DEFAULT_ECOSYSTEM_BRANDING.support, ...(parsed.support ?? {}) },
    };
  } catch {
    return DEFAULT_ECOSYSTEM_BRANDING;
  }
}

const ECOSYSTEM_BRANDING = await loadEcosystemBranding();

const WARMUP_MANAGER_BUTTON_HTML = `
  <style>
    /* Ajuste para evitar sobreposição no header original */
    nav button.bg-primary.text-primary-foreground.px-5.py-2.rounded-full.font-mono.text-xs.font-bold {
      margin-right: 220px; /* Espaço aumentado para acomodar o novo botão sem sobreposição */
    }

    .${WARMUP_MANAGER_BUTTON_MARKER} {
      position: fixed;
      top: 18px;
      right: 18px;
      z-index: 9999;
      display: inline-flex;
      align-items: center;
      gap: 8px;
      padding: 12px 16px;
      border-radius: 999px;
      border: 1px solid rgba(255,255,255,0.14);
      background: linear-gradient(135deg, #7c3aed 0%, #2563eb 100%);
      color: #ffffff;
      font: 600 14px/1.2 -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      text-decoration: none;
      box-shadow: 0 12px 32px rgba(37, 99, 235, 0.28);
      backdrop-filter: blur(10px);
    }

    .${WARMUP_MANAGER_BUTTON_MARKER}:hover {
      transform: translateY(-1px);
      filter: brightness(1.04);
    }

    .${WARMUP_MANAGER_BUTTON_MARKER} small {
      display: block;
      margin-top: 2px;
      font-size: 11px;
      font-weight: 500;
      opacity: 0.84;
    }

    @media (max-width: 900px) {
      nav button.bg-primary.text-primary-foreground.px-5.py-2.rounded-full.font-mono.text-xs.font-bold {
        margin-right: 0;
      }

      .${WARMUP_MANAGER_BUTTON_MARKER} {
        top: 78px;
        right: 12px;
        padding: 10px 14px;
      }
    }
  </style>
  <a class="${WARMUP_MANAGER_BUTTON_MARKER}" href="${WARMUP_BASE_PATH}/" target="_blank" rel="noopener noreferrer">
    <span>
      ${ECOSYSTEM_BRANDING.product.warmupName}
      <small>abre em nova aba • instâncias, regras e saúde</small>
    </span>
  </a>
`;

const WARMUP_MANAGER_SETTINGS_ACTIONS_HTML = `
  <style>
    .${WARMUP_TOKEN_CLEAR_MARKER} {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      margin-right: 10px;
      padding: 4px 10px;
      border: 1px solid rgba(239, 68, 68, 0.35);
      border-radius: 999px;
      background: rgba(239, 68, 68, 0.12);
      color: rgb(248, 113, 113);
      font: 600 11px/1.2 -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      cursor: pointer;
      vertical-align: middle;
    }

    .${WARMUP_TOKEN_CLEAR_MARKER}:hover {
      background: rgba(239, 68, 68, 0.18);
      filter: brightness(1.04);
    }

    .${WARMUP_TOKEN_CLEAR_MARKER}:disabled {
      opacity: 0.65;
      cursor: wait;
    }
  </style>
  <script>
    (() => {
      const marker = "${WARMUP_TOKEN_CLEAR_MARKER}";
      const endpoint = "${WARMUP_BASE_PATH}/api/local/warmup/clear-token";

      async function clearToken(button) {
        const confirmed = window.confirm("Remover o token ativo do runtime e zerar o painel operacional?");
        if (!confirmed) return;

        const originalLabel = button.textContent;
        button.disabled = true;
        button.textContent = "Removendo...";

        try {
          const response = await fetch(endpoint, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ actor: "Operador local", reason: "Token removido manualmente pela interface" }),
          });

          if (!response.ok) {
            let message = "Nao foi possivel remover o token do runtime.";
            try {
              const payload = await response.json();
              if (payload && typeof payload.error === "string" && payload.error.trim()) {
                message = payload.error.trim();
              }
            } catch {}
            throw new Error(message);
          }

          window.location.reload();
        } catch (error) {
          window.alert(error instanceof Error ? error.message : "Falha ao remover o token do runtime.");
          button.disabled = false;
          button.textContent = originalLabel;
        }
      }

      function wireTokenClearAction() {
        const notes = Array.from(document.querySelectorAll("p"))
          .filter((element) => (element.textContent || "").includes("Token ativo no runtime"));

        for (const note of notes) {
          if (note.querySelector("." + marker)) continue;
          const button = document.createElement("button");
          button.type = "button";
          button.className = marker;
          button.textContent = "Remover token";
          button.addEventListener("click", () => clearToken(button));
          note.prepend(button);
        }
      }

      if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", wireTokenClearAction, { once: true });
      } else {
        wireTokenClearAction();
      }

      const observer = new MutationObserver(() => wireTokenClearAction());
      observer.observe(document.documentElement, { childList: true, subtree: true });
    })();
  </script>
`;

let state = await loadState();
let tickTimer = null;
let tickInFlight = null;

function getDefaultSettings() {
  return {
    serverUrl: process.env.WARMUP_SERVER_URL || "https://tiatendeai.uazapi.com",
    adminToken: process.env.WARMUP_ADMIN_TOKEN || "",
    supabaseUrl: process.env.VITE_SUPABASE_URL || "https://axrwlboyowoskdxeogba.supabase.co",
    supabaseKey: process.env.VITE_SUPABASE_PUBLISHABLE_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF4cndsYm95b3dvc2tkeGVvZ2JhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM5MzkzNTYsImV4cCI6MjA4OTUxNTM1Nn0.jrVy7OzLgidDYlK2rFuF1NX2SRP0EVmQycx3d_s7vV8",
    defaultDelay: 3000,
    warmupMinIntervalMs: 2 * 60 * 1000,
    warmupMaxDailyPerInstance: 250,
    warmupCooldownRounds: 1,
    warmupReadChat: false,
    warmupReadMessages: false,
    warmupAsync: true,
    antiBanMaxPerMinute: 12,
  };
}

function getReachableMinIntervalMs(maxDailyPerInstance) {
  const target = Math.max(1, Math.round(Number(maxDailyPerInstance) || 0));
  if (!target) return 0;
  return Math.ceil(86_400_000 / target);
}

function normalizeSettings(settings = {}) {
  const next = {
    ...getDefaultSettings(),
    ...(settings ?? {}),
  };

  next.serverUrl = String(next.serverUrl ?? "").trim() || process.env.WARMUP_SERVER_URL || "https://tiatendeai.uazapi.com";
  next.adminToken = String(next.adminToken ?? "").trim() || process.env.WARMUP_ADMIN_TOKEN || "";

  if (!Number.isFinite(next.warmupMaxDailyPerInstance) || next.warmupMaxDailyPerInstance <= 0 || next.warmupMaxDailyPerInstance === 12) {
    next.warmupMaxDailyPerInstance = 250;
  }

  if (!Number.isFinite(next.antiBanMaxPerMinute) || next.antiBanMaxPerMinute < 0) {
    next.antiBanMaxPerMinute = 12;
  }

  const reachableMinIntervalMs = getReachableMinIntervalMs(next.warmupMaxDailyPerInstance);
  if (
    Number.isFinite(reachableMinIntervalMs)
    && reachableMinIntervalMs > 0
    && Number.isFinite(next.warmupMinIntervalMs)
    && next.warmupMinIntervalMs > reachableMinIntervalMs
  ) {
    next.warmupMinIntervalMs = reachableMinIntervalMs;
  }

  return next;
}

function mergeRuntimeSettings(currentSettings = {}, incomingSettings = {}) {
  const normalizedIncoming = normalizeSettings(incomingSettings ?? {});
  const current = normalizeSettings(currentSettings ?? {});

  return normalizeSettings({
    ...current,
    ...normalizedIncoming,
    serverUrl: normalizedIncoming.serverUrl?.trim() || current.serverUrl,
    adminToken: normalizedIncoming.adminToken?.trim() || current.adminToken || "",
  });
}

function hasRuntimeCredentialChange(currentSettings = {}, nextSettings = {}) {
  const currentServerUrl = String(currentSettings?.serverUrl ?? "").trim();
  const nextServerUrl = String(nextSettings?.serverUrl ?? "").trim();
  const currentAdminToken = String(currentSettings?.adminToken ?? "").trim();
  const nextAdminToken = String(nextSettings?.adminToken ?? "").trim();

  return currentServerUrl !== nextServerUrl || currentAdminToken !== nextAdminToken;
}

function isDemoServerValidationError(error) {
  const message = String(error instanceof Error ? error.message : error ?? "").toLowerCase();
  return message.includes("public demo server") || message.includes("endpoint has been disabled");
}

function createEmptyPoolState() {
  return {
    persistent: {
      updatedAt: new Date(0).toISOString(),
      healthyTokens: [],
      readyTokens: [],
    },
    currentRound: undefined,
  };
}

function createDefaultState() {
  return {
    config: {
      settings: normalizeSettings(),
      routines: [],
      messages: [],
    },
    scheduler: {
      enabled: false,
      status: "paused",
      round: 0,
      lastManualAction: undefined,
    },
    summary: {
      totalInstances: 0,
      connected: 0,
      eligible: 0,
      heatingNow: 0,
      regenerating: 0,
      queuedEntries: 0,
      persistentPoolSize: 0,
      subpoolCount: 0,
      sentToday: 0,
      recentErrors: 0,
      activeRoutines: 0,
      cadenceBpm: 0,
      isPulsing: false,
    },
    currentPool: createEmptyPoolState(),
    instanceStates: {},
    logs: [],
    auditTrail: [],
    lastSyncedAt: undefined,
    activityWindowVersion: ACTIVITY_WINDOW_VERSION,
    activityWindowResetAt: undefined,
  };
}

function jsonClone(value) {
  return JSON.parse(JSON.stringify(value));
}

function isProtectedRoutine(routine) {
  return String(routine?.id ?? "") === DEFAULT_WARMUP_24X7_ID;
}

function getNextLocalDayStart(now) {
  const next = new Date(now);
  next.setHours(24, 0, 0, 0);
  return next;
}

function buildNextEligibleAt({
  now,
  lastSentAt,
  minIntervalMs,
  cooldownRounds = 0,
  dailyLimitReached = false,
}) {
  const candidates = [];

  if (lastSentAt) {
    const lastSentDate = new Date(lastSentAt);
    if (!Number.isNaN(lastSentDate.getTime())) {
      candidates.push(lastSentDate.getTime() + minIntervalMs);
    }
  }

  if (cooldownRounds > 0) {
    candidates.push(now.getTime() + cooldownRounds * TICK_INTERVAL_MS * 0.1); // Cooldown menor em runtime para rotação
  }

  if (dailyLimitReached) {
    candidates.push(getNextLocalDayStart(now).getTime());
  }

  if (!candidates.length) {
    return undefined;
  }

  return new Date(Math.max(...candidates)).toISOString();
}

function rebaseActivityWindow(nextState, now = new Date()) {
  const nowIso = now.toISOString();

  for (const instanceState of Object.values(nextState.instanceStates ?? {})) {
    instanceState.sentToday = 0;
    instanceState.lastSentAt = nowIso;
    instanceState.nextEligibleAt = new Date(
      now.getTime() + nextState.config.settings.warmupMinIntervalMs,
    ).toISOString();
    instanceState.cooldownRounds = 0;
    instanceState.lastRoundParticipated = undefined;
    instanceState.eligibleNow = false;
    instanceState.warmingNow = false;
    instanceState.eligibilityReason = "Janela temporal reiniciada";
    instanceState.updatedAt = nowIso;
    instanceState.heatScore = instanceState.heatScore ?? 0;
    instanceState.heatStage = instanceState.heatStage ?? "blocked";
  }

  nextState.summary.heatingNow = 0;
  nextState.summary.queuedEntries = 0;
  nextState.summary.subpoolCount = 0;
  nextState.currentPool.currentRound = undefined;
  nextState.activityWindowVersion = ACTIVITY_WINDOW_VERSION;
  nextState.activityWindowResetAt = nowIso;
}

async function loadState() {
  try {
    const raw = await readFile(STATE_FILE, "utf8");
    const parsed = JSON.parse(raw);
    const normalizedSettings = normalizeSettings(parsed.config?.settings ?? {});
    const nextState = {
      ...createDefaultState(),
      ...parsed,
      config: {
        ...createDefaultState().config,
        ...(parsed.config ?? {}),
        settings: normalizedSettings,
      },
      scheduler: {
        ...createDefaultState().scheduler,
        ...(parsed.scheduler ?? {}),
      },
      summary: {
        ...createDefaultState().summary,
        ...(parsed.summary ?? {}),
      },
      currentPool: {
        ...createEmptyPoolState(),
        ...(parsed.currentPool ?? {}),
        persistent: {
          ...createEmptyPoolState().persistent,
          ...(parsed.currentPool?.persistent ?? {}),
        },
      },
      instanceStates: parsed.instanceStates ?? {},
      logs: parsed.logs ?? [],
      auditTrail: parsed.auditTrail ?? [],
      lastSyncedAt: parsed.lastSyncedAt,
      activityWindowVersion: parsed.activityWindowVersion ?? 0,
      activityWindowResetAt: parsed.activityWindowResetAt,
    };

    const shouldPersistMigratedState = JSON.stringify(normalizedSettings) !== JSON.stringify(parsed.config?.settings ?? {});

    if ((parsed.activityWindowVersion ?? 0) < ACTIVITY_WINDOW_VERSION) {
      rebaseActivityWindow(nextState, new Date());
      await mkdir(DATA_DIR, { recursive: true });
      await writeFile(STATE_FILE, JSON.stringify(nextState, null, 2));
    } else if (shouldPersistMigratedState) {
      await mkdir(DATA_DIR, { recursive: true });
      await writeFile(STATE_FILE, JSON.stringify(nextState, null, 2));
    }

    return nextState;
  } catch {
    return createDefaultState();
  }
}

async function saveState() {
  try {
    await mkdir(DATA_DIR, { recursive: true });
    await writeFile(STATE_FILE, JSON.stringify(state, null, 2));
  } catch (error) {
    console.error("[warmup-runtime] Falha ao salvar estado", error);
  }
}

function createResponse(res, statusCode, payload) {
  res.writeHead(statusCode, {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Content-Type": "application/json; charset=utf-8",
  });
  res.end(JSON.stringify(payload));
}

async function updateInstanceDna(token, event) {
  try {
    await mkdir(DNA_DIR, { recursive: true });
    const dnaPath = path.join(DNA_DIR, `${token}.json`);
    let dna = { history: [], firstSeenAt: new Date().toISOString() };

    if (existsSync(dnaPath)) {
      dna = JSON.parse(await readFile(dnaPath, "utf8"));
    }

    dna.history.unshift({
      timestamp: new Date().toISOString(),
      ...event
    });

    // Manter últimos 200 eventos por instância
    dna.history = dna.history.slice(0, 200);
    dna.lastUpdatedAt = new Date().toISOString();

    await writeFile(dnaPath, JSON.stringify(dna, null, 2));
  } catch (error) {
    console.error(`[warmup-runtime] Falha ao atualizar DNA para ${token}`, error);
  }
}

function addRuntimeLog(entry) {
  state.logs.unshift({
    id: crypto.randomUUID(),
    timestamp: new Date().toISOString(),
    ...entry,
  });
  state.logs = state.logs.slice(0, 500);
}

function addAuditEntry(entry) {
  state.auditTrail.unshift({
    id: crypto.randomUUID(),
    timestamp: new Date().toISOString(),
    ...entry,
  });
  state.auditTrail = state.auditTrail.slice(0, 200);
}

function extractResolvedNumber(status, instance) {
  const jidUser = status?.status?.jid?.user?.replace(/\D/g, "");
  if (jidUser) return jidUser;

  const owner = instance?.owner?.replace(/\D/g, "");
  if (owner) return owner;

  return undefined;
}

function createDefaultInstanceState(instanceToken, instanceName) {
  return {
    instanceToken,
    instanceName,
    sentToday: 0,
    sendsLog: [],
    nextEligibleAt: undefined,
    lastRegenerationAt: undefined,
    nextRegenerationAt: undefined,
    cooldownRounds: 0,
    eligibleNow: false,
    warmingNow: false,
    proxyStatus: "unknown",
    proxy: undefined,
    heatScore: 0,
    heatStage: "blocked",
    updatedAt: new Date(0).toISOString(),
  };
}

function isSameDay(left, right) {
  return (
    left.getFullYear() === right.getFullYear() &&
    left.getMonth() === right.getMonth() &&
    left.getDate() === right.getDate()
  );
}

function getCooldownRemaining(instanceState, round) {
  if (!instanceState.cooldownRounds || instanceState.lastRoundParticipated == null) {
    return 0;
  }

  const roundsSinceLastParticipation = Math.max(0, round - instanceState.lastRoundParticipated);
  return Math.max(0, instanceState.cooldownRounds - roundsSinceLastParticipation);
}

function calculateHealthScore(params) {
  let score = 100;

  if (params.instance.status !== "connected") score -= 30; // Reduzido de 50 para 30 para permitir estado 'waiting' em vez de 'blocked'
  if (params.instance.isBusiness === false) score -= 10;
  if (params.state.proxyStatus === "error") score -= 20; // Reduzido de 30 para 20

  const usageRatio = params.state.sentToday / params.settings.warmupMaxDailyPerInstance;
  if (usageRatio >= 0.9) score -= 25;
  else if (usageRatio >= 0.7) score -= 15;

  if (params.state.cooldownRounds > 0) score -= 5;

  // Penalidade por falhas de conexão no histórico recente
  if (params.instance.lastDisconnectReason?.toLowerCase().includes("fail")) {
    score -= 15;
  }

  // Bônus por estabilidade (tempo conectado) - placeholder para futura implementação
  // score += Math.min(10, connectedMinutes / 60);

  return Math.max(0, Math.min(100, score));
}

function isRegeneratingCandidate(instance, instanceState) {
  if (!instanceState) return false;
  if (instance?.status !== "connected") return false;
  if (!instanceState.resolvedNumber) return false;

  const normalizedReason = String(instanceState.eligibilityReason ?? "").toLowerCase();
  if (
    normalizedReason.includes("desconectada")
    || normalizedReason.includes("número não resolvido")
    || instanceState.proxyStatus === "error"
  ) {
    return false;
  }

  return Number(instanceState.heatScore ?? 100) < 40;
}

function buildNextRegenerationAt(now, lastRegenerationAt) {
  const baseTime = lastRegenerationAt
    ? new Date(lastRegenerationAt).getTime()
    : now.getTime();

  return new Date(baseTime + REGENERATION_RECEIVE_INTERVAL_MS).toISOString();
}

function normalizeInstanceState({ currentState, instance, round, now, resolvedNumber, instanceData }) {
  const base = currentState ?? createDefaultInstanceState(instance.token, instance.name);
  const proxy = instanceData?.proxy ?? base.proxy;
  const isManagedProxy = Boolean(
    proxy?.managed
    || proxy?.proxy_fallback === "internal_proxy"
    || String(proxy?.proxy_url ?? "").startsWith("managed_pool://")
  );
  const hasCustomProxy = Boolean(proxy?.enabled && proxy?.proxy_url && !isManagedProxy);
  const next = {
    ...base,
    instanceName: instance.name,
    warmingNow: false,
    resolvedNumber: resolvedNumber ?? base.resolvedNumber,
    proxy,
    proxyStatus: proxy?.validation_error
      ? "error"
      : isManagedProxy
        ? "managed"
        : hasCustomProxy
          ? "custom"
          : proxy
            ? "internal"
            : "unknown",
    updatedAt: now.toISOString(),
    nextEligibleAt: undefined,
    tenantId: instanceData?.bubble_user_id || instanceData?.tenantId || base.tenantId, // Multi-tenant: Vincula a instância ao cliente
    lastReconnectAttemptAt: base.lastReconnectAttemptAt,
  };

  // Limpeza da janela móvel de 24h
  const twentyFourHoursAgo = now.getTime() - 24 * 60 * 60 * 1000;
  next.sendsLog = (next.sendsLog || []).filter(ts => new Date(ts).getTime() > twentyFourHoursAgo);
  next.sentToday = next.sendsLog.length;

  next.cooldownRounds = getCooldownRemaining(next, round);

  if (instanceData) {
    next.heatScore = calculateHealthScore({
      instance: instanceData,
      state: next,
      settings: state.config.settings,
    });

    if (next.heatScore >= 80) next.heatStage = "eligible";
    else if (next.heatScore >= 40) next.heatStage = "waiting";
    else next.heatStage = "blocked";

    // Auto-restauração: Se estava bloqueada mas a saúde subiu acima de 40%, removemos o bloqueio do Kill Switch
    if (next.heatScore > 40 && next.eligibilityReason?.includes("KILL SWITCH")) {
      next.eligibilityReason = "Saúde restabelecida (>40%). Saindo do Kill Switch.";
    }
  }

  const minIntervalMet = !next.lastSentAt ||
    now.getTime() - new Date(next.lastSentAt).getTime() >= state.config.settings.warmupMinIntervalMs;
  const dailyLimitMet = next.sentToday < state.config.settings.warmupMaxDailyPerInstance;

  if (instance.status !== "connected") {
    next.eligibleNow = false;
    next.eligibilityReason = "Instância desconectada";
    return next;
  }

  if (!next.resolvedNumber) {
    next.eligibleNow = false;
    next.eligibilityReason = "Número não resolvido";
    return next;
  }

  if (isRegeneratingCandidate(instance, next)) {
    next.eligibleNow = false;
    next.heatStage = "regenerating";
    next.nextEligibleAt = buildNextRegenerationAt(now, next.lastRegenerationAt);
    next.eligibilityReason = next.nextEligibleAt
      ? `Auto-regeneração ativa até ${new Date(next.nextEligibleAt).toLocaleString("pt-BR")}`
      : "Auto-regeneração ativa";
    return next;
  }

  if (!minIntervalMet) {
    next.eligibleNow = false;
    next.nextEligibleAt = buildNextEligibleAt({
      now,
      lastSentAt: next.lastSentAt,
      minIntervalMs: state.config.settings.warmupMinIntervalMs,
    });
    next.eligibilityReason = next.nextEligibleAt
      ? `Aguardando intervalo mínimo até ${new Date(next.nextEligibleAt).toLocaleString("pt-BR")}`
      : "Aguardando intervalo mínimo";
    return next;
  }

  if (!dailyLimitMet) {
    next.eligibleNow = false;
    next.nextEligibleAt = buildNextEligibleAt({
      now,
      lastSentAt: next.lastSentAt,
      minIntervalMs: state.config.settings.warmupMinIntervalMs,
      dailyLimitReached: true,
    });
    next.eligibilityReason = next.nextEligibleAt
      ? `Limite diário atingido até ${new Date(next.nextEligibleAt).toLocaleString("pt-BR")}`
      : "Limite diário atingido";
    return next;
  }

  if (next.cooldownRounds > 0) {
    next.eligibleNow = false;
    next.nextEligibleAt = buildNextEligibleAt({
      now,
      lastSentAt: next.lastSentAt,
      minIntervalMs: state.config.settings.warmupMinIntervalMs,
      cooldownRounds: next.cooldownRounds,
    });
    next.eligibilityReason = next.nextEligibleAt
      ? `Em cooldown até ${new Date(next.nextEligibleAt).toLocaleString("pt-BR")}`
      : `Em cooldown por ${next.cooldownRounds} rodada(s)`;
    return next;
  }

  next.eligibleNow = true;
  next.eligibilityReason = "Elegível";
  return next;
}

function markInstanceSent(instanceState, round, now) {
  const nextEligibleAt = buildNextEligibleAt({
    now,
    lastSentAt: now.toISOString(),
    minIntervalMs: state.config.settings.warmupMinIntervalMs,
    cooldownRounds: state.config.settings.warmupCooldownRounds,
  });

  const updatedLog = [...(instanceState.sendsLog || []), now.toISOString()];

  return {
    ...instanceState,
    sendsLog: updatedLog,
    sentToday: updatedLog.length,
    lastSentAt: now.toISOString(),
    nextEligibleAt,
    cooldownRounds: state.config.settings.warmupCooldownRounds,
    lastRoundParticipated: round,
    eligibleNow: false,
    warmingNow: true,
    eligibilityReason: nextEligibleAt
      ? `Último disparo em ${now.toLocaleString("pt-BR")} · próximo ciclo após ${new Date(nextEligibleAt).toLocaleString("pt-BR")}`
      : `Mensagem enviada na rodada ${round}`,
    updatedAt: now.toISOString(),
    heatStage: "waiting",
  };
}

function markInstanceRegeneration(receiverState, now) {
  return {
    ...receiverState,
    lastRegenerationAt: now.toISOString(),
    nextRegenerationAt: buildNextRegenerationAt(now, now.toISOString()),
    eligibilityReason: `Auto-regeneração assistida em ${now.toLocaleString("pt-BR")}`,
    updatedAt: now.toISOString(),
    heatStage: "regenerating",
  };
}

function clearWarmingFlags() {
  for (const instanceState of Object.values(state.instanceStates)) {
    instanceState.warmingNow = false;
  }
  state.summary.heatingNow = 0;
  state.summary.queuedEntries = 0;
  state.summary.subpoolCount = 0;
  state.currentPool.currentRound = undefined;
}

function createTrackId(routineId, round, senderToken, receiverToken) {
  return [
    "warmup",
    routineId,
    `r${round}`,
    senderToken.slice(0, 6),
    receiverToken.slice(0, 6),
    crypto.randomUUID().slice(0, 8),
  ].join("_");
}

function shuffle(values) {
  const clone = [...values];
  for (let index = clone.length - 1; index > 0; index -= 1) {
    const randomIndex = Math.floor(Math.random() * (index + 1));
    [clone[index], clone[randomIndex]] = [clone[randomIndex], clone[index]];
  }
  return clone;
}

function normalizeActivityLabel(value, fallback = "Mensagem") {
  const normalized = String(value ?? "").trim();
  return normalized || fallback;
}

function pickRoutineMessage(routine, options = {}) {
  const { allowGroup = false } = options;
  let routineMessages = state.config.messages.filter((message) => routine.messages.includes(message.id));

  // Fallback: if routine.messages is empty, use all global messages
  if (!routine.messages.length) {
    console.warn(`[warmup:message] Routine "${routine.name}" has empty messages array, using all global messages (${state.config.messages.length})`);
    routineMessages = state.config.messages;
  }

  if (allowGroup) {
    const groupMessages = routineMessages.filter((message) => String(message.category ?? "").trim().toLowerCase() === "grupo");
    if (groupMessages.length) {
      routineMessages = groupMessages;
    }
  } else {
    const directMessages = routineMessages.filter((message) => String(message.category ?? "").trim().toLowerCase() !== "grupo");
    if (directMessages.length) {
      routineMessages = directMessages;
    }
  }

  if (!routineMessages.length) {
    console.error(`[warmup:message] No messages available for routine "${routine.name}" (allowGroup: ${allowGroup})`);
    return undefined;
  }

  const selected = routineMessages[Math.floor(Math.random() * routineMessages.length)];
  console.log(`[warmup:message] Selected message "${selected.name}" (category: ${selected.category}) for routine "${routine.name}"`);
  return selected;
}

function buildDefaultRoutine(instances) {
  const allTokens = Array.from(new Set(instances.map((instance) => instance.token)));
  const directMessageIds = state.config.messages
    .filter((message) => String(message.category ?? "").trim().toLowerCase() !== "grupo")
    .map((message) => message.id);
  const fallbackMessageIds = state.config.messages.map((message) => message.id);
  const selectedMessages = directMessageIds.length ? directMessageIds : fallbackMessageIds;

  return {
    id: DEFAULT_WARMUP_24X7_ID,
    name: "Warmup 24/7 Padrão",
    mode: "one-to-one",
    senderInstances: allTokens,
    receiverInstances: allTokens,
    messages: selectedMessages,
    delayMin: 8,
    delayMax: 20,
    isActive: true,
    createdAt: new Date().toISOString(),
    totalSent: 0,
  };
}

function refreshProtectedRoutines(routines, instances) {
  const allTokens = Array.from(new Set(instances.map((instance) => instance.token)));

  for (const routine of routines) {
    if (!isProtectedRoutine(routine)) {
      continue;
    }

    routine.senderInstances = allTokens;
    routine.receiverInstances = allTokens;
  }
}

function reconcileProtectedRoutines({ currentRoutines = [], incomingRoutines = [], instances = [] } = {}) {
  const nonProtectedRoutines = incomingRoutines.filter((routine) => !isProtectedRoutine(routine));
  const protectedIncoming = incomingRoutines.find((routine) => isProtectedRoutine(routine));
  const protectedCurrent = currentRoutines.find((routine) => isProtectedRoutine(routine));

  let protectedRoutine = protectedIncoming ?? protectedCurrent;
  let createdProtectedRoutine = false;

  if (!protectedRoutine) {
    const defaultRoutine = buildDefaultRoutine(instances);
    if (defaultRoutine) {
      if (nonProtectedRoutines.some((routine) => routine?.isActive)) {
        defaultRoutine.isActive = false;
      }
      protectedRoutine = defaultRoutine;
      createdProtectedRoutine = true;
    }
  }

  const nextRoutines = protectedRoutine
    ? [protectedRoutine, ...nonProtectedRoutines]
    : [...nonProtectedRoutines];

  refreshProtectedRoutines(nextRoutines, instances);

  return {
    routines: nextRoutines,
    createdProtectedRoutine,
  };
}

function ensureDefaultRoutine(instances) {
  const beforeRoutines = JSON.stringify(state.config.routines);
  const { routines, createdProtectedRoutine } = reconcileProtectedRoutines({
    currentRoutines: state.config.routines,
    incomingRoutines: state.config.routines,
    instances,
  });

  state.config.routines = routines;
  state.summary.activeRoutines = state.config.routines.filter((routine) => routine.isActive).length;

  if (createdProtectedRoutine && JSON.stringify(state.config.routines) !== beforeRoutines) {
    const defaultRoutine = state.config.routines.find((routine) => isProtectedRoutine(routine));
    addRuntimeLog({
      type: "warmup",
      instanceName: "runtime",
      message: "Rotina padrão 24/7 criada automaticamente",
      status: "info",
      routineId: defaultRoutine?.id,
      routineName: defaultRoutine?.name,
      mode: defaultRoutine?.mode,
    });
  }
}

async function bootstrapProtectedRoutine() {
  const beforeRoutines = JSON.stringify(state.config.routines);
  ensureDefaultRoutine([]);
  if (JSON.stringify(state.config.routines) !== beforeRoutines) {
    await saveState();
  }
}

function getRandomDelayMs(routine) {
  const min = Math.max(0, Number(routine.delayMin ?? 0));
  const max = Math.max(min, Number(routine.delayMax ?? min));
  return Math.round((Math.random() * (max - min) + min) * 1000);
}

async function fetchJson(url, init, fallbackMessage) {
  const response = await fetch(url, init);
  if (!response.ok) {
    let message = `${fallbackMessage}: ${response.status}`;
    try {
      const payload = await response.json();
      if (typeof payload?.error === "string") {
        message = payload.error;
      }
    } catch { }
    throw new Error(message);
  }

  return response.json();
}

async function fetchAllInstances() {
  if (!state.config.settings.adminToken?.trim()) {
    throw new Error("Admin token não configurado no runtime.");
  }

  return fetchJson(`${state.config.settings.serverUrl}/instance/all`, {
    headers: {
      admintoken: state.config.settings.adminToken,
    },
  }, "Erro ao buscar instâncias");
}

async function fetchAllInstancesForSettings(settings = {}) {
  if (!settings?.adminToken?.trim()) {
    throw new Error("Admin token não configurado no runtime.");
  }

  return fetchJson(`${settings.serverUrl}/instance/all`, {
    headers: {
      admintoken: settings.adminToken,
    },
  }, "Erro ao buscar instâncias");
}

async function fetchInstanceStatus(token) {
  return fetchJson(`${state.config.settings.serverUrl}/instance/status`, {
    headers: {
      token,
    },
  }, "Erro ao buscar status da instância");
}

async function fetchInstanceProxy(token) {
  return fetchJson(`${state.config.settings.serverUrl}/instance/proxy`, {
    headers: {
      token,
    },
  }, "Erro ao buscar proxy da instância");
}

async function sendText(token, payload) {
  return fetchJson(`${state.config.settings.serverUrl}/send/text`, {
    method: "POST",
    headers: {
      token,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  }, "Erro ao enviar warmup (texto)");
}

async function sendAudio(token, payload) {
  return fetchJson(`${state.config.settings.serverUrl}/send/media`, {
    method: "POST",
    headers: {
      token,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  }, "Erro ao enviar warmup (áudio)");
}

async function sendPresence(token, payload) {
  return fetchJson(`${state.config.settings.serverUrl}/message/presence`, {
    method: "POST",
    headers: {
      token,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  }, "Erro ao simular presença");
}

async function setInstancePresence(token, presence) {
  return fetchJson(`${state.config.settings.serverUrl}/instance/presence`, {
    method: "POST",
    headers: {
      token,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ presence }),
  }, "Erro ao alterar presença da instância");
}

/**
 * Watchdog: Tenta reconectar uma instância que caiu
 */
async function connectInstance(token) {
  try {
    const result = await fetchJson(`${state.config.settings.serverUrl}/instance/connect`, {
      method: "POST",
      headers: {
        token,
        admintoken: state.config.settings.adminToken,
      },
    }, "Erro ao tentar reconectar instância");
    console.log(`[warmup:connect] Sucesso ao solicitar reconexão para ${token}`);
    return result;
  } catch (err) {
    // Se falhar, logamos o erro detalhado
    console.error(`[warmup:watchdog] FALHA na reconexão para ${token}:`, err.message);
    return null;
  }
}

function buildPersistentPool(instances, tickStartedAt) {
  const healthyTokens = [];
  const readyTokens = [];

  for (const instance of instances) {
    const instanceState = state.instanceStates[instance.token];
    const isHealthy = instance.status === "connected" && Boolean(instanceState?.resolvedNumber);

    if (isHealthy) {
      healthyTokens.push(instance.token);
    }

    if (instanceState?.eligibleNow) {
      readyTokens.push(instance.token);
    }
  }

  return {
    updatedAt: tickStartedAt.toISOString(),
    healthyTokens,
    readyTokens,
  };
}

function buildDispatchPlan(routine) {
  const eligibleSenders = shuffle(routine.senderInstances).filter((token) => state.instanceStates[token]?.eligibleNow);

  console.log(`[warmup:dispatch] Building plan for routine "${routine.name}" (mode: ${routine.mode})`);
  console.log(`[warmup:dispatch] Total senders in routine: ${routine.senderInstances.length}`);
  console.log(`[warmup:dispatch] Eligible senders: ${eligibleSenders.length}`);
  console.log(`[warmup:dispatch] Total receivers in routine: ${routine.receiverInstances.length}`);

  if (routine.mode === "group") {
    const groupId = shuffle(routine.receiverInstances.filter((entry) => entry.endsWith("@g.us")))[0];
    const senderToken = eligibleSenders[0];
    console.log(`[warmup:dispatch] Group mode - Group ID: ${groupId}, Sender: ${senderToken}`);
    if (!groupId) {
      console.warn(`[warmup:dispatch] No group found in receiverInstances`);
    }
    if (!senderToken) {
      console.warn(`[warmup:dispatch] No eligible sender for group mode`);
    }
    return groupId && senderToken
      ? [{ senderToken, receiverToken: groupId, isGroup: true }]
      : [];
  }

  const directReceivers = shuffle(routine.receiverInstances.filter((entry) => !entry.endsWith("@g.us")))
    .filter((token) => state.instanceStates[token]?.resolvedNumber);
  const plan = [];

  console.log(`[warmup:dispatch] Direct receivers (with resolved number): ${directReceivers.length}`);

  if (routine.mode === "one-to-one") {
    const usedReceivers = new Set();
    let skippedCount = 0;

    for (const senderToken of eligibleSenders) {
      const receiverToken = directReceivers.find((token) => token !== senderToken && !usedReceivers.has(token))
        ?? directReceivers.find((token) => token !== senderToken);

      if (!receiverToken) {
        skippedCount++;
        console.warn(`[warmup:dispatch] No receiver found for sender ${senderToken} (skipped)`);
        continue;
      }

      usedReceivers.add(receiverToken);
      plan.push({ senderToken, receiverToken });
    }

    console.log(`[warmup:dispatch] One-to-one mode - Plan size: ${plan.length}, Skipped: ${skippedCount}`);
    
    if (plan.length === 0) {
      console.error(`[warmup:dispatch] CRITICAL: No dispatch plan created!`);
      console.error(`[warmup:dispatch] - Eligible senders: ${eligibleSenders.length}`);
      console.error(`[warmup:dispatch] - Direct receivers: ${directReceivers.length}`);
      console.error(`[warmup:dispatch] - Sender tokens: ${eligibleSenders.slice(0, 5).join(', ')}${eligibleSenders.length > 5 ? '...' : ''}`);
      console.error(`[warmup:dispatch] - Receiver tokens: ${directReceivers.slice(0, 5).join(', ')}${directReceivers.length > 5 ? '...' : ''}`);
      
      // Check if sender and receiver lists are identical
      const sendersSet = new Set(eligibleSenders);
      const receiversSet = new Set(directReceivers);
      const areIdentical = sendersSet.size === receiversSet.size && 
                          [...sendersSet].every(token => receiversSet.has(token));
      
      if (areIdentical && eligibleSenders.length === 1) {
        console.error(`[warmup:dispatch] ROOT CAUSE: Only 1 instance available for both sender and receiver - cannot send to self`);
      } else if (areIdentical) {
        console.error(`[warmup:dispatch] ROOT CAUSE: Sender and receiver lists are identical (${eligibleSenders.length} instances) - need at least 2 different instances`);
      }
    }

    return plan;
  }

  if (routine.mode === "one-to-all") {
    const senderToken = eligibleSenders[0];
    if (!senderToken) {
      return [];
    }

    for (const receiverToken of directReceivers.filter((token) => token !== senderToken).slice(0, 4)) {
      plan.push({ senderToken, receiverToken });
    }
    return plan;
  }

  if (routine.mode === "all-to-one") {
    const receiverToken = directReceivers[0];
    if (!receiverToken) {
      return [];
    }

    for (const senderToken of eligibleSenders.filter((token) => token !== receiverToken).slice(0, 4)) {
      plan.push({ senderToken, receiverToken });
    }
    return plan;
  }

  for (const senderToken of eligibleSenders) {
    for (const receiverToken of directReceivers.filter((token) => token !== senderToken).slice(0, 2)) {
      plan.push({ senderToken, receiverToken });
    }
  }

  return plan;
}

function pickRegenerationMessage(routine) {
  const directMessages = state.config.messages.filter((message) => {
    if (!routine.messages.includes(message.id)) return false;
    return String(message.category ?? "").trim().toLowerCase() !== "grupo";
  });

  if (directMessages.length) {
    return directMessages[Math.floor(Math.random() * directMessages.length)];
  }

  return state.config.messages.find((message) => String(message.category ?? "").trim().toLowerCase() !== "grupo");
}

function buildRegenerationEntries({ routines, instancesByToken, round, tickStartedAt, roundPool }) {
  const activeDirectRoutine = routines.find((routine) => routine.mode !== "group");
  if (!activeDirectRoutine) {
    return [];
  }

  const regenerationMessage = pickRegenerationMessage(activeDirectRoutine);
  if (!regenerationMessage) {
    return [];
  }

  const alreadyQueuedSenders = new Set(roundPool.entries.map((entry) => entry.senderToken));
  const senderCandidates = shuffle(activeDirectRoutine.senderInstances)
    .filter((token) => {
      const instance = instancesByToken.get(token);
      const instanceState = state.instanceStates[token];
      return Boolean(
        instance
        && instanceState?.eligibleNow
        && !isRegeneratingCandidate(instance, instanceState)
        && !alreadyQueuedSenders.has(token)
      );
    });

  const regenerationReceivers = shuffle(activeDirectRoutine.receiverInstances)
    .filter((token) => {
      const instance = instancesByToken.get(token);
      const instanceState = state.instanceStates[token];
      if (!instance || !isRegeneratingCandidate(instance, instanceState)) {
        return false;
      }

      if (!instanceState.nextRegenerationAt) {
        return true;
      }

      return new Date(instanceState.nextRegenerationAt).getTime() <= tickStartedAt.getTime();
    })
    .slice(0, MAX_REGENERATION_ENTRIES_PER_ROUND);

  const entries = [];

  for (let index = 0; index < regenerationReceivers.length; index += 1) {
    const senderToken = senderCandidates[index % senderCandidates.length];
    const receiverToken = regenerationReceivers[index];

    if (!senderToken || !receiverToken || senderToken === receiverToken) {
      continue;
    }

    const entry = createPoolEntry({
      routine: activeDirectRoutine,
      dispatch: { senderToken, receiverToken },
      instancesByToken,
      round,
      tickStartedAt,
      queueType: "regeneration",
      activityLabelOverride: "Auto-Regeneração",
      messageOverride: regenerationMessage,
    });

    if (entry) {
      entries.push(entry);
    }
  }

  return entries;
}

function createPoolEntry({ routine, dispatch, instancesByToken, round, tickStartedAt, queueType = "standard", activityLabelOverride, messageOverride }) {
  const sender = instancesByToken.get(dispatch.senderToken);
  if (!sender) {
    console.warn(`[warmup:pool] Sender not found in instancesByToken: ${dispatch.senderToken}`);
    return null;
  }

  const createdAt = tickStartedAt.toISOString();
  const delayMs = getRandomDelayMs(routine);
  const message = messageOverride ?? pickRoutineMessage(routine, {
    allowGroup: Boolean(dispatch.isGroup),
  });

  if (!message) {
    console.warn(`[warmup:pool] No message available for routine "${routine.name}"`);
    return null;
  }

  if (dispatch.isGroup) {
    return {
      id: crypto.randomUUID(),
      routineId: routine.id,
      routineName: routine.name,
      senderToken: dispatch.senderToken,
      senderName: sender.name,
      receiverToken: dispatch.receiverToken,
      receiverNumber: dispatch.receiverToken,
      activityKind: "group",
      activityLabel: activityLabelOverride ?? normalizeActivityLabel(message.category, "Grupo"),
      messageId: message.id,
      messageText: message.text,
      messageCategory: normalizeActivityLabel(message.category, "Grupo"),
      queueType,
      delayMs,
      trackId: createTrackId(routine.id, round, dispatch.senderToken, dispatch.receiverToken),
      status: "queued",
      createdAt,
      updatedAt: createdAt,
    };
  }

  const receiver = instancesByToken.get(dispatch.receiverToken);
  const receiverState = state.instanceStates[dispatch.receiverToken];
  if (!receiver || !receiverState?.resolvedNumber) {
    console.warn(`[warmup:pool] Receiver not found or no resolved number: ${dispatch.receiverToken} (receiver: ${!!receiver}, resolvedNumber: ${!!receiverState?.resolvedNumber})`);
    return null;
  }

  return {
    id: crypto.randomUUID(),
    routineId: routine.id,
    routineName: routine.name,
    senderToken: dispatch.senderToken,
    senderName: sender.name,
    receiverToken: dispatch.receiverToken,
    receiverName: receiver.name,
    receiverNumber: receiverState.resolvedNumber,
    activityKind: "message",
    activityLabel: activityLabelOverride ?? normalizeActivityLabel(message.category, "Mensagem"),
    messageId: message.id,
    messageText: message.text,
    messageCategory: normalizeActivityLabel(message.category, "Mensagem"),
    queueType,
    delayMs,
    trackId: createTrackId(routine.id, round, dispatch.senderToken, dispatch.receiverToken),
    status: "queued",
    createdAt,
    updatedAt: createdAt,
  };
}

function summarizeRoundSubpools(entries) {
  const buckets = new Map();

  for (const entry of entries) {
    const queueType = entry.queueType ?? "standard";
    const key = `${queueType}:${entry.activityKind}:${entry.activityLabel}`;
    if (!buckets.has(key)) {
      buckets.set(key, {
        key,
        label: entry.activityLabel,
        activityKind: entry.activityKind,
        queueType,
        queuedEntries: 0,
        processedEntries: 0,
        errorEntries: 0,
        senderTokens: new Set(),
      });
    }

    const bucket = buckets.get(key);
    bucket.senderTokens.add(entry.senderToken);

    if (entry.status === "queued") {
      bucket.queuedEntries += 1;
    } else if (entry.status === "error") {
      bucket.errorEntries += 1;
    } else {
      bucket.processedEntries += 1;
    }
  }

  return Array.from(buckets.values())
    .map((bucket) => ({
      ...bucket,
      senderTokens: Array.from(bucket.senderTokens),
    }))
    .sort((left, right) => right.queuedEntries - left.queuedEntries || right.senderTokens.length - left.senderTokens.length);
}

function deriveHeatStage(instanceState, queuedTokens) {
  if (queuedTokens.has(instanceState.instanceToken)) {
    return "queued";
  }

  if (instanceState.eligibleNow) {
    return "eligible";
  }

  const normalizedReason = String(instanceState.eligibilityReason ?? "").toLowerCase();
  if (normalizedReason.includes("auto-regeneração") || normalizedReason.includes("regenera")) {
    return "regenerating";
  }
  if (
    normalizedReason.includes("intervalo mínimo") ||
    normalizedReason.includes("cooldown") ||
    normalizedReason.includes("limite diário")
  ) {
    return "waiting";
  }

  return "blocked";
}

function refreshInstanceHeatProfiles(currentRoundPool) {
  const queuedTokens = new Set(currentRoundPool?.queuedSenders ?? []);

  for (const instanceState of Object.values(state.instanceStates)) {
    const stage = deriveHeatStage(instanceState, queuedTokens);
    instanceState.heatStage = stage;
  }
}

function buildCurrentRoundPool(routines, instancesByToken, round, tickStartedAt) {
  const roundPool = {
    round,
    createdAt: tickStartedAt.toISOString(),
    queuedSenders: [],
    queuedEntries: 0,
    subpools: [],
    entries: [],
  };

  const queuedSenders = new Set();
  console.log(`[warmup:pool] Building round pool for round ${round} with ${routines.length} routines`);

  for (const routine of routines) {
    if (!routine.isActive) {
      console.log(`[warmup:pool] Skipping inactive routine: ${routine.name}`);
      continue;
    }

    console.log(`[warmup:pool] Processing routine: ${routine.name} (active: ${routine.isActive})`);
    const plan = buildDispatchPlan(routine);
    console.log(`[warmup:pool] Dispatch plan size: ${plan.length}`);
    
    let createdEntries = 0;
    let skippedEntries = 0;
    
    for (const dispatch of plan) {
      const entry = createPoolEntry({
        routine,
        dispatch,
        instancesByToken,
        round,
        tickStartedAt,
      });

      if (entry) {
        roundPool.entries.push(entry);
        roundPool.queuedEntries += 1;
        queuedSenders.add(entry.senderToken);
        createdEntries++;
      } else {
        skippedEntries++;
      }
    }
    
    console.log(`[warmup:pool] Routine "${routine.name}" - Created: ${createdEntries}, Skipped: ${skippedEntries}`);
  }
  
  console.log(`[warmup:pool] Round pool complete - Total entries: ${roundPool.entries.length}, Queued senders: ${queuedSenders.size}`);

  const regenerationEntries = buildRegenerationEntries({
    routines,
    instancesByToken,
    round,
    tickStartedAt,
    roundPool,
  });

  for (const entry of regenerationEntries) {
    roundPool.entries.push(entry);
    roundPool.queuedEntries += 1;
    queuedSenders.add(entry.senderToken);
  }

  roundPool.queuedSenders = Array.from(queuedSenders);
  roundPool.subpools = summarizeRoundSubpools(roundPool.entries);
  return roundPool;
}

async function executePoolEntry(entry, instancesByToken, round) {
  const sender = instancesByToken.get(entry.senderToken);
  const senderState = state.instanceStates[entry.senderToken];
  const now = new Date();

  if (!sender || !senderState?.eligibleNow) {
    entry.status = "skipped";
    entry.updatedAt = now.toISOString();
    return { sentCount: 0 };
  }

  const message = state.config.messages.find((candidate) => candidate.id === entry.messageId);
  if (!message) {
    entry.status = "skipped";
    entry.updatedAt = now.toISOString();
    return { sentCount: 0 };
  }

  // Integração com Wallet: Verifica e debita créditos antes de enviar
  const tenantId = senderState.tenantId;
  if (tenantId) {
    try {
      const hasCredits = await walletManager.hasEnoughCredits(tenantId, 1);
      if (!hasCredits) {
        addRuntimeLog({
          type: "wallet",
          status: "error",
          message: `Bloqueio: Tenant ${tenantId} sem saldo para warmup.`,
          instanceName: sender.name,
          originToken: entry.senderToken
        });
        entry.status = "error";
        entry.error = "Saldo insuficiente";
        entry.updatedAt = now.toISOString();
        return { sentCount: 0 };
      }
      
      // Debita o crédito
      await walletManager.deductCredit(tenantId, 1, { 
        type: 'warmup', 
        instanceToken: entry.senderToken,
        trackId: entry.trackId,
        routineId: entry.routineId
      });
    } catch (walletErr) {
      console.error(`[warmup:wallet] Erve ao processar débito para ${tenantId}:`, walletErr.message);
      entry.status = "error";
      entry.error = `Erro Wallet: ${walletErr.message}`;
      entry.updatedAt = now.toISOString();
      return { sentCount: 0 };
    }
  }
  try {
    const receiverNumber = entry.activityKind === "group" ? entry.receiverNumber : state.instanceStates[entry.receiverToken]?.resolvedNumber;

    const presenceType = message.contentType === "audio" ? "recording" : "composing";
    try {
      await sendPresence(entry.senderToken, { number: receiverNumber, presence: presenceType, delay: 1000 });
      await new Promise(r => setTimeout(r, 1500));
    } catch (err) {
      console.error(`[warmup] Erro ao simular presença (${presenceType}) para ${receiverNumber}`);
    }

    if (message.contentType === "audio" && message.audioUrl) {
      await sendAudio(entry.senderToken, {
        number: receiverNumber,
        type: message.audioMode || "ptt",
        file: message.audioUrl,
        delay: entry.delayMs,
        readchat: state.config.settings.warmupReadChat,
        readmessages: state.config.settings.warmupReadMessages,
        track_source: WARMUP_TRACK_SOURCE,
        track_id: entry.trackId,
        async: state.config.settings.warmupAsync,
      });
    } else {
      await sendText(entry.senderToken, {
        number: receiverNumber,
        text: message.text,
        delay: entry.delayMs,
        readchat: state.config.settings.warmupReadChat,
        readmessages: state.config.settings.warmupReadMessages,
        track_source: WARMUP_TRACK_SOURCE,
        track_id: entry.trackId,
        async: state.config.settings.warmupAsync,
      });
    }

    state.instanceStates[entry.senderToken] = markInstanceSent(senderState, round, now);
    if (entry.queueType === "regeneration" && entry.receiverToken && state.instanceStates[entry.receiverToken]) {
      state.instanceStates[entry.receiverToken] = markInstanceRegeneration(state.instanceStates[entry.receiverToken], now);
    }
    sender.lastWarmupAt = now.toISOString();
    entry.status = "sent";
    entry.updatedAt = now.toISOString();

    addRuntimeLog({
      type: "send",
      instanceName: sender.name,
      message: `Warmup [${entry.activityLabel}] enviado para ${entry.receiverName || entry.receiverNumber}`,
      status: "success",
      routineId: entry.routineId,
      routineName: entry.routineName,
      originToken: entry.senderToken,
      destinationNumber: receiverNumber,
      delayMs: entry.delayMs,
      trackId: entry.trackId,
      trackSource: WARMUP_TRACK_SOURCE,
      isAsync: state.config.settings.warmupAsync,
      details: entry.queueType === "regeneration"
        ? `Fila protegida de auto-regeneração · ${message.text}`
        : message.text,
    });

    return { sentCount: 1 };
  } catch (error) {
    entry.status = "error";
    entry.error = error instanceof Error ? error.message : "Erro desconhecido";
    entry.updatedAt = now.toISOString();

    addRuntimeLog({
      type: "error",
      instanceName: sender.name,
      message: `Erro ao enviar warmup: ${entry.error}`,
      status: "error",
      routineId: entry.routineId,
      routineName: entry.routineName,
      originToken: entry.senderToken,
      destinationNumber: entry.receiverNumber,
      delayMs: entry.delayMs,
      trackId: entry.trackId,
      trackSource: WARMUP_TRACK_SOURCE,
      isAsync: state.config.settings.warmupAsync,
      error: entry.error,
    });

    return { sentCount: 0 };
  }
}

async function executeRoundPool(roundPool, instancesByToken, round, maxExecutionsAllowed = MAX_QUEUE_EXECUTIONS_PER_TICK) {
  const groupedQueues = Array.from(
    roundPool.entries.reduce((groups, entry) => {
      const key = `${entry.activityKind}:${entry.activityLabel}`;
      const next = groups.get(key) ?? [];
      next.push(entry);
      groups.set(key, next);
      return groups;
    }, new Map()).values(),
  );

  let sentCount = 0;
  let executedCount = 0;

  const executionLimit = Math.min(MAX_QUEUE_EXECUTIONS_PER_TICK, Math.max(0, maxExecutionsAllowed));

  while (executedCount < executionLimit) {
    if (!state.scheduler.enabled) break;

    let progressed = false;

    for (const queue of groupedQueues) {
      if (!state.scheduler.enabled) break;

      const entry = queue.shift();
      if (!entry) continue;

      const result = await executePoolEntry(entry, instancesByToken, round);
      sentCount += result.sentCount;
      executedCount += 1;
      progressed = true;

      if (executedCount >= executionLimit) break;
    }

    if (!progressed) break;
  }

  roundPool.subpools = summarizeRoundSubpools(roundPool.entries);

  for (const routine of state.config.routines.filter((entry) => entry.isActive)) {
    routine.lastRunAt = roundPool.createdAt;
    routine.totalSent = (routine.totalSent ?? 0) + roundPool.entries.filter((entry) => entry.routineId === routine.id && entry.status === "sent").length;
  }

  return {
    sentCount,
    heatingNow: roundPool.queuedSenders.length,
  };
}

function summarizeEligibilityReasons(instanceStates) {
  const reasonCounts = new Map();

  for (const instanceState of instanceStates) {
    if (instanceState.eligibleNow || !instanceState.eligibilityReason) continue;
    reasonCounts.set(
      instanceState.eligibilityReason,
      (reasonCounts.get(instanceState.eligibilityReason) ?? 0) + 1,
    );
  }

  return Array.from(reasonCounts.entries())
    .sort((left, right) => right[1] - left[1])
    .slice(0, 3)
    .map(([reason, count]) => `${count}x ${reason}`)
    .join(" | ");
}

function buildNoEligibleReason() {
  if (!state.config.routines.length) return "Não há rotinas cadastradas no runtime.";
  if (!state.config.routines.some((routine) => routine.isActive)) return "Há rotinas cadastradas, mas nenhuma está ativa.";
  if (state.summary.totalInstances === 0) return "A UAZAPI não retornou instâncias para o scheduler.";
  if (state.summary.connected === 0) return "Nenhuma instância está conectada no momento.";

  if (state.summary.eligible === 0) {
    const summary = summarizeEligibilityReasons(Object.values(state.instanceStates));
    return summary
      ? `Nenhuma instância passou nas regras locais. Principais bloqueios: ${summary}.`
      : "Nenhuma instância passou nas regras locais de elegibilidade.";
  }

  return "Nenhuma combinação válida de origem e destino foi encontrada nesta rodada.";
}

function buildSnapshot() {
  refreshInstanceHeatProfiles(state.currentPool.currentRound);
  return {
    scheduler: {
      ...state.scheduler,
      tickIntervalMs: TICK_INTERVAL_MS,
      runtimeAvailable: true,
    },
    summary: {
      ...state.summary,
      heatingNow: state.scheduler.enabled ? state.summary.heatingNow : 0,
      queuedEntries: state.scheduler.enabled ? state.summary.queuedEntries : 0,
    },
    currentPool: {
      ...state.currentPool,
      currentRound: state.scheduler.enabled ? state.currentPool.currentRound : undefined,
    },
    activityMeta: {
      windowStartedAt: state.activityWindowResetAt,
      windowVersion: state.activityWindowVersion,
    },
    configMeta: {
      routinesCount: state.config.routines.length,
      messagesCount: state.config.messages.length,
      lastSyncedAt: state.lastSyncedAt,
      warmupMinIntervalMs: state.config.settings.warmupMinIntervalMs,
      warmupMaxDailyPerInstance: state.config.settings.warmupMaxDailyPerInstance,
      warmupCooldownRounds: state.config.settings.warmupCooldownRounds,
      antiBanMaxPerMinute: state.config.settings.antiBanMaxPerMinute,
    },
    recentLogs: state.logs.slice(0, 50),
    instanceStates: Object.values(state.instanceStates),
    auditTrail: state.auditTrail.slice(0, 100),
  };
}

async function tick(reason = "interval") {
  if (tickInFlight) return tickInFlight;
  if (!state.scheduler.enabled) return buildSnapshot();

  tickInFlight = (async () => {
    const tickStartedAt = new Date();
    state.scheduler.status = "active";
    state.scheduler.round += 1;
    state.scheduler.lastTickAt = tickStartedAt.toISOString();
    state.scheduler.lastError = undefined;
    state.summary.isPulsing = true;
    state.scheduler.lastTickAt = tickStartedAt.toISOString();

    try {
      const instances = await fetchAllInstances();
      ensureDefaultRoutine(instances);
      const instancesByToken = new Map(instances.map((i) => [i.token, i]));
      const round = state.scheduler.round;

      await Promise.all(
        instances.map(async (instance) => {
          try {
            const [statusResult, proxyResult] = await Promise.allSettled([
              fetchInstanceStatus(instance.token),
              fetchInstanceProxy(instance.token),
            ]);
            const status = statusResult.status === "fulfilled" ? statusResult.value : null;
            const proxy = proxyResult.status === "fulfilled" ? proxyResult.value : undefined;
            state.instanceStates[instance.token] = normalizeInstanceState({
              currentState: state.instanceStates[instance.token],
              instance,
              round,
              now: tickStartedAt,
              resolvedNumber: extractResolvedNumber(status, instance),
              instanceData: {
                ...instance,
                proxy,
              },
            });
          } catch {
            state.instanceStates[instance.token] = normalizeInstanceState({
              currentState: state.instanceStates[instance.token],
              instance,
              round,
              now: tickStartedAt,
              resolvedNumber: extractResolvedNumber(null, instance),
              instanceData: instance,
            });
          }
        })
      );

      // --- WATCHDOG: Reconexão Proativa ---
      const nowTs = tickStartedAt.getTime();
      const disconnected = instances.filter(i => i.status !== 'connected');
      
      for (const instance of disconnected) {
        const istate = state.instanceStates[instance.token];
        if (!istate) continue;

        // Tenta reconectar se não tentou nos últimos 10 minutos
        const lastAttempt = istate.lastReconnectAttemptAt ? new Date(istate.lastReconnectAttemptAt).getTime() : 0;
        if (nowTs - lastAttempt > 10 * 60 * 1000) {
          console.log(`[Watchdog] Instância ${instance.name || instance.token} desconectada. Tentando reconexão...`);
          istate.lastReconnectAttemptAt = tickStartedAt.toISOString();
          
          connectInstance(instance.token).then(res => {
            if (res) console.log(`[Watchdog] Sucesso ao solicitar reconexão para ${instance.name}`);
          }).catch(() => {});
        }
      }
      // -----------------------------------

      // DNA & Kill Switch (Registro e Monitoramento)
      instances.forEach(instance => {
        const istate = state.instanceStates[instance.token];
        if (!istate) return;

        // Registrar pulso no DNA (Registro longo prazo)
        if (round % 10 === 0) {
          updateInstanceDna(instance.token, {
            type: "pulse",
            heatScore: istate.heatScore,
            status: instance.status,
            sentToday: istate.sentToday
          });
        }

        // Matriz de Risco & Kill Switch (Proteção Ativa)
        // Se a saúde cair abaixo de 30%, ativamos o Kill Switch para esta instância
        if (istate.heatScore < 30 && !istate.eligibilityReason?.includes("KILL SWITCH")) {
          istate.eligibleNow = false;
          istate.eligibilityReason = "RISCO CRÍTICO: KILL SWITCH ATIVADO (<30% Saúde)";

          addRuntimeLog({
            type: "scheduler",
            status: "error",
            message: `KILL SWITCH: Instância ${instance.name || instance.token} pausada por risco crítico de banimento.`,
            instanceName: instance.name,
            originToken: instance.token
          });
        }
      });

      const persistentPool = buildPersistentPool(instances, tickStartedAt);
      const currentRoundPool = buildCurrentRoundPool(
        state.config.routines.filter((r) => r.isActive),
        instancesByToken,
        round,
        tickStartedAt
      );

      state.currentPool = {
        persistent: persistentPool,
        currentRound: currentRoundPool,
      };

      // Cálculo de contenção antiBanMaxPerMinute
      const oneMinuteAgo = new Date(tickStartedAt.getTime() - 60 * 1000);
      const sendsLastMinute = state.logs.filter(l => l.type === 'send' && l.status === 'success' && new Date(l.timestamp) > oneMinuteAgo).length;
      const antiBanLimit = state.config.settings.antiBanMaxPerMinute || 12;
      const allowedThisTick = Math.max(0, antiBanLimit - sendsLastMinute);

      let executionResult = { sentCount: 0, heatingNow: 0 };
      if (currentRoundPool && currentRoundPool.queuedEntries > 0) {
        if (allowedThisTick > 0) {
          executionResult = await executeRoundPool(currentRoundPool, instancesByToken, round, allowedThisTick);
        } else {
          addRuntimeLog({
            type: "scheduler",
            status: "info",
            message: `Contenção Anti-Ban: Limite de ${antiBanLimit} envios/min atingido (${sendsLastMinute} envios recentes). Execução adiada.`
          });
          state.scheduler.lastError = `Contenção Anti-Ban: Teto de ${antiBanLimit}/min alcançado. Aguardando.`;
          executionResult = { sentCount: 0, heatingNow: currentRoundPool.queuedEntries };
        }
      }

      const sentCount = executionResult.sentCount;
      const heatingNow = executionResult.heatingNow;

      state.summary = {
        ...state.summary,
        totalInstances: instances.length,
        connected: instances.filter((i) => i.status === "connected").length,
        eligible: persistentPool.readyTokens.length,
        heatingNow,
        regenerating: Object.values(state.instanceStates).filter((instanceState) => instanceState.heatStage === "regenerating").length,
        persistentPoolSize: persistentPool.healthyTokens.length,
        subpoolCount: currentRoundPool?.subpools.length ?? 0,
        queuedEntries: currentRoundPool?.queuedEntries ?? 0,
        sentToday: Object.values(state.instanceStates).reduce((total, s) => total + s.sentToday, 0),
        recentErrors: state.logs.filter((entry) => entry.status === "error").length,
        activeRoutines: state.config.routines.filter((r) => r.isActive).length,
      };

      // BPM lúdico
      const windowStart = new Date(tickStartedAt.getTime() - 5 * 60 * 1000);
      const recentSends = state.logs.filter(l => l.type === 'send' && l.status === 'success' && new Date(l.timestamp) > windowStart).length;
      state.summary.cadenceBpm = Math.round((recentSends / 5) * 10) / 10 || (state.summary.eligible > 0 ? 0.5 : 0);

      if (sentCount === 0) {
        state.scheduler.lastError = buildNoEligibleReason();
      }

    } catch (error) {
      state.scheduler.status = "error";
      state.scheduler.lastError = error instanceof Error ? error.message : "Erro desconhecido no runtime";
    } finally {
      state.summary.isPulsing = false;
      await saveState();
    }

    return buildSnapshot();
  })().finally(() => {
    tickInFlight = null;
  });

  return tickInFlight;
}

function startLoop() {
  if (tickTimer) return;
  tickTimer = setInterval(() => {
    tick("interval").catch(console.error);
  }, TICK_INTERVAL_MS);
}

function stopLoop() {
  if (!tickTimer) return;
  clearInterval(tickTimer);
  tickTimer = null;
}

if (state.scheduler.enabled) startLoop();

function processWebhookPayload(payload) {
  try {
    const { event, instance, data } = payload;
    if (!event || !instance) return;

    const istate = Object.values(state.instanceStates).find(s => s.instanceName === instance);
    if (!istate) return;

    if (event === "connection.update" && data?.state === "close") {
      const statusCode = data?.statusCode || data?.reason || 500;
      if (statusCode === 401 || statusCode === 403) {
        istate.heatScore = Math.max(0, istate.heatScore - 50);
        istate.eligibilityReason = `Banimento/Deslogado detectado via Webhook (Code ${statusCode})`;
        istate.heatStage = "blocked";
        istate.eligibleNow = false;

        addRuntimeLog({
          type: "scheduler",
          status: "error",
          message: `🚨 ALERTA VERMELHO: Instância ${instance} caiu com erro ${statusCode} (Possível Ban).`,
          instanceName: instance,
          originToken: istate.instanceToken
        });
      }
    }

    if (event === "messages.update" || event === "messages.upsert" || event === "message.receipt") {
      istate.heatScore = Math.min(100, istate.heatScore + 0.5);

      if (istate.heatScore > 50 && istate.heatStage === "blocked") {
        istate.heatStage = "eligible";
        istate.eligibleNow = true;
        istate.eligibilityReason = "Saúde restabelecida via telemetria";
      }

      updateInstanceDna(istate.instanceToken, {
        type: "webhook_receipt",
        summary: `Evento ${event} da rede (Saúde ++)`
      });
    }
  } catch (error) {
    console.error("[warmup-webhook] Erro ao processar payload", error);
  }
}

function buildRuntimeConfigResponse() {
  return {
    settings: buildPublicSettings(state.config.settings),
    runtime: buildRuntimeSecretMeta(state.config.settings),
    routines: state.config.routines,
    messages: state.config.messages,
    lastSyncedAt: state.lastSyncedAt,
    scheduler: {
      enabled: state.scheduler.enabled,
      status: state.scheduler.status,
    },
  };
}

function buildRuntimeSecretMeta(settings = {}) {
  const trimmedToken = String(settings.adminToken ?? "").trim();
  return {
    adminTokenConfigured: Boolean(trimmedToken),
    adminTokenLast4: trimmedToken ? trimmedToken.slice(-4) : undefined,
  };
}

function buildPublicSettings(settings = {}) {
  return {
    ...settings,
    adminToken: "",
  };
}

async function parseBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  if (!chunks.length) return {};
  const raw = Buffer.concat(chunks).toString("utf8");
  return raw ? JSON.parse(raw) : {};
}

function stripRoutePrefix(pathname, prefix) {
  if (!prefix) return pathname;
  if (pathname === prefix) return "/";
  if (pathname.startsWith(`${prefix}/`)) return pathname.slice(prefix.length) || "/";
  return pathname;
}

function normalizeApiPath(pathname) {
  if (pathname.startsWith(`${WARMUP_BASE_PATH}/api/local/`)) {
    return pathname.slice(WARMUP_BASE_PATH.length);
  }
  if (pathname === `${WARMUP_BASE_PATH}/api/local`) {
    return "/api/local";
  }
  return pathname;
}

function injectWarmupManagerButton(html) {
  if (html.includes(WARMUP_MANAGER_BUTTON_MARKER)) return html;
  if (html.includes("</body>")) {
    return html.replace("</body>", `${WARMUP_MANAGER_BUTTON_HTML}\n</body>`);
  }
  return `${html}\n${WARMUP_MANAGER_BUTTON_HTML}`;
}

function getEcosystemPageLabel(pathname = "/") {
  if (pathname.startsWith(WARMUP_BASE_PATH)) return ECOSYSTEM_BRANDING.product.warmupName;
  if (pathname === "/" || pathname === "/app") return ECOSYSTEM_BRANDING.product.frontName;
  if (pathname.startsWith("/dashboard")) return "Dashboard";
  if (pathname.startsWith("/ruptur")) return ECOSYSTEM_BRANDING.product.shortName;
  return ECOSYSTEM_BRANDING.product.shortName;
}

function buildEcosystemBrowserTitle(pathname = "/") {
  const pageLabel = getEcosystemPageLabel(pathname);
  if (pageLabel === ECOSYSTEM_BRANDING.product.shortName) {
    return ECOSYSTEM_BRANDING.browser.defaultTitle;
  }
  return `${ECOSYSTEM_BRANDING.product.shortName} — ${pageLabel}`;
}

function buildEcosystemSupportMessage(pathname = "/") {
  const pageLabel = getEcosystemPageLabel(pathname);
  return `Olá! Vim do módulo ${pageLabel} na página ${pathname || "/"} do projeto ${ECOSYSTEM_BRANDING.product.shortName} e preciso de ajuda.`;
}

function buildEcosystemSupportHref(pathname = "/") {
  return `${ECOSYSTEM_BRANDING.support.whatsappBaseUrl}?text=${encodeURIComponent(buildEcosystemSupportMessage(pathname))}`;
}

function buildEcosystemThemeHeadHtml() {
  return `
  <style data-ecosystem-theme="true">
    html[data-ruptur-theme="light"] {
      color-scheme: light;
      --bg: #f6f8fc;
      --card-bg: rgba(255, 255, 255, 0.9);
      --card-border: rgba(15, 23, 42, 0.12);
      --text: #0f172a;
      --text-muted: #475569;
      --primary-glow: rgba(249, 115, 22, 0.16);
    }

    html[data-ruptur-theme="dark"] {
      color-scheme: dark;
      --background: 222 47% 8%;
      --foreground: 210 40% 98%;
      --card: 224 34% 11%;
      --card-foreground: 210 40% 96%;
      --popover: 224 34% 11%;
      --popover-foreground: 210 40% 96%;
      --secondary: 223 24% 16%;
      --secondary-foreground: 210 40% 96%;
      --muted: 223 24% 16%;
      --muted-foreground: 215 20% 72%;
      --accent: 223 24% 16%;
      --accent-foreground: 210 40% 96%;
      --border: 217 20% 22%;
      --input: 217 20% 22%;
      --sidebar-background: 224 34% 10%;
      --sidebar-foreground: 214 24% 88%;
      --sidebar-accent: 223 24% 16%;
      --sidebar-accent-foreground: 210 40% 96%;
      --sidebar-border: 217 20% 20%;
      --glass-bg: 224 34% 10% / 0.78;
      --glass-border: 215 25% 85% / 0.08;
      --glass-shadow: 222 84% 5% / 0.45;
      --bg: #06070b;
      --card-bg: rgba(15, 23, 42, 0.78);
      --card-border: rgba(148, 163, 184, 0.14);
      --text: #f8fafc;
      --text-muted: #94a3b8;
      --primary-glow: rgba(59, 130, 246, 0.18);
    }

    html[data-ruptur-theme="dark"] body {
      background-color: hsl(var(--background, 222 47% 8%)) !important;
      color: hsl(var(--foreground, 210 40% 98%)) !important;
    }

    html[data-ruptur-theme="dark"] .glass-card,
    html[data-ruptur-theme="dark"] .glass-sidebar,
    html[data-ruptur-theme="dark"] .stat-card {
      box-shadow: 0 24px 80px rgba(2, 6, 23, 0.36);
    }

    html[data-ruptur-theme="light"] body {
      background-color: var(--bg) !important;
      color: var(--text) !important;
    }

    body[data-ecosystem-page="front"] {
      justify-content: flex-start !important;
      padding-top: 88px !important;
    }

    body[data-ecosystem-page="front"] > .container {
      padding-top: 1.5rem !important;
      padding-bottom: 6.5rem !important;
    }

    html[data-ruptur-theme="light"] body > .container > .hero h1 {
      background: linear-gradient(135deg, #0f172a 0%, #334155 58%, #f97316 100%) !important;
      background-clip: text !important;
      -webkit-background-clip: text !important;
      -webkit-text-fill-color: transparent !important;
    }

    html[data-ruptur-theme="light"] body > .container > .hero p,
    html[data-ruptur-theme="light"] body > .container > .grid > .card p,
    html[data-ruptur-theme="light"] body > .container > .grid > .card .risk-row span {
      color: var(--text-muted) !important;
    }

    html[data-ruptur-theme="light"] body > .container > .grid > .card {
      background: var(--card-bg) !important;
      border-color: var(--card-border) !important;
      box-shadow: 0 24px 70px rgba(15, 23, 42, 0.08);
    }

    html[data-ruptur-theme="light"] body > .container > .grid > .card h3,
    html[data-ruptur-theme="light"] body > .container > .grid > .card #risk-value {
      color: var(--text) !important;
    }

    html[data-ruptur-theme="light"] body > .container > .grid > .card .risk-calc {
      background: rgba(248, 250, 252, 0.94) !important;
      border-color: rgba(15, 23, 42, 0.1) !important;
    }

    html[data-ruptur-theme="light"] body > .container > .grid > .card .risk-bar-bg {
      background: #e2e8f0 !important;
    }

    html[data-ruptur-theme="light"] body > .container > .grid > .card .btn-primary {
      background: #0f172a !important;
      color: #f8fafc !important;
    }

    html[data-ruptur-theme="light"] body > .container > .grid > .card .btn-outline {
      background: rgba(255, 247, 237, 0.72) !important;
      border-color: rgba(249, 115, 22, 0.28) !important;
      color: #c2410c !important;
    }
  </style>
  <script data-ecosystem-theme-bootstrap="true">
    (() => {
      try {
        const savedTheme = window.localStorage.getItem("${ECOSYSTEM_THEME_STORAGE_KEY}");
        const nextTheme = savedTheme === "light" || savedTheme === "dark"
          ? savedTheme
          : (window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
        document.documentElement.setAttribute("data-ruptur-theme", nextTheme);
        document.documentElement.style.colorScheme = nextTheme;
      } catch (error) {
        document.documentElement.setAttribute("data-ruptur-theme", "light");
        document.documentElement.style.colorScheme = "light";
      }
    })();
  </script>
  `;
}

function buildEcosystemChromeHtml({ includeWarmupButton = false } = {}) {
  const warmupButtonHtml = includeWarmupButton ? WARMUP_MANAGER_BUTTON_HTML : "";
  const brandingJson = JSON.stringify(ECOSYSTEM_BRANDING);
  return `
  <style>
    .${ECOSYSTEM_THEME_MARKER} {
      position: fixed;
      top: 18px;
      right: 18px;
      z-index: 10000;
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 6px;
      border-radius: 999px;
      border: 1px solid rgba(15, 23, 42, 0.08);
      background: rgba(255, 250, 242, 0.96);
      color: #4b5563;
      box-shadow: 0 16px 36px rgba(15, 23, 42, 0.1);
      backdrop-filter: blur(12px);
      pointer-events: auto;
    }

    .${ECOSYSTEM_THEME_MARKER}[data-has-warmup-button="true"] {
      right: 312px;
    }

    .${ECOSYSTEM_THEME_MARKER} button {
      appearance: none;
      border: 0;
      background: transparent;
      color: inherit;
      display: inline-flex;
      align-items: center;
      gap: 8px;
      padding: 10px 14px;
      border-radius: 999px;
      font: 700 12px/1.2 -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      letter-spacing: 0.01em;
      transition: background 180ms ease, color 180ms ease, transform 180ms ease;
    }

    .${ECOSYSTEM_THEME_MARKER} button:hover {
      transform: translateY(-1px);
      background: rgba(15, 23, 42, 0.06);
    }

    .${ECOSYSTEM_THEME_MARKER} button[data-active="true"] {
      background: linear-gradient(135deg, rgba(15, 23, 42, 0.94), rgba(51, 65, 85, 0.96));
      color: #ffffff;
      box-shadow: 0 12px 30px rgba(15, 23, 42, 0.18);
    }

    .${ECOSYSTEM_THEME_MARKER} button span[aria-hidden="true"] {
      font-size: 14px;
    }

    .${ECOSYSTEM_CHROME_MARKER}-footer {
      position: fixed;
      left: 16px;
      right: 16px;
      bottom: 12px;
      z-index: 9997;
      display: flex;
      justify-content: center;
      pointer-events: none;
    }

    .${ECOSYSTEM_CHROME_MARKER}-footer > div {
      pointer-events: auto;
      display: inline-flex;
      flex-wrap: wrap;
      align-items: center;
      justify-content: center;
      gap: 6px;
      max-width: calc(100vw - 120px);
      padding: 10px 16px;
      border-radius: 999px;
      border: 1px solid rgba(15, 23, 42, 0.08);
      background: rgba(255, 250, 242, 0.96);
      color: #4b5563;
      font: 500 12px/1.35 -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      box-shadow: 0 16px 36px rgba(15, 23, 42, 0.1);
      backdrop-filter: blur(10px);
      text-align: center;
    }

    .${ECOSYSTEM_CHROME_MARKER}-footer a {
      color: #9d4e31;
      font-weight: 700;
      text-decoration: none;
    }

    .${ECOSYSTEM_SUPPORT_MARKER} {
      position: fixed;
      right: 18px;
      bottom: 84px;
      z-index: 9998;
      display: inline-flex;
      align-items: center;
      gap: 10px;
      padding: 14px 16px;
      border-radius: 999px;
      border: 1px solid rgba(37, 211, 102, 0.22);
      background: #25d366;
      color: #ffffff;
      font: 700 14px/1.2 -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      text-decoration: none;
      box-shadow: 0 16px 40px rgba(37, 211, 102, 0.32);
    }

    .${ECOSYSTEM_SUPPORT_MARKER}:hover {
      transform: translateY(-1px);
      filter: brightness(1.04);
    }

    html[data-ruptur-theme="dark"] .${ECOSYSTEM_THEME_MARKER} {
      border-color: rgba(148, 163, 184, 0.16);
      background: rgba(15, 23, 42, 0.88);
      color: #cbd5e1;
      box-shadow: 0 20px 44px rgba(2, 6, 23, 0.42);
    }

    html[data-ruptur-theme="dark"] .${ECOSYSTEM_THEME_MARKER} button:hover {
      background: rgba(148, 163, 184, 0.12);
    }

    html[data-ruptur-theme="dark"] .${ECOSYSTEM_THEME_MARKER} button[data-active="true"] {
      background: linear-gradient(135deg, rgba(34, 197, 94, 0.18), rgba(59, 130, 246, 0.22));
      color: #f8fafc;
      box-shadow: 0 16px 32px rgba(15, 23, 42, 0.34);
    }

    html[data-ruptur-theme="dark"] .${ECOSYSTEM_CHROME_MARKER}-footer > div {
      border-color: rgba(148, 163, 184, 0.16);
      background: rgba(15, 23, 42, 0.92);
      color: #cbd5e1;
      box-shadow: 0 20px 44px rgba(2, 6, 23, 0.42);
    }

    html[data-ruptur-theme="dark"] .${ECOSYSTEM_CHROME_MARKER}-footer a {
      color: #7dd3fc;
    }

    html[data-ruptur-theme="dark"] .${ECOSYSTEM_SUPPORT_MARKER} {
      box-shadow: 0 20px 48px rgba(37, 211, 102, 0.24);
    }

    body {
      padding-bottom: 92px !important;
    }

    @media (max-width: 900px) {
      body[data-ecosystem-page="front"] {
        padding-top: 140px !important;
      }

      .${ECOSYSTEM_THEME_MARKER},
      .${ECOSYSTEM_THEME_MARKER}[data-has-warmup-button="true"] {
        top: 12px;
        right: 12px;
      }

      .${ECOSYSTEM_THEME_MARKER} button {
        padding: 9px 11px;
      }

      .${ECOSYSTEM_THEME_MARKER} button span[data-theme-label="true"] {
        display: none;
      }

      .${ECOSYSTEM_SUPPORT_MARKER} {
        right: 12px;
        bottom: 96px;
        padding: 12px 14px;
      }

      .${ECOSYSTEM_CHROME_MARKER}-footer {
        left: 10px;
        right: 10px;
        bottom: 10px;
      }

      .${ECOSYSTEM_CHROME_MARKER}-footer > div {
        max-width: calc(100vw - 20px);
        font-size: 11px;
      }
    }
  </style>
  ${warmupButtonHtml}
  <div class="${ECOSYSTEM_THEME_MARKER}" data-ecosystem-theme-toggle="true" data-has-warmup-button="${includeWarmupButton ? "true" : "false"}" aria-label="Alternar tema do SaaS">
    <button type="button" data-theme-value="light" aria-pressed="false">
      <span aria-hidden="true">☀️</span>
      <span data-theme-label="true">Light</span>
    </button>
    <button type="button" data-theme-value="dark" aria-pressed="false">
      <span aria-hidden="true">🌙</span>
      <span data-theme-label="true">Dark</span>
    </button>
  </div>
  <a class="${ECOSYSTEM_SUPPORT_MARKER}" data-ecosystem-support="true" href="${buildEcosystemSupportHref("/")}" target="_blank" rel="noopener noreferrer">
    <span>💬</span>
    <span>Precisa de ajuda?</span>
  </a>
  <div class="${ECOSYSTEM_CHROME_MARKER}-footer" data-ecosystem-footer="true">
    <div>
      <span>${ECOSYSTEM_BRANDING.footer.copyrightText}</span>
      <span>•</span>
      <span>${ECOSYSTEM_BRANDING.footer.madeWithText}</span>
      <a href="${ECOSYSTEM_BRANDING.company.instagramUrl}" target="_blank" rel="noopener noreferrer">${ECOSYSTEM_BRANDING.company.name}</a>
    </div>
  </div>
  <script>
    (() => {
      const branding = ${brandingJson};
      const supportLink = document.querySelector('[data-ecosystem-support="true"]');
      const themeToggle = document.querySelector('[data-ecosystem-theme-toggle="true"]');
      const themeButtons = Array.from(document.querySelectorAll('[data-theme-value]'));
      const themeStorageKey = "${ECOSYSTEM_THEME_STORAGE_KEY}";

      function getLabel(pathname) {
        if (pathname.startsWith("${WARMUP_BASE_PATH}")) return branding.product.warmupName;
        if (pathname === "/" || pathname === "/app") return branding.product.frontName;
        if (pathname.startsWith("/dashboard")) return "Dashboard";
        if (pathname.startsWith("/ruptur")) return branding.product.shortName;
        return branding.product.shortName;
      }

      function buildTitle(pathname) {
        const label = getLabel(pathname);
        if (label === branding.product.shortName) return branding.browser.defaultTitle;
        return branding.product.shortName + " — " + label;
      }

      function buildSupportHref(pathname) {
        const label = getLabel(pathname);
        const message = "Olá! Vim do módulo " + label + " na página " + pathname + " do projeto " + branding.product.shortName + " e preciso de ajuda.";
        return branding.support.whatsappBaseUrl + "?text=" + encodeURIComponent(message);
      }

      function getResolvedTheme() {
        const theme = document.documentElement.getAttribute("data-ruptur-theme");
        if (theme === "light" || theme === "dark") return theme;
        return "light";
      }

      function syncThemeButtons() {
        const resolvedTheme = getResolvedTheme();
        themeButtons.forEach((button) => {
          const active = button.getAttribute("data-theme-value") === resolvedTheme;
          button.setAttribute("data-active", active ? "true" : "false");
          button.setAttribute("aria-pressed", active ? "true" : "false");
        });
      }

      function applyTheme(nextTheme) {
        if (nextTheme !== "light" && nextTheme !== "dark") return;
        document.documentElement.setAttribute("data-ruptur-theme", nextTheme);
        document.documentElement.style.colorScheme = nextTheme;
        try {
          window.localStorage.setItem(themeStorageKey, nextTheme);
        } catch (error) {}
        syncThemeButtons();
      }

      function syncChrome() {
        const pathname = window.location.pathname || "/";
        document.title = buildTitle(pathname);

        let description = document.querySelector('meta[name="description"]');
        if (!description) {
          description = document.createElement("meta");
          description.setAttribute("name", "description");
          document.head.appendChild(description);
        }
        description.setAttribute("content", branding.browser.defaultDescription);

        if (supportLink) {
          supportLink.setAttribute("href", buildSupportHref(pathname));
          supportLink.setAttribute("aria-label", "Falar no WhatsApp com contexto da página " + pathname);
        }

        syncThemeButtons();
      }

      const wrapHistory = (method) => {
        const original = history[method];
        history[method] = function (...args) {
          const result = original.apply(this, args);
          window.dispatchEvent(new Event("ecosystem:locationchange"));
          return result;
        };
      };

      wrapHistory("pushState");
      wrapHistory("replaceState");
      window.addEventListener("popstate", () => window.dispatchEvent(new Event("ecosystem:locationchange")));
      window.addEventListener("ecosystem:locationchange", syncChrome);
      if (themeToggle) {
        themeButtons.forEach((button) => {
          button.addEventListener("click", () => applyTheme(button.getAttribute("data-theme-value")));
        });
      }
      syncChrome();
    })();
  </script>
  `;
}

function injectEcosystemChrome(html, options = {}) {
  if (html.includes(ECOSYSTEM_CHROME_MARKER)) return html;
  const themeHeadHtml = buildEcosystemThemeHeadHtml();
  const chromeHtml = buildEcosystemChromeHtml(options);
  let nextHtml = html;
  if (options.includeWarmupButton && !nextHtml.includes("data-ecosystem-page=")) {
    nextHtml = nextHtml.replace(/<body([^>]*)>/i, '<body$1 data-ecosystem-page="front">');
  }
  if (!nextHtml.includes("data-ecosystem-theme=\"true\"")) {
    if (nextHtml.includes("</head>")) {
      nextHtml = nextHtml.replace("</head>", `${themeHeadHtml}\n</head>`);
    } else {
      nextHtml = `${themeHeadHtml}\n${nextHtml}`;
    }
  }
  if (nextHtml.includes("</body>")) {
    return nextHtml.replace("</body>", `${chromeHtml}\n</body>`);
  }
  return `${nextHtml}\n${chromeHtml}`;
}

function injectWarmupManagerSettingsActions(html) {
  if (html.includes(WARMUP_TOKEN_CLEAR_MARKER)) return html;
  if (html.includes("</body>")) {
    return html.replace("</body>", `${WARMUP_MANAGER_SETTINGS_ACTIONS_HTML}\n</body>`);
  }
  return `${html}\n${WARMUP_MANAGER_SETTINGS_ACTIONS_HTML}`;
}


function resetOperationalRuntimeState(reason = "Token do runtime removido manualmente.") {
  stopLoop();

  state.scheduler.enabled = false;
  state.scheduler.status = "paused";
  state.scheduler.lastError = reason;
  state.summary = createDefaultState().summary;
  state.currentPool = createEmptyPoolState();
  state.instanceStates = {};
  state.lastSyncedAt = new Date().toISOString();
}

async function serveFile(res, filePath, { htmlTransform, jsTransform } = {}) {
  const ext = path.extname(filePath).toLowerCase();
  
  // Transformação HTML (Existente)
  if (ext === ".html" && typeof htmlTransform === "function") {
    const html = await readFile(filePath, "utf8");
    res.writeHead(200, {
      "Content-Type": MIME_TYPES[ext] ?? "text/html; charset=utf-8",
      "Access-Control-Allow-Origin": "*",
    });
    res.end(htmlTransform(html));
    return true;
  }

  // Transformação JS (Novo - Runtime Patch)
  if (ext === ".js" && typeof jsTransform === "function") {
    let js = await readFile(filePath, "utf8");
    const originalJs = js;
    js = jsTransform(js);
    
    const patchApplied = js !== originalJs;
    
    res.writeHead(200, {
      "Content-Type": MIME_TYPES[ext] ?? "application/javascript; charset=utf-8",
      "Access-Control-Allow-Origin": "*",
      "X-Ruptur-Patch-Applied": patchApplied ? "true" : "false"
    });
    res.end(js);
    return true;
  }

  res.writeHead(200, {
    "Content-Type": MIME_TYPES[ext] ?? "application/octet-stream",
    "Access-Control-Allow-Origin": "*",
  });
  createReadStream(filePath).pipe(res);
  return true;
}

async function serveStaticFromDir(req, res, { distDir, stripPrefix = "", htmlTransform, jsTransform } = {}) {
  if (!existsSync(distDir)) return false;
  const requestUrl = new URL(req.url ?? "/", `http://${req.headers.host ?? "localhost"}`);
  const pathname = stripRoutePrefix(requestUrl.pathname, stripPrefix);

  if (pathname.startsWith("/api/")) {
    return false;
  }

  const sanitizedPath = path.normalize(decodeURIComponent(pathname)).replace(/^(\.\.[/\\])+/, "").replace(/^[/\\]+/, "");
  let filePath = path.join(distDir, sanitizedPath === "" ? "index.html" : sanitizedPath);

  if (!path.extname(filePath)) filePath = path.join(distDir, "index.html");

  try {
    const fileStat = await stat(filePath);
    if (!fileStat.isFile()) throw new Error("not a file");
    return serveFile(res, filePath, { htmlTransform, jsTransform });
  } catch {
    try {
      const fallbackPath = path.join(distDir, "index.html");
      return serveFile(res, fallbackPath, { htmlTransform, jsTransform });
    } catch { return false; }
  }
}

function resolveManualActor(payload = {}) {
  const actor = String(payload.actor ?? "").trim();
  return actor || "Operador local";
}

// Inbox Route Handler
// Wallet Route Handler
async function handleWalletRoute(req, res, url) {
  try {
    const tenantId = url.searchParams.get('tenantId') || req.headers['x-tenant-id'];
    if (!tenantId) return createResponse(res, 400, { error: 'Tenant ID required' });

    const pathParts = url.pathname.split('/').filter(Boolean);
    
    // GET /api/wallet/balance
    if (pathParts[2] === 'balance' && req.method === 'GET') {
      const balance = await walletManager.getBalance(tenantId);
      return createResponse(res, 200, { balance, tenantId });
    }
    
    // GET /api/wallet/transactions
    if (pathParts[2] === 'transactions' && req.method === 'GET') {
      const transactions = await walletManager.getTransactions(tenantId);
      return createResponse(res, 200, { transactions, tenantId });
    }

    // POST /api/wallet/add-credits (Admin or Internal)
    if (pathParts[2] === 'add-credits' && req.method === 'POST') {
      const body = await parseBody(req);
      const amount = Number(body.amount);
      if (isNaN(amount)) return createResponse(res, 400, { error: 'Invalid amount' });
      
      const newBalance = await walletManager.addCredits(tenantId, amount, body.description);
      return createResponse(res, 200, { balance: newBalance, tenantId });
    }

    createResponse(res, 404, { error: 'Wallet endpoint not found' });
  } catch (error) {
    console.error('[Wallet API] Error:', error.message);
    createResponse(res, 500, { error: error.message });
  }
}

async function handleInboxRoute(req, res, url) {
  try {
    const tenantId = url.searchParams.get('tenantId') || req.headers['x-tenant-id'];
    const pathParts = url.pathname.split('/').filter(Boolean);
    
    // GET /api/inbox/summary
    if (pathParts[2] === 'summary' && req.method === 'GET') {
      if (!tenantId) return createResponse(res, 400, { error: 'Tenant ID required' });
      const summary = await inboxManager.getInboxSummary(tenantId);
      return createResponse(res, 200, summary);
    }
    
    // POST /api/inbox/initialize/:instanceId
    if (pathParts[2] === 'initialize' && req.method === 'POST') {
      const instanceId = pathParts[3];
      if (!tenantId) return createResponse(res, 400, { error: 'Tenant ID required' });
      const success = await inboxManager.initializeInstance(instanceId, tenantId);
      return createResponse(res, 200, { success, instanceId, tenantId });
    }
    
    // GET /api/inbox/messages/:instanceId
    if (pathParts[2] === 'messages' && req.method === 'GET') {
      const instanceId = pathParts[3];
      if (!tenantId) return createResponse(res, 400, { error: 'Tenant ID required' });
      const options = {
        limit: parseInt(url.searchParams.get('limit') || '50'),
        offset: parseInt(url.searchParams.get('offset') || '0'),
        unreadOnly: url.searchParams.get('unreadOnly') === 'true',
        since: url.searchParams.get('since')
      };
      const result = await inboxManager.getMessages(instanceId, tenantId, options);
      return createResponse(res, 200, result);
    }
    
    // PUT /api/inbox/messages/:instanceId/:messageId/read
    if (pathParts[2] === 'messages' && pathParts[4] === 'read' && req.method === 'PUT') {
      const instanceId = pathParts[3];
      const messageId = pathParts[4];
      if (!tenantId) return createResponse(res, 400, { error: 'Tenant ID required' });
      const success = await inboxManager.markAsRead(instanceId, tenantId, messageId);
      return createResponse(res, 200, { success });
    }
    
    // POST /api/inbox/send/:instanceId
    if (pathParts[2] === 'send' && req.method === 'POST') {
      const instanceId = pathParts[3];
      if (!tenantId) return createResponse(res, 400, { error: 'Tenant ID required' });
      const body = await parseBody(req);
      const result = await inboxManager.sendMessage(instanceId, tenantId, body.recipient, body.content, body.type);
      return createResponse(res, 200, result);
    }
    
    createResponse(res, 404, { error: 'Inbox endpoint not found' });
  } catch (error) {
    console.error('[Inbox API] Error:', error.message);
    createResponse(res, 500, { error: error.message });
  }
}

// Campaign Route Handler
async function handleCampaignRoute(req, res, url) {
  try {
    console.log(`[Campaign API] ${req.method} ${url.pathname}`);
    const pathParts = url.pathname.split('/').filter(Boolean);
    console.log(`[Campaign API] Path parts:`, pathParts, `Length: ${pathParts.length}`);
    
    // POST /api/campaigns
    if (pathParts.length === 2 && req.method === 'POST') {
      const body = await parseBody(req);
      const campaign = await campaignManager.createCampaign(body);
      return createResponse(res, 200, campaign);
    }
    
    // GET /api/campaigns
    if (pathParts.length === 2 && req.method === 'GET') {
      const options = {
        status: url.searchParams.get('status'),
        limit: parseInt(url.searchParams.get('limit') || '50'),
        offset: parseInt(url.searchParams.get('offset') || '0')
      };
      const campaigns = await campaignManager.getAllCampaigns(options);
      return createResponse(res, 200, campaigns);
    }
    
    // GET /api/campaigns/:campaignId
    if (pathParts.length === 3 && req.method === 'GET') {
      const campaignId = pathParts[2];
      const tenantId = url.searchParams.get('tenantId') || req.headers['x-tenant-id'];
      const campaign = await campaignManager.getCampaign(campaignId);
      if (!campaign) return createResponse(res, 404, { error: 'Campaign not found' });
      
      // Safety check for tenant
      if (tenantId && campaign.tenantId !== tenantId) {
        return createResponse(res, 403, { error: 'Unauthorized access to campaign' });
      }
      
      return createResponse(res, 200, campaign);
    }
    
    // POST /api/campaigns/:campaignId/launch
    if (pathParts.length === 4 && pathParts[3] === 'launch' && req.method === 'POST') {
      const campaignId = pathParts[2];
      const success = await campaignManager.launchCampaign(campaignId);
      return createResponse(res, 200, { success, campaignId });
    }
    
    // GET /api/campaigns/:campaignId/stats
    if (pathParts.length === 4 && pathParts[3] === 'stats' && req.method === 'GET') {
      const campaignId = pathParts[2];
      const stats = await campaignManager.getCampaignStats(campaignId);
      if (!stats) return createResponse(res, 404, { error: 'Campaign not found' });
      return createResponse(res, 200, stats);
    }
    
    createResponse(res, 404, { error: 'Campaign endpoint not found' });
  } catch (error) {
    console.error('[Campaign API] Error:', error.message);
    createResponse(res, 500, { error: error.message });
  }
}

// Dashboard Route Handler
async function handleDashboardRoute(req, res, url) {
  try {
    const tenantId = url.searchParams.get('tenantId') || req.headers['x-tenant-id'];
    if (!tenantId) return createResponse(res, 400, { error: 'Tenant ID required' });

    const balance = await walletManager.getBalance(tenantId);
    const campaigns = await campaignManager.getAllCampaigns({ tenantId, limit: 100 });
    const inboxSummary = await inboxManager.getInboxSummary(tenantId);

    // Aggregate stats
    const stats = {
      walletBalance: balance,
      activeCampaignsCount: campaigns.campaigns.filter(c => c.status === 'active' || c.status === 'running').length,
      totalCampaigns: campaigns.total,
      connectedInstances: inboxSummary.instances.filter(i => i.connected).length,
      totalInstances: inboxSummary.instances.length,
      sendsToday: campaigns.campaigns.reduce((acc, c) => acc + (c.metrics?.sentCount || 0), 0),
      queueCount: campaignManager.sendingQueue.filter(item => item.campaign.tenantId === tenantId).length
    };

    return createResponse(res, 200, stats);
  } catch (error) {
    console.error('[Dashboard API] Error:', error.message);
    createResponse(res, 500, { error: error.message });
  }
}

await bootstrapProtectedRoutine();

const server = http.createServer(async (req, res) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.headers.host}${req.url}`);
  if (!req.url || !req.method) return createResponse(res, 400, { error: "Requisição inválida" });

  if (req.method === "OPTIONS") {
    res.writeHead(204, {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "Content-Type",
      "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    });
    res.end();
    return;
  }

  const url = new URL(req.url, `http://${req.headers.host ?? "localhost"}`);
  const normalizedPathname = normalizeApiPath(url.pathname);
  const isWarmupPath =
    url.pathname === WARMUP_BASE_PATH || url.pathname.startsWith(`${WARMUP_BASE_PATH}/`);
  try {
    if (normalizedPathname === "/api/local/health") return createResponse(res, 200, { ok: true, port: PORT, scheduler: state.scheduler });
    if (normalizedPathname === "/api/local/app/config") {
      return createResponse(res, 200, {
        settings: buildPublicSettings(state.config.settings),
        runtime: buildRuntimeSecretMeta(state.config.settings),
      });
    }
    if (normalizedPathname === "/api/local/warmup/webhook" && req.method === "POST") {
      const payload = await parseBody(req);
      processWebhookPayload(payload);
      return createResponse(res, 200, { received: true });
    }

    // Inbox API Routes
    if (normalizedPathname.startsWith("/api/inbox/")) {
      return handleInboxRoute(req, res, url);
    }

    // Wallet API Routes
    if (normalizedPathname.startsWith("/api/wallet/")) {
      return handleWalletRoute(req, res, url);
    }

    // Campaigns API Routes
    if (normalizedPathname.startsWith("/api/campaigns")) {
      return handleCampaignRoute(req, res, url);
    }

    // Dashboard API Routes
    if (normalizedPathname.startsWith("/api/dashboard")) {
      return handleDashboardRoute(req, res, url);
    }
    if (normalizedPathname === "/api/local/uazapi/instance/all") {
      if (!state.config.settings.adminToken?.trim()) {
        return createResponse(res, 200, []);
      }
      const instances = await fetchAllInstances();
      return createResponse(res, 200, instances);
    }
    if (normalizedPathname === "/api/local/warmup/state") return createResponse(res, 200, buildSnapshot());
    if (normalizedPathname === "/api/local/warmup/config") {
      if (!state.config.routines.some((routine) => isProtectedRoutine(routine))) {
        const previousRoutines = JSON.stringify(state.config.routines);
        ensureDefaultRoutine([]);
        if (state.config.settings.adminToken?.trim()) {
          try {
            const instances = await fetchAllInstances();
            ensureDefaultRoutine(instances);
          } catch {}
        }
        if (JSON.stringify(state.config.routines) !== previousRoutines) {
          await saveState();
        }
      }
      return createResponse(res, 200, buildRuntimeConfigResponse());
    }
    if (normalizedPathname === "/api/local/warmup/sync") {
      const payload = await parseBody(req);
      const previousSettings = state.config.settings ?? {};
      const nextSettings = mergeRuntimeSettings(state.config.settings, payload.settings ?? {});
      let resolvedInstances = [];
      if (nextSettings.adminToken?.trim()) {
        try {
          resolvedInstances = await fetchAllInstancesForSettings(nextSettings);
        } catch (error) {
          if (isDemoServerValidationError(error)) {
            resolvedInstances = [];
          } else
          if (hasRuntimeCredentialChange(previousSettings, nextSettings)) {
            return createResponse(res, 400, {
              error: error instanceof Error ? error.message : "Falha ao validar admin token na API remota.",
              validation: {
                persisted: false,
                remoteValidated: false,
              },
            });
          }
        }
      } else if (hasRuntimeCredentialChange(previousSettings, nextSettings)) {
        resolvedInstances = [];
      }
      const { routines, createdProtectedRoutine } = reconcileProtectedRoutines({
        currentRoutines: state.config.routines,
        incomingRoutines: Array.isArray(payload.routines) ? payload.routines : [],
        instances: resolvedInstances,
      });
      state.config = {
        settings: nextSettings,
        routines,
        messages: Array.isArray(payload.messages) ? payload.messages : [],
      };
      state.summary.activeRoutines = state.config.routines.filter((routine) => routine.isActive).length;
      if (createdProtectedRoutine) {
        const protectedRoutine = state.config.routines.find((routine) => isProtectedRoutine(routine));
        addRuntimeLog({
          type: "warmup",
          instanceName: "runtime",
          message: "Rotina padrão 24/7 reidratada automaticamente após sincronização",
          status: "info",
          routineId: protectedRoutine?.id,
          routineName: protectedRoutine?.name,
          mode: protectedRoutine?.mode,
        });
      }
      const previousOverride = previousSettings.riskOverride;
      const nextOverride = nextSettings.riskOverride;
      if (nextOverride?.active && nextOverride.fingerprint !== previousOverride?.fingerprint) {
        addAuditEntry({
          type: "risk_override",
          actor: nextOverride.acceptedBy || "Operador não identificado",
          action: "warmup_policy_override_accepted",
          details: nextOverride.reasons?.join(" | "),
        });
        addRuntimeLog({
          type: "scheduler",
          status: "info",
          message: `Override de risco aceito por ${nextOverride.acceptedBy || "operador não identificado"}.`,
          details: nextOverride.reasons?.join(" | "),
          instanceName: "Warmup Runtime",
        });
      }
      if (previousOverride?.active && !nextOverride?.active) {
        addAuditEntry({
          type: "risk_override",
          actor: nextSettings.operatorLabel || "Operador não identificado",
          action: "warmup_policy_override_cleared",
          details: "Configuração voltou para métricas seguras.",
        });
      }
      state.lastSyncedAt = new Date().toISOString();
      await saveState();
      return createResponse(res, 200, buildSnapshot());
    }
    if (normalizedPathname === "/api/local/warmup/clear-token" && req.method === "POST") {
      const payload = await parseBody(req);
      const actor = resolveManualActor(payload);
      state.config.settings = normalizeSettings({
        ...state.config.settings,
        adminToken: "",
      });
      resetOperationalRuntimeState(`Token removido manualmente por ${actor}.`);
      addAuditEntry({
        type: "manual_control",
        actor,
        action: "warmup_clear_admin_token",
        details: payload.reason || "Token ativo removido pela interface",
      });
      addRuntimeLog({
        type: "scheduler",
        status: "info",
        message: `Token do runtime removido manualmente por ${actor}.`,
        details: payload.reason || "Painel operacional zerado pela interface.",
        instanceName: "Warmup Runtime",
      });
      await saveState();
      return createResponse(res, 200, buildRuntimeConfigResponse());
    }
    if (normalizedPathname === "/api/local/warmup/start") {
      const payload = await parseBody(req);
      const actor = resolveManualActor(payload);
      state.scheduler.enabled = true;
      state.scheduler.status = "active";
      state.scheduler.lastManualAction = {
        action: "start",
        actor,
        reason: payload.reason,
        acceptedAt: new Date().toISOString(),
      };
      addAuditEntry({
        type: "manual_control",
        actor,
        action: "warmup_start",
        details: payload.reason || "Execução manual autorizada",
      });
      addRuntimeLog({
        type: "scheduler",
        status: "info",
        message: `Warmup iniciado manualmente por ${actor}.`,
        details: payload.reason || "Execução manual autorizada",
        instanceName: "Warmup Runtime",
      });
      startLoop();
      return createResponse(res, 200, await tick("manual-start"));
    }
    if (normalizedPathname === "/api/local/warmup/pause") {
      const payload = await parseBody(req);
      const actor = resolveManualActor(payload);
      state.scheduler.enabled = false;
      state.scheduler.status = "paused";
      state.scheduler.lastPausedAt = new Date().toISOString();
      state.scheduler.lastError = `Warmup pausado manualmente por ${actor}${payload.reason ? ` · ${payload.reason}` : ""}`;
      state.scheduler.lastManualAction = {
        action: "pause",
        actor,
        reason: payload.reason,
        acceptedAt: new Date().toISOString(),
      };
      addAuditEntry({
        type: "manual_control",
        actor,
        action: "warmup_pause",
        details: payload.reason || "Pausa manual confirmada",
      });
      addRuntimeLog({
        type: "scheduler",
        status: "info",
        message: `Warmup pausado manualmente por ${actor}.`,
        details: payload.reason || "Pausa manual confirmada",
        instanceName: "Warmup Runtime",
      });
      stopLoop();
      clearWarmingFlags();
      await saveState();
      return createResponse(res, 200, buildSnapshot());
    }
    if (normalizedPathname === "/api/local/warmup/stop") {
      const payload = await parseBody(req);
      const actor = resolveManualActor(payload);
      state.scheduler.enabled = false;
      state.scheduler.status = "stopped";
      state.scheduler.lastError = `Warmup parado manualmente por ${actor}${payload.reason ? ` · ${payload.reason}` : ""}`;
      state.scheduler.lastManualAction = {
        action: "stop",
        actor,
        reason: payload.reason,
        acceptedAt: new Date().toISOString(),
      };
      addAuditEntry({
        type: "manual_control",
        actor,
        action: "warmup_stop",
        details: payload.reason || "Parada manual confirmada",
      });
      addRuntimeLog({
        type: "scheduler",
        status: "info",
        message: `Warmup parado manualmente por ${actor}.`,
        details: payload.reason || "Parada manual confirmada",
        instanceName: "Warmup Runtime",
      });
      stopLoop();
      clearWarmingFlags();
      await saveState();
      return createResponse(res, 200, buildSnapshot());
    }
    if (normalizedPathname === "/api/local/warmup/restart") {
      const payload = await parseBody(req);
      const actor = resolveManualActor(payload);
      state.scheduler.enabled = true;
      state.scheduler.status = "active";
      state.scheduler.lastManualAction = {
        action: "restart",
        actor,
        reason: payload.reason,
        acceptedAt: new Date().toISOString(),
      };
      addAuditEntry({
        type: "manual_control",
        actor,
        action: "warmup_restart",
        details: payload.reason || "Reinício manual solicitado",
      });
      addRuntimeLog({
        type: "scheduler",
        status: "info",
        message: `Warmup reiniciado manualmente por ${actor}.`,
        details: payload.reason || "Reinício manual solicitado",
        instanceName: "Warmup Runtime",
      });
      clearWarmingFlags();
      startLoop();
      return createResponse(res, 200, await tick("manual-restart"));
    }
    if (normalizedPathname === "/api/local/warmup/tick") return createResponse(res, 200, await tick("manual"));

    // Dark theme version of warmup manager
    if (url.pathname === `${WARMUP_BASE_PATH}/dark` || url.pathname.startsWith(`${WARMUP_BASE_PATH}/dark/`)) {
      const darkIndexPath = path.join(MANAGER_DIST_DIR, 'index-dark.html');
      try {
        const darkHtml = await readFile(darkIndexPath, 'utf8');
        const transformedHtml = injectEcosystemChrome(injectWarmupManagerSettingsActions(darkHtml));
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(transformedHtml);
        return;
      } catch (error) {
        console.error('[Warmup] Error serving dark theme:', error.message);
      }
    }

    if (url.pathname === WARMUP_BASE_PATH || url.pathname.startsWith(`${WARMUP_BASE_PATH}/`)) {
      if (await serveStaticFromDir(req, res, {
        distDir: MANAGER_DIST_DIR,
        stripPrefix: WARMUP_BASE_PATH,
        htmlTransform: (html) => injectEcosystemChrome(injectWarmupManagerSettingsActions(html)),
      })) return;
    }

    if (url.pathname === WARMUP_BASE_PATH || url.pathname.startsWith(`${WARMUP_BASE_PATH}/`)) {
      if (await serveStaticFromDir(req, res, {
        distDir: MANAGER_DIST_DIR,
        stripPrefix: WARMUP_BASE_PATH,
        htmlTransform: (html) => injectEcosystemChrome(injectWarmupManagerSettingsActions(html)),
      })) return;
    }

    // Roteamento Triplo para Front Principal (Landing Page) e Dashboard (Legado)
    const reqHost = (req.headers.host || "").toLowerCase();

    if (reqHost.includes("site.ruptur") || reqHost.includes("aquecimento.ruptur")) {
      const served = await serveStaticFromDir(req, res, {
        distDir: DASHBOARD_DIST_DIR,
      });
      if (served) return;
    } else {
      if (!isWarmupPath || url.pathname === "/") {
        const served = await serveStaticFromDir(req, res, {
          distDir: FRONT_DIST_DIR,
          htmlTransform: (html) => injectEcosystemChrome(html, { includeWarmupButton: true }),
        });
        if (served) return;
      }
    }

    createResponse(res, 404, { error: "Não encontrado" });
  } catch (err) {
    createResponse(res, 500, { error: err.message });
  }
});

// Watchdog: Garante que o motor continue batendo (Self-Healing)
setInterval(() => {
  const lastTick = state.scheduler.lastTickAt ? new Date(state.scheduler.lastTickAt) : null;
  const now = new Date();
  const maxSilenseMs = TICK_INTERVAL_MS * 2.5;

  if (state.scheduler.enabled && state.scheduler.status === "error") {
    console.warn("[warmup-watchdog] Runtime em erro. Disparando recuperação automática...");
    addAuditEntry({
      type: "auto_recovery",
      actor: "watchdog",
      action: "warmup_error_recovery",
      details: state.scheduler.lastError || "Erro não informado",
    });
    addRuntimeLog({
      type: "scheduler",
      status: "info",
      message: "WATCHDOG: recuperação automática acionada após erro do runtime.",
      details: state.scheduler.lastError,
      instanceName: "Warmup Runtime",
    });
    tick("watchdog-error-recovery");
    return;
  }

  if (state.scheduler.enabled && lastTick && (now - lastTick > maxSilenseMs)) {
    console.warn(`[warmup-watchdog] Detectada inatividade suspeita (> ${maxSilenseMs}ms). Forçando pulso de recuperação...`);
    addAuditEntry({
      type: "auto_recovery",
      actor: "watchdog",
      action: "warmup_inactivity_recovery",
      details: `Inatividade acima de ${maxSilenseMs}ms`,
    });
    addRuntimeLog({
      type: "scheduler",
      status: "info",
      message: "WATCHDOG: Reiniciando motor rítmico após inatividade detectada."
    });
    tick(); // Force restart pulse
  }
}, TICK_INTERVAL_MS * 2);

server.listen(PORT, HOST, () => console.log(`[warmup-runtime] listening on http://${HOST}:${PORT}`));
