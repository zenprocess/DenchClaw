import { NextRequest, NextResponse } from "next/server";

import { getSessionFromHeaders } from "@/lib/auth/session";
import { requirePermission } from "@/lib/auth/rbac";
import { findUserById, updateUser, type Role } from "@/lib/auth/users";

const ROLES: Role[] = ["admin", "member", "viewer"];

type RouteCtx = { params: Promise<{ userId: string }> };

// PATCH /api/users/[userId] — admin only. Update role, active flag, or name.
export async function PATCH(req: NextRequest, ctx: RouteCtx) {
  const session = getSessionFromHeaders(req.headers);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    requirePermission(session.role, "users:write");
  } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { userId } = await ctx.params;
  const target = findUserById(userId);
  if (!target) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  let body: { role?: Role; active?: boolean; name?: string };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  // Guard: an admin cannot demote or deactivate themselves (avoid lockout).
  const isSelf = target.id === session.userId;
  if (isSelf && (body.role && body.role !== "admin")) {
    return NextResponse.json(
      { error: "You cannot change your own admin role" },
      { status: 400 },
    );
  }
  if (isSelf && body.active === false) {
    return NextResponse.json(
      { error: "You cannot deactivate yourself" },
      { status: 400 },
    );
  }

  const patch: Partial<Pick<{ role: Role; active: boolean; name: string }, "role" | "active" | "name">> = {};
  if (body.role && ROLES.includes(body.role)) patch.role = body.role;
  if (typeof body.active === "boolean") patch.active = body.active;
  if (typeof body.name === "string" && body.name.trim()) patch.name = body.name.trim();

  updateUser(userId, patch);
  return NextResponse.json({ ok: true });
}

// DELETE /api/users/[userId] — admin only. Soft-deactivate (never hard-delete data).
export async function DELETE(req: NextRequest, ctx: RouteCtx) {
  const session = getSessionFromHeaders(req.headers);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    requirePermission(session.role, "users:write");
  } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { userId } = await ctx.params;
  const target = findUserById(userId);
  if (!target) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }
  if (target.id === session.userId) {
    return NextResponse.json(
      { error: "You cannot deactivate yourself" },
      { status: 400 },
    );
  }
  updateUser(userId, { active: false });
  return NextResponse.json({ ok: true });
}
