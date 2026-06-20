/**
 * Role-based access control (RBAC) for DenchClaw multi-user mode.
 *
 * Permissions matrix (from DESIGN-COMPOSIO-RBAC.md):
 *
 * | Permission              | Admin | Member | Viewer |
 * |-------------------------|-------|--------|--------|
 * | workspace:read          |  ✓    |  ✓     |  ✓     |
 * | workspace:write         |  ✓    |  ✓     |  ✗     |
 * | composio:read           |  ✓    |  ✓     |  ✓     |
 * | composio:write          |  ✓    |  ✓     |  ✗     |
 * | mcp:read                |  ✓    |  ✓     |  ✓     |
 * | mcp:write               |  ✓    |  ✓     |  ✗     |
 * | users:read              |  ✓    |  ✗     |  ✗     |
 * | users:write             |  ✓    |  ✗     |  ✗     |
 * | settings:read           |  ✓    |  ✗     |  ✗     |
 * | integrations:read       |  ✓    |  ✗     |  ✗     |
 */

export type Role = "admin" | "member" | "viewer";

export type Permission =
  | "workspace:read"
  | "workspace:write"
  | "composio:read"
  | "composio:write"
  | "mcp:read"
  | "mcp:write"
  | "users:read"
  | "users:write"
  | "settings:read"
  | "integrations:read";

export const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  admin: [
    "workspace:read",
    "workspace:write",
    "composio:read",
    "composio:write",
    "mcp:read",
    "mcp:write",
    "users:read",
    "users:write",
    "settings:read",
    "integrations:read",
  ],
  member: [
    "workspace:read",
    "workspace:write",
    "composio:read",
    "composio:write",
    "mcp:read",
    "mcp:write",
  ],
  viewer: [
    "workspace:read",
    "composio:read",
    "mcp:read",
  ],
};

export function hasPermission(role: Role, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role]?.includes(permission) ?? false;
}

/**
 * Throws a structured error understood by route handlers:
 * `{ status: 403, message: "Forbidden: missing permission <permission>" }`
 */
export function requirePermission(role: Role, permission: Permission): void {
  if (!hasPermission(role, permission)) {
    const err = new Error(`Forbidden: missing permission ${permission}`) as Error & {
      status: number;
    };
    err.status = 403;
    throw err;
  }
}
