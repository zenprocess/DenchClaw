import { NextRequest, NextResponse } from "next/server";

import { getSessionFromHeaders } from "@/lib/auth/session";
import { requirePermission } from "@/lib/auth/rbac";
import {
  readUsers,
  createUser,
  findUserByEmail,
  type Role,
} from "@/lib/auth/users";
import { hashPassword } from "@/lib/auth/password";

function slugify(input: string): string {
  return (
    input
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "user"
  );
}

function temporaryPassword(): string {
  const bytes = new Uint8Array(9);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

const ROLES: Role[] = ["admin", "member", "viewer"];

// GET /api/users — admin only. Returns the user list WITHOUT password hashes.
export async function GET(req: NextRequest) {
  const session = getSessionFromHeaders(req.headers);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    requirePermission(session.role, "users:read");
  } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const users = readUsers().map(({ passwordHash: _omit, ...rest }) => rest);
  return NextResponse.json({ users });
}

// POST /api/users — admin only. Creates a user + a unique workspace, returns a
// one-time temporary password the admin shares with the new user.
export async function POST(req: NextRequest) {
  const session = getSessionFromHeaders(req.headers);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    requirePermission(session.role, "users:write");
  } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: { name?: string; email?: string; role?: Role };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const name = (body.name ?? "").trim();
  const email = (body.email ?? "").trim().toLowerCase();
  const role: Role = body.role && ROLES.includes(body.role) ? body.role : "member";
  if (!name || !email) {
    return NextResponse.json(
      { error: "name and email are required" },
      { status: 400 },
    );
  }
  if (findUserByEmail(email)) {
    return NextResponse.json(
      { error: "A user with that email already exists" },
      { status: 409 },
    );
  }

  // Ensure a unique, slug-safe workspace name.
  const base = slugify(name);
  const existing = new Set(readUsers().map((u) => u.workspaceName));
  let workspaceName = base;
  let n = 2;
  while (existing.has(workspaceName)) workspaceName = `${base}-${n++}`;

  const temp = temporaryPassword();
  const passwordHash = await hashPassword(temp);
  const user = createUser({
    name,
    email,
    passwordHash,
    role,
    workspaceName,
    active: true,
  });
  const { passwordHash: _omit, ...safe } = user;
  return NextResponse.json(
    { user: safe, temporaryPassword: temp },
    { status: 201 },
  );
}
