# Design: Native Composio (BYOC) + Multi-User RBAC

**Branch**: `feat/native-composio-multiuser-rbac`  
**Repo**: `DenchClaw-fork` (pnpm monorepo, Next.js 15 App Router)  
**Status**: Architecture specification — no code changed yet

---

## Part A: Native Composio (BYOC)

### Problem

All Composio traffic is hard-wired through the Dench Cloud gateway at
`https://gateway.merseoriginals.com`. Six injection points enforce this routing:

| # | File | Symbol | What it does wrong |
|---|------|---------|--------------------|
| 1 | `extensions/dench-ai-gateway/composio-bridge.ts:174` | `stripRuntimeComposioServer()` | **CRITICAL BLOCKER** — unconditionally deletes `api.config.mcp.servers.composio` before the bridge runs; any native composio MCP the user configures in openclaw.json is silently wiped |
| 2 | `extensions/dench-ai-gateway/composio-bridge.ts:59` | `resolveApiKey()` | Returns only `readDenchAuthProfileKey()`; never reads `COMPOSIO_API_KEY` env |
| 3 | `extensions/dench-ai-gateway/composio-bridge.ts:86` | `createDenchExecuteIntegrationsTool` fetch | Posts to `${gatewayBaseUrl}/v1/composio/tools/execute` with `Authorization: Bearer` header |
| 4 | `apps/web/lib/composio.ts:7` | `DEFAULT_GATEWAY_URL` | Hardcoded to `https://gateway.merseoriginals.com` |
| 5 | `apps/web/lib/composio.ts` | `resolveComposioEligibility()` | Requires Dench key AND `primaryModel.startsWith("dench-cloud/")` |
| 6 | `src/cli/dench-cloud.ts:1` | `DEFAULT_DENCH_CLOUD_GATEWAY_URL` | Same gateway default; `buildComposioMcpServerConfig()` builds wrong URL/headers |

### Native Composio API facts

- **REST base**: `https://backend.composio.dev`
- **MCP URL**: `https://mcp.composio.dev/{COMPOSIO_API_KEY}` (key is IN the URL)
- **Auth header**: `x-composio-api-key: {key}` — NOT `Authorization: Bearer`
- **Env var name**: `COMPOSIO_API_KEY`

### Fix strategy: env-var bypass gate

Introduce a single function `resolveComposioMode()` that returns `"native"` when
`COMPOSIO_API_KEY` is set, and `"dench-cloud"` when only `DENCH_CLOUD_API_KEY` is set.
This is the single source of truth used by every injection point.

```typescript
// apps/web/lib/composio-mode.ts  (NEW FILE)
export type ComposioMode = "native" | "dench-cloud" | "none";

export function resolveComposioMode(): ComposioMode {
  if (process.env.COMPOSIO_API_KEY?.trim()) return "native";
  if (
    process.env.DENCH_CLOUD_API_KEY?.trim() ||
    process.env.DENCH_API_KEY?.trim()
  )
    return "dench-cloud";
  return "none";
}

export function resolveComposioApiKey(): string | undefined {
  if (process.env.COMPOSIO_API_KEY?.trim())
    return process.env.COMPOSIO_API_KEY.trim();
  return (
    process.env.DENCH_CLOUD_API_KEY?.trim() ||
    process.env.DENCH_API_KEY?.trim() ||
    undefined
  );
}

export function resolveComposioBaseUrl(): string {
  if (resolveComposioMode() === "native")
    return process.env.COMPOSIO_BASE_URL?.trim() ?? "https://backend.composio.dev";
  return (
    process.env.DENCH_GATEWAY_URL?.trim() ?? "https://gateway.merseoriginals.com"
  );
}

export function buildComposioMcpConfig(key: string): {
  url: string;
  headers: Record<string, string>;
} {
  const mode = resolveComposioMode();
  if (mode === "native") {
    return {
      url: `https://mcp.composio.dev/${key}`,
      headers: { "x-composio-api-key": key },
    };
  }
  return {
    url: `${resolveComposioBaseUrl()}/v1/composio/mcp`,
    headers: { Authorization: `Bearer ${key}` },
  };
}
```

### File-by-file changes (Part A)

#### 1. `extensions/dench-ai-gateway/composio-bridge.ts`

The extension runs inside the OpenClaw desktop agent process (not in Next.js), so it
cannot import `apps/web/`. It has its own copy of the mode logic.

**Change `resolveApiKey()` (line 59)**:
```typescript
// BEFORE
function resolveApiKey(): string | undefined {
  return readDenchAuthProfileKey() ?? undefined;
}

// AFTER
function resolveApiKey(): string | undefined {
  return (
    process.env.COMPOSIO_API_KEY?.trim() ||
    readDenchAuthProfileKey() ||
    undefined
  );
}
```

**Change `stripRuntimeComposioServer()` call (line 188)**:
```typescript
// BEFORE
export function registerDenchIntegrationsBridge(api: any, fallbackGatewayUrl: string) {
  stripRuntimeComposioServer(api);           // always strips
  ...
}

// AFTER
export function registerDenchIntegrationsBridge(api: any, fallbackGatewayUrl: string) {
  const nativeKey = process.env.COMPOSIO_API_KEY?.trim();
  if (!nativeKey) {
    // Only wipe when not using native mode — gateway mode still needs stripping
    // to prevent the bundled composio mcp from conflicting with the gateway bridge
    stripRuntimeComposioServer(api);
  }
  // When nativeKey is set: leave api.config.mcp.servers.composio intact so
  // OpenClaw uses the native MCP server the user configured.
  ...
}
```

**Change auth header in `createDenchExecuteIntegrationsTool` (line 86)**:
```typescript
// Pass mode + key into the factory instead of a pre-built authorization string

// AFTER: the factory receives the raw key and mode
function createDenchExecuteIntegrationsTool(params: {
  baseUrl: string;
  apiKey: string;
  mode: "native" | "dench-cloud";
}): AnyAgentTool {
  ...
  const res = await fetch(`${params.baseUrl}/v1/composio/tools/execute`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      accept: "application/json",
      ...(params.mode === "native"
        ? { "x-composio-api-key": params.apiKey }
        : { authorization: `Bearer ${params.apiKey}` }),
    },
    ...
  });
}
```

#### 2. `apps/web/lib/composio.ts`

- Replace `DEFAULT_GATEWAY_URL = "https://gateway.merseoriginals.com"` with import from `composio-mode.ts`
- Replace `resolveComposioGatewayUrl()` → `resolveComposioBaseUrl()` from `composio-mode.ts`
- Replace `resolveComposioApiKey()` reads of `DENCH_CLOUD_API_KEY` → import from `composio-mode.ts`
- Change `resolveComposioEligibility()`: `return resolveComposioMode() !== "none"`
- Change `gatewayFetch()` headers: use `"x-composio-api-key"` when in native mode, `Authorization: Bearer` otherwise

#### 3. `apps/web/lib/integrations.ts`

Add `composio` field to `IntegrationsState`:

```typescript
export type IntegrationsState = {
  denchCloud: { hasKey: boolean; isPrimaryProvider: boolean; primaryModel: string | null; };
  composio: { hasKey: boolean; mode: "native" | "dench-cloud" | "none"; };  // NEW
  metadata: DenchIntegrationMetadata;
  search: { builtIn: BuiltInSearchState; effectiveOwner: "exa" | "web_search" | "none"; };
  managedPlugins: ManagedPluginState[];
  integrations: DenchIntegrationState[];
};
```

In `getIntegrationsState()`, add:
```typescript
composio: {
  hasKey: resolveComposioMode() !== "none",
  mode: resolveComposioMode(),
},
```

Replace `DEFAULT_GATEWAY_URL` constant at line 185 with import from `composio-mode.ts`.

#### 4. `apps/web/app/components/integrations/integrations-panel.tsx`

Line 93 — change eligibility gate:
```tsx
// BEFORE
eligible={Boolean(data.denchCloud.hasKey && data.denchCloud.isPrimaryProvider)}

// AFTER
eligible={Boolean(data.composio?.hasKey)}
```

Lines 94–99 — change lock badge:
```tsx
// BEFORE: locked on denchCloud.hasKey
// AFTER
lockBadge={!data.composio?.hasKey ? "Add Composio API Key" : null}
```

Header text: change "Connect third-party apps to your Dench Cloud workspace" →
"Connect third-party apps via your Composio API key"

#### 5. `apps/web/app/api/composio/connect/route.ts`

- Error message: "Dench Cloud API key is required." → "Composio API key is required."
- Error message: "Dench Cloud must be the primary provider." → REMOVE (no longer required)
- All calls to `writeConnection(toolkit, record)` and `readOnboardingState()` will gain
  a `workspaceName` parameter once Part B lands (see wiring section below)

#### 6. `src/cli/dench-cloud.ts`

- `DEFAULT_DENCH_CLOUD_GATEWAY_URL` → read from `COMPOSIO_BASE_URL` env with same fallback
- `buildComposioMcpServerConfig()` → use `buildComposioMcpConfig()` logic:
  - native mode: `url = https://mcp.composio.dev/${key}`, header `x-composio-api-key`
  - dench-cloud mode: existing behavior unchanged
- `resolveComposioEligibility()` → `Boolean(process.env.COMPOSIO_API_KEY?.trim() || denchKey)`

#### 7. `extensions/shared/dench-auth.ts` (if it exists as shared layer)

Add env-var read for `COMPOSIO_API_KEY` before falling back to `readDenchAuthProfileKey()`.

---

## Part B: Multi-User with RBAC

### Goals

1. Login screen + session cookie (no external IdP required — local credential store)
2. Per-user workspace isolation using existing `workspace-<name>/` machinery
3. Server-side RBAC enforcement on all API routes
4. User/role management UI accessible only to Admins
5. Backward-compat: existing single-user 'Val' setup migrates automatically

### Auth library choice: BetterAuth

**Why BetterAuth over NextAuth.js/Lucia**:
- First-class Next.js 15 App Router support with typed route handlers
- Pluggable credential store — we can back it with a local JSON file (no DB required for
  a small team; upgrade path to SQLite/Postgres is a one-line adapter swap)
- Built-in session management with httpOnly cookies
- Smaller API surface than NextAuth.js v5 (less magic, easier to trace)

Install: `pnpm add better-auth`

### Data model

#### User store: `<stateDir>/.openclaw-dench/users.json`

```json
{
  "version": 1,
  "users": [
    {
      "id": "usr_01",
      "name": "Val",
      "email": "val@example.com",
      "passwordHash": "$argon2id$...",
      "role": "admin",
      "workspaceName": "val",
      "createdAt": "2026-01-01T00:00:00Z",
      "active": true
    }
  ]
}
```

Fields:
- `id`: stable opaque identifier (prefix `usr_`, 8 random hex chars)
- `role`: `"admin"` | `"member"` | `"viewer"`
- `workspaceName`: maps to `workspace-<workspaceName>/` directory; MUST be unique, slug-safe
- `active`: soft-delete flag

Password hashing: `argon2id` via the `@node-rs/argon2` package (native binding, no WASM).

#### Session store

BetterAuth uses its own in-memory + signed cookie session by default.
For a single-server deployment the default cookie session is sufficient.
Session payload (stored in signed httpOnly cookie):
```typescript
type SessionPayload = {
  userId: string;
  role: "admin" | "member" | "viewer";
  workspaceName: string;
  exp: number; // unix timestamp
};
```

Session duration: 8 hours, sliding window renewal on each request.

#### RBAC permissions matrix

| Permission | Admin | Member | Viewer |
|---|---|---|---|
| Read own CRM data | ✓ | ✓ | ✓ |
| Write own CRM data | ✓ | ✓ | ✗ |
| Configure own Composio connections | ✓ | ✓ | ✗ |
| Configure own MCP servers | ✓ | ✓ | ✗ |
| Access own workspace settings | ✓ | ✓ | ✗ |
| View other users' existence (name/email) | ✓ | ✗ | ✗ |
| Create/invite users | ✓ | ✗ | ✗ |
| Change user roles | ✓ | ✗ | ✗ |
| Deactivate users | ✓ | ✗ | ✗ |
| Access global settings | ✓ | ✗ | ✗ |
| View global integrations state | ✓ | ✗ | ✗ |

All permissions are enforced server-side. The UI hides controls for clarity, but every
API route independently re-checks the session role.

### Isolation strategy: named-workspace-per-user (Option B)

The existing `workspace-<name>/` directory machinery in `apps/web/lib/workspace.ts` is
already designed for multiple named workspaces. The `workspaceName` field in the user
record maps directly to this:

- User `val` → `workspace-val/`
- User `alice` → `workspace-alice/`

All functions in `apps/web/lib/denchclaw-state.ts` already accept an optional
`workspaceName?` parameter. The per-user isolation change is: replace every call-site
that passes `undefined` (which falls back to `getActiveWorkspaceName()`) with the
`workspaceName` extracted from the session cookie.

DuckDB is already per-workspace-exclusive-lock. A separate `.duckdb` file under
`workspace-<name>/.denchclaw/` means zero contention between users.

### Auth flow

```
Browser → GET /                         (protected route)
         middleware.ts                  intercept if no session cookie
         → redirect to /login

Browser → POST /api/auth/login          (BetterAuth handler)
         validate email/password
         argon2id.verify(hash, password)
         issue signed httpOnly session cookie
         → redirect to / or originally requested URL

Browser → GET /                         (now has valid cookie)
         middleware.ts                  verify cookie, inject userId/role into request
         → proceed to page

Browser → any /api/* route
         requireSession(req) helper     reads cookie, verifies signature, extracts payload
         if invalid → 401 JSON
         passes { userId, role, workspaceName } to handler
```

### File-by-file changes (Part B)

#### NEW: `apps/web/middleware.ts`

```typescript
import { NextRequest, NextResponse } from "next/server";
import { verifySession } from "@/lib/auth/session";

const PUBLIC_PATHS = ["/login", "/api/auth"];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Let auth endpoints and static assets through
  if (PUBLIC_PATHS.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }
  if (pathname.startsWith("/_next") || pathname.startsWith("/favicon")) {
    return NextResponse.next();
  }

  const session = await verifySession(request);
  if (!session) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.redirect(new URL("/login", request.url));
  }

  // Forward session identity to route handlers via headers
  const response = NextResponse.next();
  response.headers.set("x-user-id", session.userId);
  response.headers.set("x-user-role", session.role);
  response.headers.set("x-workspace-name", session.workspaceName);
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
```

#### NEW: `apps/web/lib/auth/` directory

```
apps/web/lib/auth/
├── session.ts        # verifySession(), createSession(), destroySession()
├── users.ts          # readUsers(), createUser(), updateUserRole() backed by users.json
├── password.ts       # hashPassword(), verifyPassword() via @node-rs/argon2
└── rbac.ts           # requireRole(), hasPermission() helpers
```

**`apps/web/lib/auth/session.ts`** (key exports):
```typescript
export type SessionPayload = {
  userId: string;
  role: "admin" | "member" | "viewer";
  workspaceName: string;
};

export async function verifySession(req: NextRequest): Promise<SessionPayload | null>
export async function createSession(payload: SessionPayload, res: NextResponse): Promise<void>
export async function destroySession(res: NextResponse): Promise<void>

// For use INSIDE route handlers (reads x-user-* headers set by middleware)
export function getSessionFromHeaders(headers: Headers): SessionPayload | null
```

Session signing: `jose` (already a common Next.js dep) with `HS256` and a `SESSION_SECRET`
env var (32+ chars, generated on first run and written to `.openclaw-dench/session-secret`
if not set via env).

**`apps/web/lib/auth/users.ts`** (key exports):
```typescript
export type User = {
  id: string;
  name: string;
  email: string;
  passwordHash: string;
  role: "admin" | "member" | "viewer";
  workspaceName: string;
  createdAt: string;
  active: boolean;
};

export function readUsers(): User[]
export function findUserByEmail(email: string): User | undefined
export function createUser(input: Omit<User, "id" | "createdAt">): User
export function updateUser(id: string, patch: Partial<Pick<User, "role" | "active" | "name">>): void
```

Backed by `<stateDir>/.openclaw-dench/users.json` with atomic write (temp + rename pattern,
same as existing `denchclaw-state.ts`).

**`apps/web/lib/auth/rbac.ts`**:
```typescript
export type Role = "admin" | "member" | "viewer";
export type Permission =
  | "workspace:read" | "workspace:write"
  | "composio:read" | "composio:write"
  | "mcp:read" | "mcp:write"
  | "users:read" | "users:write";

const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  admin: ["workspace:read","workspace:write","composio:read","composio:write",
          "mcp:read","mcp:write","users:read","users:write"],
  member: ["workspace:read","workspace:write","composio:read","composio:write",
           "mcp:read","mcp:write"],
  viewer: ["workspace:read","composio:read","mcp:read"],
};

export function hasPermission(role: Role, permission: Permission): boolean
export function requirePermission(role: Role, permission: Permission): void // throws 403
```

#### NEW: `apps/web/app/login/page.tsx`

Simple email + password form. No external IdP. Submits to `/api/auth/login`.
Minimal styling consistent with existing onboarding pages.

#### NEW: `apps/web/app/api/auth/login/route.ts`
```typescript
// POST /api/auth/login
// body: { email: string; password: string }
// response: sets httpOnly cookie, returns { ok: true } or 401
```

#### NEW: `apps/web/app/api/auth/logout/route.ts`
```typescript
// POST /api/auth/logout
// clears session cookie, returns { ok: true }
```

#### NEW: `apps/web/app/api/users/route.ts`
```typescript
// GET  /api/users — admin only, returns user list (no password hashes)
// POST /api/users — admin only, creates user + workspace directory
```

#### NEW: `apps/web/app/api/users/[userId]/route.ts`
```typescript
// PATCH /api/users/[userId] — admin only, update role or active flag
// DELETE /api/users/[userId] — admin only, soft-deactivate
```

#### MODIFIED: Every existing `/api/*` route handler

Add at the top of each handler:
```typescript
const session = getSessionFromHeaders(request.headers);
if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
const { workspaceName, role } = session;
```

Then pass `workspaceName` into all `denchclaw-state.ts` calls that currently pass `undefined`.

Key routes requiring changes:
- `apps/web/app/api/composio/connect/route.ts` — pass `workspaceName` to `writeConnection`
- `apps/web/app/api/integrations/route.ts` — pass `workspaceName` to `normalizeLockedDenchIntegrations`
- `apps/web/app/api/sessions/route.ts` — filter sessions by `workspaceName`
- `apps/web/app/api/web-sessions/route.ts` — filter by `workspaceName`
- `apps/web/app/api/gateway/sessions/route.ts` — filter by `workspaceName`
- `apps/web/app/api/sync/poll-tick/route.ts` — validate against session's workspaceName

#### MODIFIED: `apps/web/lib/dench-auth.ts`

`AUTH_PROFILES_REL` is currently hardcoded to `join("agents", "main", "agent", "auth-profiles.json")`.

For multi-user, the `main` agent directory should remain shared (it's the OpenClaw process,
not per-user). The Composio API key is a SYSTEM-LEVEL credential (one key for the whole
installation), so `dench-auth.ts` does NOT need a userId parameter. This is intentional:
the `COMPOSIO_API_KEY` env var is the system credential; per-user data isolation is at the
workspace/CRM layer, not at the API key layer.

#### MODIFIED: `apps/web/app/page.tsx`

```typescript
// BEFORE
if (!isOnboardingComplete()) redirect("/onboarding");

// AFTER  
const session = getSessionFromHeaders(headers());
if (!session) redirect("/login");                    // auth gate FIRST
if (!isOnboardingComplete(session.workspaceName)) redirect("/onboarding");
```

Note: `middleware.ts` will already redirect to `/login` before this runs. The explicit
check in `page.tsx` is a defense-in-depth guard for direct server-component invocation.

#### NEW: `apps/web/app/components/workspace/user-management-panel.tsx`

A new virtual-path tab `~settings/users` that renders only when `role === "admin"`.

Shows:
- User list (name, email, role, last active, workspace)
- "Invite User" button (creates user with temp password shown once)
- Role dropdown (Admin/Member/Viewer)
- Deactivate toggle

Wire into `workspace-content.tsx` alongside existing virtual path tabs (`~integrations`,
`~cloud`, `~skills`).

### Migration strategy: backward-compat for existing 'Val' user

On first server start after the upgrade, run an idempotent migration that checks if
`users.json` exists. If not:

1. Read `OnboardingState` from the default workspace (`workspace/` or `workspace-main/`)
   to extract `identity.name` and `identity.email`
2. Create a user record with `role: "admin"`, `workspaceName: "val"` (or derived from
   the onboarding name, slug-ified), and a randomly-generated temporary password
3. Write the password to a one-time file at `<stateDir>/.openclaw-dench/INITIAL_PASSWORD.txt`
   with instructions to change it on first login
4. Rename the existing workspace directory: `workspace/` → `workspace-val/` (or
   `workspace-main/` → `workspace-val/`) using an atomic rename
5. Write `users.json`

If the migration file already exists, skip all steps (idempotent).

The migration runs in `apps/web/instrumentation.ts` (Next.js server lifecycle hook, runs
once at server startup before any requests are handled).

```typescript
// apps/web/instrumentation.ts (EXISTING FILE — add to it)
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    // existing instrumentation ...
    await import("./lib/auth/migration").then((m) => m.runMigrationIfNeeded());
  }
}
```

---

## Wiring: how Parts A and B compose

Parts A and B are designed to be implemented in sequence (A first) with clean interfaces
between them.

After Part A lands, the `composio/connect/route.ts` already calls workspace functions
without a `workspaceName`. After Part B lands, the middleware provides `workspaceName`
from the session, and each route handler's first two lines become the idiomatic pattern:

```typescript
const session = getSessionFromHeaders(request.headers);
if (!session) return unauthorized();
const { workspaceName, role } = session;
// ... rest of handler, passing workspaceName to all state functions
```

The `COMPOSIO_API_KEY` remains a system-level env var (not per-user) because Composio
connections are already scoped per-workspace by the `writeConnection` / `readOnboardingState`
calls once `workspaceName` is properly threaded through.

---

## Implementation sequence

See the StructuredOutput task list (returned with this document) for the exact sequencing.
Tasks are ordered so each builds on the prior without requiring back-patches:

1. **native-composio wiring** (independent, no auth needed)
2. **auth foundation** (session + user store + middleware)
3. **RBAC enforcement** (add permission checks to existing routes)
4. **workspace isolation wiring** (thread `workspaceName` through all state calls)
5. **UI: login + user management** (frontend, depends on auth foundation)
6. **migration** (startup migration for existing Val user)
7. **wiring: extension bridge** (update `composio-bridge.ts` in extensions/)
