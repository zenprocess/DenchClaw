/**
 * Startup migration: promote an existing Val-style single-user workspace to
 * the multi-user users.json model.
 *
 * All steps are idempotent — safe to call on every server start.
 *
 * Strategy:
 *  1. If users.json already exists → migration already ran; return immediately.
 *  2. If no workspace directory exists → fresh install; write an empty
 *     users.json and return.
 *  3. Otherwise read identity from the discovered workspace's onboarding.json,
 *     create an admin User record, write users.json, rename the workspace dir
 *     to workspace-<slug>/, and write a plaintext INITIAL_PASSWORD.txt.
 */

import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  renameSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";
import crypto from "node:crypto";
import { resolveOpenClawStateDir } from "@/lib/workspace";
import { hashPassword } from "./password";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DENCH_DIR = ".openclaw-dench";
const USERS_FILENAME = "users.json";
const PASSWORD_HINT_FILENAME = "INITIAL_PASSWORD.txt";

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

type UsersFile = {
  version: 1;
  users: UserRecord[];
};

type UserRecord = {
  id: string;
  name: string;
  email: string;
  passwordHash: string;
  role: "admin" | "member" | "viewer";
  workspaceName: string;
  createdAt: string;
  active: boolean;
};

/** Slug-ify a display name: lowercase, spaces→hyphens, strip non-alnum-hyphen, max 32. */
function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .slice(0, 32)
    || "admin";
}

/** Ensure the slug does not collide with existing workspace-* directories. */
function uniqueSlug(base: string, stateDir: string): string {
  let candidate = base;
  let suffix = 2;
  while (existsSync(join(stateDir, `workspace-${candidate}`))) {
    candidate = `${base}-${suffix}`;
    suffix++;
  }
  return candidate;
}

/** Atomic write: tmp file + rename on the same filesystem. */
function atomicWriteJson(path: string, value: unknown): void {
  const tmp = `${path}.tmp.${process.pid}.${Date.now()}`;
  const dir = join(path, "..");
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
  writeFileSync(tmp, JSON.stringify(value, null, 2), "utf-8");
  renameSync(tmp, path);
}

/**
 * Discover the existing workspace directory to migrate.
 * Priority: workspace/ → workspace-main/ → first workspace-* directory found.
 * Returns the full path or null if nothing is found (fresh install).
 */
function discoverLegacyWorkspaceDir(stateDir: string): string | null {
  const candidates = ["workspace", "workspace-main"];
  for (const name of candidates) {
    const full = join(stateDir, name);
    if (existsSync(full)) {
      return full;
    }
  }

  // Scan for any workspace-* directory
  try {
    const entries = readdirSync(stateDir, { withFileTypes: true });
    const found = entries
      .filter((e) => e.isDirectory() && e.name.startsWith("workspace-"))
      .map((e) => e.name)[0];
    if (found) {
      return join(stateDir, found);
    }
  } catch {
    // If we cannot read the directory, treat as fresh install
  }

  return null;
}

/**
 * Read the onboarding.json inside a workspace directory to extract identity.
 * Returns {name, email} or fallback values if absent/incomplete.
 */
function readWorkspaceIdentity(workspaceDir: string): { name: string; email: string } {
  const onboardingPath = join(workspaceDir, ".denchclaw", "onboarding.json");
  try {
    if (!existsSync(onboardingPath)) {
      return { name: "Admin", email: "admin@local" };
    }
    const raw = JSON.parse(readFileSync(onboardingPath, "utf-8")) as Record<string, unknown>;
    const identity = raw.identity as Record<string, unknown> | undefined;
    const name = typeof identity?.name === "string" && identity.name.trim()
      ? identity.name.trim()
      : "Admin";
    const email = typeof identity?.email === "string" && identity.email.trim()
      ? identity.email.trim()
      : "admin@local";
    return { name, email };
  } catch {
    return { name: "Admin", email: "admin@local" };
  }
}

// ---------------------------------------------------------------------------
// Public entry point
// ---------------------------------------------------------------------------

export async function runMigrationIfNeeded(): Promise<void> {
  const stateDir = resolveOpenClawStateDir();
  const denchDir = join(stateDir, DENCH_DIR);
  const usersJsonPath = join(denchDir, USERS_FILENAME);

  // Step 1: Already migrated — bail out immediately.
  if (existsSync(usersJsonPath)) {
    return;
  }

  // Step 2: Discover existing workspace.
  const legacyWorkspaceDir = discoverLegacyWorkspaceDir(stateDir);

  if (!legacyWorkspaceDir) {
    // Fresh install — write empty users.json and return.
    const empty: UsersFile = { version: 1, users: [] };
    atomicWriteJson(usersJsonPath, empty);
    return;
  }

  // Step 3: Read identity from the workspace's onboarding state.
  const { name, email } = readWorkspaceIdentity(legacyWorkspaceDir);

  // Step 4: Derive unique workspace slug.
  const baseSlug = slugify(name);
  const workspaceName = uniqueSlug(baseSlug, stateDir);

  // Step 5: Generate a secure random temporary password.
  const plainPassword = crypto.randomBytes(12).toString("base64url");

  // Step 6: Hash the password.
  const passwordHash = await hashPassword(plainPassword);

  // Step 7: Build the User record.
  const id = "usr_" + crypto.randomBytes(4).toString("hex");
  const user: UserRecord = {
    id,
    name,
    email,
    passwordHash,
    role: "admin",
    workspaceName,
    createdAt: new Date().toISOString(),
    active: true,
  };

  // Step 8: Atomic-write users.json.
  const usersFile: UsersFile = { version: 1, users: [user] };
  atomicWriteJson(usersJsonPath, usersFile);

  // Step 9: Rename the discovered workspace directory to workspace-<workspaceName>/.
  const targetWorkspaceDir = join(stateDir, `workspace-${workspaceName}`);
  if (legacyWorkspaceDir !== targetWorkspaceDir) {
    renameSync(legacyWorkspaceDir, targetWorkspaceDir);
  }

  // Step 10: Write INITIAL_PASSWORD.txt.
  const hint = [
    `DenchClaw multi-user migration complete.`,
    ``,
    `Your admin credentials:`,
    `  Email:    ${email}`,
    `  Password: ${plainPassword}`,
    ``,
    `Log in at the /login page and change your password immediately.`,
    `This file can be deleted once you have logged in successfully.`,
    ``,
    `Generated: ${new Date().toISOString()}`,
  ].join("\n");

  const passwordHintPath = join(denchDir, PASSWORD_HINT_FILENAME);
  writeFileSync(passwordHintPath, hint, "utf-8");

  // Step 11: Log to stderr (not stdout — Next.js may capture stdout).
  process.stderr.write(
    "[migration] Migration complete. Check .openclaw-dench/INITIAL_PASSWORD.txt for the admin password.\n",
  );
}
