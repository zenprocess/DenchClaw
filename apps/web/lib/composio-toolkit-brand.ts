import type { ComposioToolkit } from "@/lib/composio";
import {
  normalizeComposioToolkitName,
  normalizeComposioToolkitSlug,
  resolveComposioConnectToolkitSlug,
} from "@/lib/composio-normalization";

const KNOWN_TOOLKIT_LOGOS: Record<string, string> = {
  stripe: "/integrations/stripe-logomark.svg",
};

export function resolveComposioToolkitLogo(
  logo: string | null | undefined,
  slug?: string | null,
): string | null {
  if (typeof logo === "string" && logo.trim().length > 0) {
    return logo.trim();
  }
  if (!slug || slug.trim().length === 0) {
    return null;
  }
  return KNOWN_TOOLKIT_LOGOS[normalizeComposioToolkitSlug(slug)] ?? null;
}

export function createComposioToolkitPlaceholder(
  slug: string,
  name?: string | null,
): ComposioToolkit {
  const normalizedSlug = normalizeComposioToolkitSlug(slug);
  const fallbackName = normalizeComposioToolkitName(undefined, normalizedSlug);
  return {
    slug: normalizedSlug,
    connect_slug: resolveComposioConnectToolkitSlug(normalizedSlug),
    name: typeof name === "string" && name.trim().length > 0
      ? name.trim()
      : fallbackName.includes("-")
        ? fallbackName.split("-").map((token) => token.charAt(0).toUpperCase() + token.slice(1)).join(" ")
        : fallbackName.charAt(0).toUpperCase() + fallbackName.slice(1),
    description: "",
    logo: resolveComposioToolkitLogo(null, normalizedSlug),
    categories: [],
    auth_schemes: [],
    tools_count: 0,
  };
}

export function pickComposioToolkitMatch(
  toolkits: ComposioToolkit[],
  slug: string,
  name?: string | null,
): ComposioToolkit | null {
  const normalizedSlug = normalizeComposioToolkitSlug(slug);
  const normalizedName = name?.trim().toLowerCase() ?? "";
  return toolkits.find((toolkit) =>
    normalizeComposioToolkitSlug(toolkit.slug) === normalizedSlug
    || (normalizedName.length > 0 && toolkit.name.trim().toLowerCase() === normalizedName)
  ) ?? null;
}
