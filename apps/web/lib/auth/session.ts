/**
 * Session management for DenchClaw multi-user mode.
 *
 * Sessions are HS256-signed JWTs stored in an httpOnly cookie. The signing
 * secret is read from SESSION_SECRET env var; if absent, a random secret is
 * generated on first call and persisted to <stateDir>/.openclaw-dench/session-secret
 * so it survives process restarts.
 */
import {
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";
import { randomBytes } from "node:crypto";
import { SignJWT, jwtVerify, type JWTPayload } from "jose";
import type { NextRequest, NextResponse } from "next/server";
import { resolveOpenClawStateDir } from "@/lib/workspace";
import type { Role } from "./rbac";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type SessionPayload = {
  userId: string;
  role: Role;
  workspaceName: string;
};

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const COOKIE_NAME = "denchclaw_session";
const MAX_AGE_SECONDS = 8 * 60 * 60; // 8 hours
const ALGORITHM = "HS256";
const DENCH_DIR = ".openclaw-dench";
const SECRET_FILENAME = "session-secret";

// ---------------------------------------------------------------------------
// Signing secret
// ---------------------------------------------------------------------------

let _cachedSecret: Uint8Array | null = null;

function secretFilePath(): string {
  return join(resolveOpenClawStateDir(), DENCH_DIR, SECRET_FILENAME);
}

function ensureDenchDir(): void {
  const dir = join(resolveOpenClawStateDir(), DENCH_DIR);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
}

function loadOrCreateSecret(): Uint8Array {
  if (_cachedSecret) return _cachedSecret;

  // Priority 1: SESSION_SECRET env var
  const envSecret = process.env.SESSION_SECRET?.trim();
  if (envSecret && envSecret.length >= 32) {
    _cachedSecret = new TextEncoder().encode(envSecret);
    return _cachedSecret;
  }

  // Priority 2: persisted secret file
  const p = secretFilePath();
  if (existsSync(p)) {
    try {
      const raw = readFileSync(p, "utf-8").trim();
      if (raw.length >= 32) {
        _cachedSecret = new TextEncoder().encode(raw);
        return _cachedSecret;
      }
    } catch {
      // fall through to generate
    }
  }

  // Generate and persist
  ensureDenchDir();
  const generated = randomBytes(48).toString("hex");
  const tmp = `${p}.tmp.${Date.now()}`;
  writeFileSync(tmp, generated, "utf-8");
  renameSync(tmp, p);
  _cachedSecret = new TextEncoder().encode(generated);
  return _cachedSecret;
}

// ---------------------------------------------------------------------------
// JWT helpers
// ---------------------------------------------------------------------------

async function signPayload(payload: SessionPayload): Promise<string> {
  const secret = loadOrCreateSecret();
  return new SignJWT(payload as unknown as JWTPayload)
    .setProtectedHeader({ alg: ALGORITHM })
    .setIssuedAt()
    .setExpirationTime(`${MAX_AGE_SECONDS}s`)
    .sign(secret);
}

async function decodeToken(token: string): Promise<SessionPayload | null> {
  try {
    const secret = loadOrCreateSecret();
    const { payload } = await jwtVerify(token, secret, {
      algorithms: [ALGORITHM],
    });
    const p = payload as JWTPayload & Partial<SessionPayload>;
    if (!p.userId || !p.role || !p.workspaceName) return null;
    return {
      userId: p.userId,
      role: p.role as Role,
      workspaceName: p.workspaceName,
    };
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Verify the session cookie on an incoming Next.js middleware request.
 * Returns the decoded payload or null if missing/invalid/expired.
 */
export async function verifySession(
  req: NextRequest,
): Promise<SessionPayload | null> {
  const token = req.cookies.get(COOKIE_NAME)?.value;
  if (!token) return null;
  return decodeToken(token);
}

/**
 * Issue a signed session cookie on a NextResponse.
 * Call this after successful login.
 */
export async function createSession(
  payload: SessionPayload,
  res: NextResponse,
): Promise<void> {
  const token = await signPayload(payload);
  res.cookies.set(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    maxAge: MAX_AGE_SECONDS,
    path: "/",
    // secure is set by Next.js automatically in production
  });
}

/**
 * Clear the session cookie. Call this on logout.
 */
export function destroySession(res: NextResponse): void {
  res.cookies.set(COOKIE_NAME, "", {
    httpOnly: true,
    sameSite: "lax",
    maxAge: 0,
    path: "/",
  });
}

/**
 * Read session from the x-user-* headers injected by middleware.
 * Use this inside route handlers instead of re-verifying the cookie.
 */
export function getSessionFromHeaders(headers: Headers): SessionPayload | null {
  const userId = headers.get("x-user-id");
  const role = headers.get("x-user-role") as Role | null;
  const workspaceName = headers.get("x-workspace-name");
  if (!userId || !role || !workspaceName) return null;
  return { userId, role, workspaceName };
}
