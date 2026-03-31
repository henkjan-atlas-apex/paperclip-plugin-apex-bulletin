import { definePlugin, runWorker } from "@paperclipai/plugin-sdk";
import type {
  PluginContext,
  PluginJobContext,
  ScopeKey,
  ToolResult,
  ToolRunContext,
} from "@paperclipai/plugin-sdk";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type EntryType = "DECISION" | "FINDING" | "RISK" | "ACTION" | "DATA" | "ANNOUNCEMENT";

interface BoardEntry {
  id: string;
  type: EntryType;
  title: string;
  summary: string;
  context?: string;
  impact?: string;
  nextAction?: string;
  agentRole?: string;
  companyId: string;
  postedAt: string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MAX_ENTRIES = 500;
const VALID_TYPES: EntryType[] = ["DECISION", "FINDING", "RISK", "ACTION", "DATA", "ANNOUNCEMENT"];

const STATE_KEY: ScopeKey = {
  scopeKind: "instance",
  stateKey: "entries",
};

// ---------------------------------------------------------------------------
// State helpers
// ---------------------------------------------------------------------------

async function loadEntries(ctx: PluginContext): Promise<BoardEntry[]> {
  try {
    const raw = await ctx.state.get(STATE_KEY);
    if (!raw) return [];
    return JSON.parse(raw as string) as BoardEntry[];
  } catch {
    return [];
  }
}

async function saveEntries(ctx: PluginContext, entries: BoardEntry[]): Promise<void> {
  await ctx.state.set(STATE_KEY, JSON.stringify(entries));
}

// ---------------------------------------------------------------------------
// ID generation
// ---------------------------------------------------------------------------

function generateId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

// ---------------------------------------------------------------------------
// Tool: board_post
// ---------------------------------------------------------------------------

async function boardPost(
  params: unknown,
  runCtx: ToolRunContext,
  ctx: PluginContext,
): Promise<ToolResult> {
  const p = params as {
    type: EntryType;
    title: string;
    summary: string;
    context?: string;
    impact?: string;
    nextAction?: string;
    agentRole?: string;
  };

  const { type, title, summary, context, impact, nextAction, agentRole } = p;

  if (!VALID_TYPES.includes(type)) {
    return { error: `Invalid type "${type as string}". Must be one of: ${VALID_TYPES.join(", ")}` };
  }
  if (!title?.trim()) return { error: "title is required" };
  if (!summary?.trim()) return { error: "summary is required" };

  const entry: BoardEntry = {
    id: generateId(),
    type,
    title: title.trim().slice(0, 120),
    summary: summary.trim(),
    ...(context ? { context } : {}),
    ...(impact ? { impact } : {}),
    ...(nextAction ? { nextAction } : {}),
    ...(agentRole ? { agentRole } : {}),
    companyId: runCtx.companyId ?? "",
    postedAt: new Date().toISOString(),
  };

  const entries = await loadEntries(ctx);
  entries.unshift(entry);
  if (entries.length > MAX_ENTRIES) entries.splice(MAX_ENTRIES);
  await saveEntries(ctx, entries);

  ctx.logger.info(`Bulletin board entry posted: [${type}] ${title}`);

  const lines: string[] = [
    `Posted to bulletin board.`,
    `[${entry.type}] ${entry.title}`,
    entry.summary,
  ];
  if (entry.context) lines.push(`Context: ${entry.context}`);
  if (entry.impact) lines.push(`Impact: ${entry.impact}`);
  if (entry.nextAction) lines.push(`Next action: ${entry.nextAction}`);

  return { content: lines.join("\n") };
}

// ---------------------------------------------------------------------------
// Tool: board_get
// ---------------------------------------------------------------------------

async function boardGet(params: unknown, ctx: PluginContext): Promise<ToolResult> {
  const p = params as { limit?: number; type?: EntryType };
  const limit = Math.min(Number(p.limit) || 20, 100);
  const typeFilter = p.type;

  const entries = await loadEntries(ctx);
  const filtered = typeFilter ? entries.filter((e) => e.type === typeFilter) : entries;
  const page = filtered.slice(0, limit);

  if (page.length === 0) {
    return { content: "Bulletin board is empty.", data: [] };
  }

  const lines = page.map((e) => {
    const parts = [`[${e.type}] ${e.title} — ${e.postedAt.slice(0, 10)}`];
    if (e.agentRole) parts.push(`  Posted by: ${e.agentRole}`);
    if (e.context) parts.push(`  Context: ${e.context}`);
    parts.push(`  ${e.summary}`);
    if (e.impact) parts.push(`  Impact: ${e.impact}`);
    if (e.nextAction) parts.push(`  Next: ${e.nextAction}`);
    return parts.join("\n");
  });

  return {
    content:
      `${page.length} bulletin board entr${page.length === 1 ? "y" : "ies"}` +
      `${typeFilter ? ` (type: ${typeFilter})` : ""}:\n\n${lines.join("\n\n")}`,
    data: page,
  };
}

// ---------------------------------------------------------------------------
// Weekly digest job handler
// ---------------------------------------------------------------------------

async function weeklyDigest(
  _job: PluginJobContext,
  ctx: PluginContext,
): Promise<void> {
  const entries = await loadEntries(ctx);
  const oneWeekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const recent = entries.filter((e) => new Date(e.postedAt).getTime() > oneWeekAgo);

  const counts: Record<EntryType, number> = {
    DECISION: 0,
    FINDING: 0,
    RISK: 0,
    ACTION: 0,
    DATA: 0,
    ANNOUNCEMENT: 0,
  };
  for (const e of recent) counts[e.type]++;

  const summary = Object.entries(counts)
    .filter(([, n]) => n > 0)
    .map(([t, n]) => `${t}: ${n}`)
    .join(", ");

  ctx.logger.info(
    `Weekly digest — ${recent.length} entries this week. ${summary || "None."}`,
  );
}

// ---------------------------------------------------------------------------
// Plugin definition
// ---------------------------------------------------------------------------

const plugin = definePlugin({
  async setup(ctx: PluginContext) {
    // Ensure state key exists on first boot
    const existing = await ctx.state.get(STATE_KEY);
    if (!existing) {
      await ctx.state.set(STATE_KEY, JSON.stringify([]));
    }

    // Register tool: board_post
    ctx.tools.register(
      "board_post",
      {
        displayName: "Post to Bulletin Board",
        description:
          "Post a structured entry to the APEX bulletin board. Call this after completing any " +
          "task that produces a significant decision, finding, risk, action, or data output.",
        parametersSchema: {
          type: "object",
          required: ["type", "title", "summary"],
          properties: {
            type: {
              type: "string",
              enum: ["DECISION", "FINDING", "RISK", "ACTION", "DATA", "ANNOUNCEMENT"],
              description:
                "Entry type: DECISION=strategic choice made, FINDING=research/analysis result, " +
                "RISK=identified risk needing visibility, ACTION=committed next step, DATA=new asset or dataset produced, " +
                "ANNOUNCEMENT=broadcast message to all agents and users.",
            },
            title: { type: "string", description: "Short title (max 120 chars)." },
            summary: { type: "string", description: "1-3 sentences summarising the entry." },
            context: { type: "string", description: "Optional. Issue or task reference (e.g. ATL-12)." },
            impact: { type: "string", description: "Optional. Who or what this affects." },
            nextAction: { type: "string", description: "Optional. What should happen next." },
            agentRole: {
              type: "string",
              description: "Optional. Your role (e.g. CMO, CEO). Defaults to the calling agent's role.",
            },
          },
        },
      },
      async (params: unknown, runCtx: ToolRunContext): Promise<ToolResult> => {
        return boardPost(params, runCtx, ctx);
      },
    );

    // Register tool: board_get
    ctx.tools.register(
      "board_get",
      {
        displayName: "Read Bulletin Board",
        description:
          "Retrieve recent entries from the APEX bulletin board. Use to get a quick overview " +
          "of recent decisions, findings, and actions before starting a task.",
        parametersSchema: {
          type: "object",
          required: [],
          properties: {
            limit: { type: "number", description: "Max entries to return (default 20, max 100)." },
            type: {
              type: "string",
              enum: ["DECISION", "FINDING", "RISK", "ACTION", "DATA", "ANNOUNCEMENT"],
              description: "Optional. Filter by entry type.",
            },
          },
        },
      },
      async (params: unknown, _runCtx: ToolRunContext): Promise<ToolResult> => {
        return boardGet(params, ctx);
      },
    );

    // Register data handler: "entries" — backs usePluginData("entries") in UI
    ctx.data.register("entries", async (_params) => {
      return loadEntries(ctx);
    });

    // Register scheduled job: weekly-digest
    ctx.jobs.register("weekly-digest", async (job: PluginJobContext) => {
      await weeklyDigest(job, ctx);
    });

    ctx.logger.info("APEX Bulletin Board plugin ready");
  },
});

export default plugin;
runWorker(plugin, import.meta.url);
