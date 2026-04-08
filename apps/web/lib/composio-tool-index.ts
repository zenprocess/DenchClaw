import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  fetchComposioConnections,
  fetchComposioMcpToolsList,
  resolveComposioApiKey,
  resolveComposioEligibility,
  resolveComposioGatewayUrl,
  type ComposioMcpTool,
  type NormalizedComposioConnection,
} from "@/lib/composio";
import { resolveOpenClawStateDir, resolveWorkspaceRoot } from "@/lib/workspace";
import {
  extractComposioConnections,
  normalizeComposioConnections,
  normalizeComposioToolkitSlug,
} from "@/lib/composio-client";

export type ComposioToolSummary = {
  name: string;
  title: string;
  description_short: string;
  required_args: string[];
  arg_hints: Record<string, string>;
  default_args?: Record<string, unknown>;
  example_args?: Record<string, unknown>;
  example_prompts?: string[];
  input_schema?: ComposioMcpTool["inputSchema"];
};

export type ComposioManagedAccount = {
  connected_account_id: string;
  account_identity: string;
  account_identity_source: "gateway_stable_id" | "legacy_heuristic" | "connection_id";
  identity_confidence: "high" | "low" | "unknown";
  display_label: string;
  account_label?: string | null;
  account_name?: string | null;
  account_email?: string | null;
  external_account_id?: string | null;
  related_connection_ids: string[];
  is_same_account_reconnect: boolean;
};

/** Mirrors `extensions/dench-identity/composio-cheat-sheet.ts`. */
export type ComposioToolIndex = {
  generated_at: string;
  managed_tools: string[];
  connected_apps: Array<{
    toolkit_slug: string;
    toolkit_name: string;
    account_count: number;
    accounts: ComposioManagedAccount[];
    tools: ComposioToolSummary[];
    recipes: Record<string, string>;
  }>;
};

export type ComposioToolCatalogCache = {
  generated_at: string;
  connected_apps: Array<{
    toolkit_slug: string;
    toolkit_name: string;
    tools: ComposioToolSummary[];
  }>;
};

const COMPOSIO_MANAGED_TOOLS = [
  "composio_search_tools",
  "composio_resolve_tool",
  "composio_call_tool",
] as const;

const DEFAULT_FEATURED_TOOLS_PER_APP = 10;
const FEATURED_TOOLS_PER_APP_OVERRIDES: Record<string, number> = {
  github: 24,
  "google-calendar": 16,
  stripe: 12,
};
const MAX_FEATURED_TOOLS_TOTAL = 100;

type ToolRoutingPreset = {
  tool: string;
  default_args?: Record<string, unknown>;
  example_args?: Record<string, unknown>;
  example_prompts?: string[];
};

/** Intent label → canonical MCP tool metadata (must exist in catalog for that app). */
const RECIPES_BY_SLUG: Record<string, Record<string, ToolRoutingPreset>> = {
  gmail: {
    "Read recent emails": {
      tool: "GMAIL_FETCH_EMAILS",
      default_args: { label_ids: ["INBOX"], max_results: 10 },
      example_args: { label_ids: ["INBOX"], max_results: 10 },
      example_prompts: ["check my recent emails", "show my inbox", "read recent mail"],
    },
    "Read one email": {
      tool: "GMAIL_FETCH_MESSAGE_BY_MESSAGE_ID",
      example_prompts: ["open this email", "read one message"],
    },
    "Send email": {
      tool: "GMAIL_SEND_EMAIL",
      example_prompts: ["send an email", "draft an email reply"],
    },
  },
  slack: {
    "Send message": {
      tool: "SLACK_SEND_MESSAGE",
      example_prompts: ["send a Slack message", "post in Slack"],
    },
    "List channels": {
      tool: "SLACK_LIST_CONVERSATIONS",
      example_prompts: ["list Slack channels", "show Slack conversations"],
    },
    "Post to channel": {
      tool: "SLACK_SEND_MESSAGE",
      example_prompts: ["post to a Slack channel"],
    },
  },
  github: {
    "List repos": {
      tool: "GITHUB_LIST_REPOSITORIES_FOR_THE_AUTHENTICATED_USER",
      example_prompts: ["list my GitHub repositories", "show my repos"],
    },
    "Find pull requests": {
      tool: "GITHUB_FIND_PULL_REQUESTS",
      example_prompts: [
        "check my recent PRs",
        "show my recent pull requests",
        "find open pull requests",
      ],
    },
    "List repo pull requests": {
      tool: "GITHUB_LIST_PULL_REQUESTS",
      example_prompts: [
        "list pull requests in this repo",
        "show PRs for this repository",
      ],
    },
    "Get pull request": {
      tool: "GITHUB_GET_A_PULL_REQUEST",
      example_prompts: [
        "show me this pull request",
        "get pull request details",
      ],
    },
    "Get repo": {
      tool: "GITHUB_GET_A_REPOSITORY",
      example_prompts: ["inspect this repository", "get repo metadata"],
    },
    "Create issue": {
      tool: "GITHUB_CREATE_AN_ISSUE",
      example_prompts: ["create a GitHub issue", "open an issue"],
    },
  },
  notion: {
    "Search pages": {
      tool: "NOTION_SEARCH",
      example_prompts: ["search Notion", "find a Notion page"],
    },
    "Create page": {
      tool: "NOTION_CREATE_PAGE",
      example_prompts: ["create a Notion page"],
    },
    "Get page": {
      tool: "NOTION_GET_PAGE",
      example_prompts: ["open this Notion page", "get a Notion page"],
    },
  },
  "google-calendar": {
    "Upcoming events": {
      tool: "GOOGLE_CALENDAR_EVENTS_LIST",
      example_prompts: [
        "what's upcoming on my calendar",
        "show upcoming calendar events",
      ],
    },
    "List events": {
      tool: "GOOGLE_CALENDAR_EVENTS_LIST",
      example_prompts: ["show my calendar events", "list upcoming meetings"],
    },
    "Find event": {
      tool: "GOOGLE_CALENDAR_EVENTS_LIST",
      example_prompts: [
        "find my event tomorrow",
        "search for a calendar event",
      ],
    },
    "Create event": {
      tool: "GOOGLE_CALENDAR_CREATE_EVENT",
      example_prompts: ["schedule a meeting", "create a calendar event"],
    },
    "Get calendar list": {
      tool: "GOOGLE_CALENDAR_CALENDAR_LIST",
      example_prompts: ["list my calendars"],
    },
  },
  linear: {
    "List issues": {
      tool: "LINEAR_LIST_ISSUES",
      example_prompts: ["list Linear issues", "show open Linear tickets"],
    },
    "Create issue": {
      tool: "LINEAR_CREATE_ISSUE",
      example_prompts: ["create a Linear issue"],
    },
    "Get issue": {
      tool: "LINEAR_GET_ISSUE",
      example_prompts: ["open this Linear issue", "get a Linear ticket"],
    },
  },
  stripe: {
    "List subscriptions": {
      tool: "STRIPE_LIST_SUBSCRIPTIONS",
      example_prompts: [
        "list all subscriptions",
        "show subscriptions with trial info",
        "calculate recurring revenue from Stripe subscriptions",
      ],
    },
    "Search subscriptions": {
      tool: "STRIPE_SEARCH_SUBSCRIPTIONS",
      example_prompts: [
        "search Stripe subscriptions",
        "find subscriptions for a customer",
      ],
    },
    "List customers": {
      tool: "STRIPE_LIST_CUSTOMERS",
      example_prompts: ["list Stripe customers", "show Stripe customers"],
    },
    "List invoices": {
      tool: "STRIPE_LIST_INVOICES",
      example_prompts: ["list Stripe invoices", "show unpaid invoices"],
    },
    "List charges": {
      tool: "STRIPE_LIST_CHARGES",
      example_prompts: ["list Stripe charges", "show recent charges"],
    },
    "Retrieve balance": {
      tool: "STRIPE_RETRIEVE_BALANCE",
      example_prompts: ["show Stripe balance", "retrieve account balance"],
    },
  },
};

function toolkitSlugToToolPrefix(slug: string): string {
  return normalizeComposioToolkitSlug(slug).toUpperCase().replace(/-/g, "_") + "_";
}

function firstSentence(text: string): string {
  const t = text.trim();
  if (!t) {
    return "";
  }
  const parts = t.split(/(?<=[.!?])\s+/);
  const cut = parts[0];
  return cut ?? t.slice(0, 160);
}

function asObjectRecord(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

function extractRequiredArgs(schema: ComposioMcpTool["inputSchema"]): string[] {
  if (!schema || schema.type !== "object" || !Array.isArray(schema.required)) {
    return [];
  }
  return schema.required.filter(
    (x): x is string => typeof x === "string" && x.trim().length > 0,
  );
}

function buildArgHints(toolName: string, schema: ComposioMcpTool["inputSchema"]): Record<string, string> {
  const hints: Record<string, string> = {};
  const props = schema && schema.type === "object" ? schema.properties : undefined;
  if (!props) {
    return hints;
  }

  const upper = toolName.toUpperCase();

  if (upper.includes("GMAIL") && props.label_ids) {
    hints.label_ids = 'Must be an array of label IDs, e.g. ["INBOX"] — not a string.';
  }
  if (upper.includes("GMAIL") && props.max_results) {
    hints.max_results = "Integer (e.g. 10).";
  }

  if (upper.includes("SLACK") && props.channel) {
    hints.channel = "Channel ID (starts with C) or name per tool docs.";
  }

  if (upper.includes("GOOGLE_CALENDAR") && props.time_min) {
    hints.time_min = "RFC3339 datetime string.";
  }
  if (upper.includes("GOOGLE_CALENDAR") && props.time_max) {
    hints.time_max = "RFC3339 datetime string.";
  }
  if (upper.includes("GOOGLE_CALENDAR") && props.calendar_id) {
    hints.calendar_id = "Calendar identifier. Use the calendar list tool first if you need to pick one.";
  }
  if (upper.includes("GOOGLE_CALENDAR") && props.query) {
    hints.query = "Search text for matching events, if the tool supports it.";
  }

  if (upper.includes("GITHUB") && props.owner) {
    hints.owner = "Repository owner or organization login.";
  }
  if (upper.includes("GITHUB") && props.repo) {
    hints.repo = "Repository name without the .git suffix.";
  }
  if (upper.includes("GITHUB") && props.pull_number) {
    hints.pull_number = "Numeric pull request number.";
  }
  if (upper.includes("GITHUB") && props.state) {
    hints.state = "Use values like OPEN, CLOSED, or ALL when supported by the tool schema.";
  }

  for (const [key, val] of Object.entries(props)) {
    const p = asObjectRecord(val);
    if (!p) {
      continue;
    }
    if (p.type === "array" && !hints[key]) {
      hints[key] = "Must be a JSON array, not a comma-separated string.";
    }
  }

  return hints;
}

function toolSortKey(tool: ComposioMcpTool, preferredNames: Set<string>): [number, number, string] {
  const preferred = preferredNames.has(tool.name) ? 0 : 1;
  const readOnly = tool.annotations?.readOnlyHint === true ? 0 : 1;
  return [preferred, readOnly, tool.name.toLowerCase()];
}

const INDEX_PRIORITY_TERMS: Record<string, string[]> = {
  github: [
    "pull request",
    "pull requests",
    "find pull requests",
    "list pull requests",
    "get a pull request",
    "search issues and pull requests",
    "repositories for the authenticated user",
  ],
  "google-calendar": [
    "events list",
    "upcoming",
    "event",
    "calendar list",
    "create event",
  ],
  stripe: [
    "subscription",
    "subscriptions",
    "customer",
    "customers",
    "invoice",
    "invoices",
    "charge",
    "charges",
    "balance",
    "billing",
    "trial",
    "arr",
    "price",
    "product",
    "coupon",
    "plan",
  ],
};

function scoreToolPriority(slug: string, tool: ComposioMcpTool): number {
  const priorityTerms = INDEX_PRIORITY_TERMS[normalizeComposioToolkitSlug(slug)] ?? [];
  if (priorityTerms.length === 0) {
    return 0;
  }
  const haystack = [
    tool.name,
    tool.title,
    tool.description,
  ].filter(Boolean).join(" ").toLowerCase();
  return priorityTerms.reduce(
    (score, term) => score + (haystack.includes(term) ? 1 : 0),
    0,
  );
}

function topToolsPerApp(slug: string): number {
  return FEATURED_TOOLS_PER_APP_OVERRIDES[normalizeComposioToolkitSlug(slug)] ?? DEFAULT_FEATURED_TOOLS_PER_APP;
}

function buildRecipesForToolkit(
  slug: string,
  availableNames: Set<string>,
): Record<string, string> {
  const recipes = RECIPES_BY_SLUG[normalizeComposioToolkitSlug(slug)] ?? {};
  const out: Record<string, string> = {};
  for (const [intent, preset] of Object.entries(recipes)) {
    if (availableNames.has(preset.tool)) {
      out[intent] = preset.tool;
    }
  }
  return out;
}

function buildRoutingPresetsForToolkit(slug: string): Map<string, ToolRoutingPreset> {
  const recipes = RECIPES_BY_SLUG[normalizeComposioToolkitSlug(slug)] ?? {};
  const presets = new Map<string, ToolRoutingPreset>();
  for (const preset of Object.values(recipes)) {
    const existing = presets.get(preset.tool);
    if (existing) {
      presets.set(preset.tool, {
        ...existing,
        default_args: existing.default_args ?? preset.default_args,
        example_args: existing.example_args ?? preset.example_args,
        example_prompts: [
          ...(existing.example_prompts ?? []),
          ...(preset.example_prompts ?? []),
        ],
      });
      continue;
    }
    presets.set(preset.tool, {
      tool: preset.tool,
      ...(preset.default_args ? { default_args: preset.default_args } : {}),
      ...(preset.example_args ? { example_args: preset.example_args } : {}),
      ...(preset.example_prompts ? { example_prompts: [...preset.example_prompts] } : {}),
    });
  }
  return presets;
}

function selectIndexedTools(params: {
  slug: string;
  sortedTools: ComposioMcpTool[];
  recipeToolNames: Set<string>;
}): ComposioMcpTool[] {
  const maxTools = topToolsPerApp(params.slug);
  const selected: ComposioMcpTool[] = [];
  const seen = new Set<string>();

  for (const tool of params.sortedTools) {
    if (!params.recipeToolNames.has(tool.name) || seen.has(tool.name)) {
      continue;
    }
    selected.push(tool);
    seen.add(tool.name);
  }

  for (const tool of params.sortedTools) {
    if (selected.length >= maxTools && !params.recipeToolNames.has(tool.name)) {
      break;
    }
    if (seen.has(tool.name)) {
      continue;
    }
    selected.push(tool);
    seen.add(tool.name);
  }

  return selected;
}

function trimIndexedAppsToBudget(
  connectedApps: ComposioToolIndex["connected_apps"],
): ComposioToolIndex["connected_apps"] {
  const protectedToolsBySlug = new Map<string, Set<string>>();
  const remainingOptionalBySlug = new Map<string, typeof connectedApps[number]["tools"]>();
  const trimmed = connectedApps.map((app) => {
    const protectedTools = new Set(Object.values(app.recipes));
    protectedToolsBySlug.set(app.toolkit_slug, protectedTools);
    const required = app.tools.filter((tool) => protectedTools.has(tool.name));
    remainingOptionalBySlug.set(
      app.toolkit_slug,
      app.tools.filter((tool) => !protectedTools.has(tool.name)),
    );
    return {
      ...app,
      tools: [...required],
    };
  });

  let remainingBudget = MAX_FEATURED_TOOLS_TOTAL - trimmed.reduce(
    (count, app) => count + app.tools.length,
    0,
  );

  if (remainingBudget <= 0) {
    return trimmed;
  }

  let added = true;
  while (remainingBudget > 0 && added) {
    added = false;
    for (const app of trimmed) {
      if (remainingBudget <= 0) {
        break;
      }
      const queue = remainingOptionalBySlug.get(app.toolkit_slug) ?? [];
      const next = queue.shift();
      if (!next) {
        continue;
      }
      app.tools.push(next);
      remainingBudget -= 1;
      added = true;
    }
  }

  return trimmed;
}

function summarizeTool(
  tool: ComposioMcpTool,
  routingPresets: Map<string, ToolRoutingPreset>,
): ComposioToolSummary {
  const schema = tool.inputSchema;
  const title =
    tool.title?.trim() ||
    tool.annotations?.title?.trim() ||
    tool.name.replace(/^([A-Z0-9]+_)+/i, "").replace(/_/g, " ") ||
    tool.name;
  const desc = tool.description?.trim() ?? "";
  const preset = routingPresets.get(tool.name);
  return {
    name: tool.name,
    title,
    description_short: firstSentence(desc),
    required_args: extractRequiredArgs(schema),
    arg_hints: buildArgHints(tool.name, schema),
    ...(preset?.default_args ? { default_args: preset.default_args } : {}),
    ...(preset?.example_args ? { example_args: preset.example_args } : {}),
    ...(preset?.example_prompts ? { example_prompts: preset.example_prompts } : {}),
    ...(schema ? { input_schema: schema } : {}),
  };
}

function buildManagedAccounts(connections: NormalizedComposioConnection[]): ComposioManagedAccount[] {
  const byIdentity = new Map<string, ComposioManagedAccount>();
  for (const connection of connections) {
    const existing = byIdentity.get(connection.account_identity);
    if (existing) {
      existing.related_connection_ids = Array.from(
        new Set([
          ...existing.related_connection_ids,
          ...connection.related_connection_ids,
          connection.id,
        ]),
      ).sort();
      if (!existing.account_email && connection.account_email) {
        existing.account_email = connection.account_email;
      }
      if (!existing.account_name && connection.account_name) {
        existing.account_name = connection.account_name;
      }
      if (!existing.account_label && connection.account_label) {
        existing.account_label = connection.account_label;
      }
      if (!existing.external_account_id && connection.external_account_id) {
        existing.external_account_id = connection.external_account_id;
      }
      continue;
    }

    byIdentity.set(connection.account_identity, {
      connected_account_id: connection.id,
      account_identity: connection.account_identity,
      account_identity_source: connection.account_identity_source,
      identity_confidence: connection.identity_confidence,
      display_label: connection.display_label,
      account_label: connection.account_label ?? null,
      account_name: connection.account_name ?? null,
      account_email: connection.account_email ?? null,
      external_account_id: connection.external_account_id ?? null,
      related_connection_ids: Array.from(
        new Set([...connection.related_connection_ids, connection.id]),
      ).sort(),
      is_same_account_reconnect: connection.is_same_account_reconnect,
    });
  }

  return Array.from(byIdentity.values()).sort((left, right) =>
    left.display_label.localeCompare(right.display_label),
  );
}

function readExistingComposioToolIndex(workspaceDir: string): ComposioToolIndex | null {
  const filePath = join(workspaceDir, "composio-tool-index.json");
  if (!existsSync(filePath)) {
    return null;
  }
  try {
    return JSON.parse(readFileSync(filePath, "utf-8")) as ComposioToolIndex;
  } catch {
    return null;
  }
}

function writeCatalogCache(workspaceDir: string, cache: ComposioToolCatalogCache): void {
  const outPath = join(workspaceDir, "composio-tool-catalog.json");
  writeFileSync(outPath, JSON.stringify(cache, null, 2) + "\n", "utf-8");
}

function extractManagedToolPrefixes(index: ComposioToolIndex | null): Set<string> {
  const prefixes = new Set<string>();
  if (!index) {
    return prefixes;
  }
  for (const app of index.connected_apps) {
    prefixes.add(toolkitSlugToToolPrefix(app.toolkit_slug));
  }
  return prefixes;
}

function isManagedComposioToolName(name: string, prefixes: Set<string>): boolean {
  if (COMPOSIO_MANAGED_TOOLS.includes(name as typeof COMPOSIO_MANAGED_TOOLS[number])) {
    return true;
  }
  const upper = name.trim().toUpperCase();
  if (!upper) {
    return false;
  }
  for (const prefix of prefixes) {
    if (upper.startsWith(prefix)) {
      return true;
    }
  }
  return false;
}

function readConfig(): Record<string, unknown> {
  const configPath = join(resolveOpenClawStateDir(), "openclaw.json");
  if (!existsSync(configPath)) {
    return {};
  }
  try {
    return (JSON.parse(readFileSync(configPath, "utf-8")) as Record<string, unknown>) ?? {};
  } catch {
    return {};
  }
}

function writeConfig(config: Record<string, unknown>): void {
  const configPath = join(resolveOpenClawStateDir(), "openclaw.json");
  writeFileSync(configPath, JSON.stringify(config, null, 2) + "\n", "utf-8");
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

function readStringList(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter((item): item is string => typeof item === "string" && item.trim().length > 0);
}

function ensureRecord(parent: Record<string, unknown>, key: string): Record<string, unknown> {
  const existing = asRecord(parent[key]);
  if (existing) {
    return existing;
  }
  const fresh: Record<string, unknown> = {};
  parent[key] = fresh;
  return fresh;
}

function syncAllowedComposioTools(index: ComposioToolIndex, previousIndex: ComposioToolIndex | null): void {
  const config = readConfig();
  const tools = ensureRecord(config, "tools");

  // OpenClaw 2026.4+ treats `tools.allow` as a strict whitelist (only listed
  // tools are available). Composio tools must go into `tools.alsoAllow` so
  // they are added *on top of* the profile (e.g. "full") instead of replacing
  // core tools like exec/read/write/filesystem.
  // Migrate any stale `tools.allow` entries into `alsoAllow` to fix sessions
  // that were broken by the semantics change.
  const legacyAllow = readStringList(tools.allow);
  const previousManagedPrefixes = extractManagedToolPrefixes(previousIndex);
  const currentManagedPrefixes = extractManagedToolPrefixes(index);
  const managedPrefixes = new Set([...previousManagedPrefixes, ...currentManagedPrefixes]);
  const preserved = new Set(
    [...readStringList(tools.alsoAllow), ...legacyAllow].filter((name) =>
      !isManagedComposioToolName(name, managedPrefixes)
    ),
  );

  delete tools.allow;

  for (const name of index.managed_tools) {
    preserved.add(name);
  }

  tools.alsoAllow = Array.from(preserved).sort((left, right) => left.localeCompare(right));
  writeConfig(config);
}

export type BuildComposioToolIndexParams = {
  workspaceDir: string;
  gatewayUrl: string;
  apiKey: string;
};

export type RebuildComposioToolIndexResult =
  | {
      ok: true;
      workspaceDir: string;
      generated_at: string;
      connected_apps: number;
    }
  | { ok: false; reason: string };

/**
 * Fetches active connections and MCP tools, builds a compact index, writes
 * `<workspaceDir>/composio-tool-index.json`, and returns the in-memory index.
 */
export async function buildComposioToolIndex(
  params: BuildComposioToolIndexParams,
): Promise<ComposioToolIndex> {
  const { workspaceDir, gatewayUrl, apiKey } = params;

  const connectionsRes = await fetchComposioConnections(gatewayUrl, apiKey);
  const connections = normalizeComposioConnections(extractComposioConnections(connectionsRes));
  const active = connections.filter((c) => c.is_active);
  const connectedToolkits = [...new Set(active.map((connection) => connection.normalized_toolkit_slug))];
  const preferredToolNames = [...new Set(connectedToolkits.flatMap((slug) =>
    Object.values(RECIPES_BY_SLUG[normalizeComposioToolkitSlug(slug)] ?? {}).map((preset) => preset.tool),
  ))];
  const allTools = connectedToolkits.length > 0
    ? await fetchComposioMcpToolsList(gatewayUrl, apiKey, {
      connectedToolkits,
      preferredToolNames,
    })
    : [];
  const bySlug = new Map<string, {
    toolkit_name: string;
    connections: NormalizedComposioConnection[];
  }>();

  for (const c of active) {
    const slug = c.normalized_toolkit_slug;
    const existing = bySlug.get(slug);
    if (existing) {
      existing.connections.push(c);
    } else {
      bySlug.set(slug, {
        toolkit_name: c.toolkit_name?.trim() || slug,
        connections: [c],
      });
    }
  }

  const connected_apps: ComposioToolIndex["connected_apps"] = [];
  const catalog_connected_apps: ComposioToolCatalogCache["connected_apps"] = [];

  for (const [slug, meta] of [...bySlug.entries()].toSorted((a, b) =>
    a[0].localeCompare(b[0]),
  )) {
    const prefix = toolkitSlugToToolPrefix(slug);
    const forToolkit = allTools.filter((t) => t.name.startsWith(prefix));
    const availableNames = new Set(forToolkit.map((t) => t.name));
    const recipes = buildRecipesForToolkit(slug, availableNames);
    const routingPresets = buildRoutingPresetsForToolkit(slug);
    const preferredNames = new Set(routingPresets.keys());

    const sorted = [...forToolkit].toSorted((a, b) => {
      const ka = toolSortKey(a, preferredNames);
      const kb = toolSortKey(b, preferredNames);
      if (ka[0] !== kb[0]) {
        return ka[0] - kb[0];
      }
      const priorityDiff = scoreToolPriority(slug, b) - scoreToolPriority(slug, a);
      if (priorityDiff !== 0) {
        return priorityDiff;
      }
      if (ka[1] !== kb[1]) {
        return ka[1] - kb[1];
      }
      return ka[2].localeCompare(kb[2]);
    });

    const selectedTools = selectIndexedTools({
      slug,
      sortedTools: sorted,
      recipeToolNames: new Set(Object.values(recipes)),
    });
    const accounts = buildManagedAccounts(meta.connections);
    const catalogTools = sorted.map((tool) => summarizeTool(tool, routingPresets));
    const tools = selectedTools.map((tool) => summarizeTool(tool, routingPresets));

    connected_apps.push({
      toolkit_slug: slug,
      toolkit_name: meta.toolkit_name,
      account_count: accounts.length,
      accounts,
      tools,
      recipes,
    });
    catalog_connected_apps.push({
      toolkit_slug: slug,
      toolkit_name: meta.toolkit_name,
      tools: catalogTools,
    });
  }

  const generated_at = new Date().toISOString();
  const index: ComposioToolIndex = {
    generated_at,
    managed_tools: [...COMPOSIO_MANAGED_TOOLS],
    connected_apps: trimIndexedAppsToBudget(connected_apps),
  };
  const catalogCache: ComposioToolCatalogCache = {
    generated_at,
    connected_apps: catalog_connected_apps,
  };

  const outPath = join(workspaceDir, "composio-tool-index.json");
  writeFileSync(outPath, JSON.stringify(index, null, 2) + "\n", "utf-8");
  writeCatalogCache(workspaceDir, catalogCache);

  return index;
}

/**
 * Rebuild the index using local openclaw config + active workspace (same rules
 * as POST /api/composio/tool-index). Used from OAuth callback, disconnect, etc.
 */
export async function rebuildComposioToolIndexIfReady(): Promise<RebuildComposioToolIndexResult> {
  const apiKey = resolveComposioApiKey();
  if (!apiKey) {
    return { ok: false, reason: "Dench Cloud API key is required." };
  }

  const eligibility = resolveComposioEligibility();
  if (!eligibility.eligible) {
    return {
      ok: false,
      reason: "Dench Cloud must be the primary provider.",
    };
  }

  const workspaceDir = resolveWorkspaceRoot();
  if (!workspaceDir) {
    return {
      ok: false,
      reason: "Workspace root not found. Set OPENCLAW_WORKSPACE or open a workspace in the UI.",
    };
  }

  try {
    const previousIndex = readExistingComposioToolIndex(workspaceDir);
    const index = await buildComposioToolIndex({
      workspaceDir,
      gatewayUrl: resolveComposioGatewayUrl(),
      apiKey,
    });
    syncAllowedComposioTools(index, previousIndex);
    return {
      ok: true,
      workspaceDir,
      generated_at: index.generated_at,
      connected_apps: index.connected_apps.length,
    };
  } catch (err) {
    return {
      ok: false,
      reason: err instanceof Error ? err.message : "Failed to rebuild tool index.",
    };
  }
}
