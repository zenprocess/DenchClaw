import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { resolveOpenClawStateDir } from "@/lib/workspace";
import { readIndex, writeIndex } from "../../shared";
import {
  type DenchCloudCatalogModel,
  DEFAULT_DENCH_CLOUD_GATEWAY_URL,
  normalizeDenchGatewayUrl,
  fetchDenchCloudCatalog,
  readConfiguredDenchCloudSettings,
} from "../../../../../src/cli/dench-cloud";

export const dynamic = "force-dynamic";

type CompletionEndpoint = {
  baseUrl: string;
  apiKey: string;
  model: string;
};

type UnknownRecord = Record<string, unknown>;

function asRecord(value: unknown): UnknownRecord | undefined {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as UnknownRecord)
    : undefined;
}

const KNOWN_PROVIDER_BASE_URLS: Record<string, string> = {
  openai: "https://api.openai.com/v1",
};

// Cached cheapest Dench Cloud model to avoid re-fetching the catalog on every call.
let cachedCheapestModel: { model: DenchCloudCatalogModel; expiresAt: number } | null = null;
const CACHE_TTL_MS = 5 * 60 * 1000;

async function resolveCheapestDenchModel(
  gatewayUrl: string,
): Promise<DenchCloudCatalogModel | null> {
  if (cachedCheapestModel && Date.now() < cachedCheapestModel.expiresAt) {
    return cachedCheapestModel.model;
  }
  try {
    const catalog = await fetchDenchCloudCatalog(gatewayUrl);
    if (!catalog.models.length) return null;
    const sorted = [...catalog.models].sort(
      (a, b) => (a.cost.input + a.cost.output) - (b.cost.input + b.cost.output),
    );
    cachedCheapestModel = { model: sorted[0], expiresAt: Date.now() + CACHE_TTL_MS };
    return sorted[0];
  } catch {
    return null;
  }
}

function readOpenClawConfig(): UnknownRecord {
  const configPath = join(resolveOpenClawStateDir(), "openclaw.json");
  if (!existsSync(configPath)) return {};
  try {
    return (JSON.parse(readFileSync(configPath, "utf-8")) as UnknownRecord) ?? {};
  } catch {
    return {};
  }
}

function resolveDenchApiKey(config: UnknownRecord): string | null {
  const models = asRecord(config.models);
  const provider = asRecord(asRecord(models?.providers)?.["dench-cloud"]);
  const configKey =
    typeof provider?.apiKey === "string" && provider.apiKey.trim()
      ? provider.apiKey.trim()
      : null;
  if (configKey) return configKey;
  if (process.env.DENCH_CLOUD_API_KEY?.trim()) return process.env.DENCH_CLOUD_API_KEY.trim();
  if (process.env.DENCH_API_KEY?.trim()) return process.env.DENCH_API_KEY.trim();
  return null;
}

function resolveGatewayUrl(config: UnknownRecord): string {
  const settings = readConfiguredDenchCloudSettings(config);
  return settings.gatewayUrl ?? normalizeDenchGatewayUrl(
    process.env.DENCH_GATEWAY_URL?.trim() ?? DEFAULT_DENCH_CLOUD_GATEWAY_URL,
  );
}

/**
 * Resolve an OpenAI-compatible completion endpoint from available config.
 * Tier 1: Dench Cloud gateway with cheapest catalog model.
 * Tier 2: User's configured primary model provider.
 * Tier 3: null (no provider available).
 */
async function resolveCompletionEndpoint(): Promise<CompletionEndpoint | null> {
  const config = readOpenClawConfig();

  // Tier 1: Dench Cloud
  const denchKey = resolveDenchApiKey(config);
  if (denchKey) {
    const gatewayUrl = resolveGatewayUrl(config);
    const cheapest = await resolveCheapestDenchModel(gatewayUrl);
    if (cheapest) {
      return {
        baseUrl: `${gatewayUrl}/v1`,
        apiKey: denchKey,
        model: cheapest.stableId,
      };
    }
  }

  // Tier 2: User's configured primary model provider
  const agents = asRecord(config.agents);
  const defaults = asRecord(agents?.defaults);
  const modelValue = defaults?.model;
  const primaryModel =
    typeof modelValue === "string"
      ? modelValue.trim()
      : typeof asRecord(modelValue)?.primary === "string"
        ? (asRecord(modelValue)!.primary as string).trim()
        : null;

  if (primaryModel && primaryModel.includes("/")) {
    const slashIdx = primaryModel.indexOf("/");
    const providerName = primaryModel.slice(0, slashIdx);
    const modelId = primaryModel.slice(slashIdx + 1);

    const models = asRecord(config.models);
    const providers = asRecord(models?.providers);
    const provider = asRecord(providers?.[providerName]);

    if (provider) {
      const apiKey =
        typeof provider.apiKey === "string" && provider.apiKey.trim()
          ? provider.apiKey.trim()
          : null;
      if (apiKey) {
        const rawBaseUrl =
          typeof provider.baseUrl === "string" && provider.baseUrl.trim()
            ? provider.baseUrl.trim()
            : KNOWN_PROVIDER_BASE_URLS[providerName] ?? null;
        if (rawBaseUrl) {
          const baseUrl = rawBaseUrl.replace(/\/+$/, "");
          return { baseUrl, apiKey, model: modelId };
        }
      }
    }
  }

  return null;
}

const SYSTEM_PROMPT_INITIAL =
  "Generate a concise 3-6 word title for this conversation. Return ONLY the title text, no quotes, no punctuation at the end.";

const SYSTEM_PROMPT_REEVAL =
  "You are reviewing a chat session title. The current title is shown below. Based on the latest messages, return a better title if the conversation topic has shifted significantly. If the current title is still appropriate, return it unchanged. Return ONLY the title text, no quotes, no punctuation at the end.";

async function generateTitle(
  endpoint: CompletionEndpoint,
  messages: string[],
  currentTitle?: string,
): Promise<string | null> {
  const isReeval = Boolean(currentTitle);
  const systemPrompt = isReeval
    ? `${SYSTEM_PROMPT_REEVAL}\n\nCurrent title: ${currentTitle}`
    : SYSTEM_PROMPT_INITIAL;

  const userContent = messages
    .map((m, i) => (messages.length > 1 ? `Message ${i + 1}: ${m}` : m))
    .join("\n\n");

  try {
    const response = await fetch(`${endpoint.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${endpoint.apiKey}`,
      },
      body: JSON.stringify({
        model: endpoint.model,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userContent },
        ],
        max_tokens: 30,
        temperature: 0,
      }),
      signal: AbortSignal.timeout(15_000),
    });

    if (!response.ok) return null;

    const data = await response.json();
    const rawTitle = data?.choices?.[0]?.message?.content?.trim();
    if (typeof rawTitle !== "string" || !rawTitle) return null;

    return rawTitle.replace(/^["']+|["']+$/g, "").replace(/\.+$/, "").trim() || null;
  } catch {
    return null;
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  let body: { messages?: string[]; currentTitle?: string };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!Array.isArray(body.messages) || body.messages.length === 0) {
    return Response.json({ error: "messages array required" }, { status: 400 });
  }

  const endpoint = await resolveCompletionEndpoint();
  if (!endpoint) {
    return Response.json({ title: null, changed: false });
  }

  // For re-evaluation, auto-read the current title from the session index
  // so the client doesn't need to pass it explicitly.
  let currentTitle = body.currentTitle;
  const sessions = readIndex();
  const session = sessions.find((s) => s.id === id);
  if (!currentTitle && session && body.messages.length > 1) {
    currentTitle = session.title;
  }

  const newTitle = await generateTitle(endpoint, body.messages, currentTitle);
  if (!newTitle) {
    return Response.json({ title: null, changed: false });
  }

  try {
    if (session && session.title !== newTitle) {
      session.title = newTitle;
      session.updatedAt = Date.now();
      writeIndex(sessions);
      return Response.json({ title: newTitle, changed: true });
    }
  } catch {
    // Index update is best-effort
  }

  return Response.json({ title: newTitle, changed: false });
}
