/**
 * Local user store backed by <stateDir>/.openclaw-dench/users.json.
 *
 * All writes are atomic (write to temp file + rename) so a crash mid-write
 * never leaves a half-written JSON file.
 */
import {
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";
import { resolveOpenClawStateDir } from "@/lib/workspace";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type Role = "admin" | "member" | "viewer";

export type User = {
  /** Stable opaque identifier, e.g. "usr_a1b2c3d4" */
  id: string;
  name: string;
  email: string;
  passwordHash: string;
  role: Role;
  /** Maps to workspace-<workspaceName>/ directory */
  workspaceName: string;
  createdAt: string;
  active: boolean;
};

type UsersFile = {
  version: 1;
  users: User[];
};

// ---------------------------------------------------------------------------
// Storage path
// ---------------------------------------------------------------------------

const DENCH_DIR = ".openclaw-dench";
const USERS_FILENAME = "users.json";

function usersFilePath(): string {
  return join(resolveOpenClawStateDir(), DENCH_DIR, USERS_FILENAME);
}

function ensureDenchDir(): void {
  const dir = join(resolveOpenClawStateDir(), DENCH_DIR);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
}

// ---------------------------------------------------------------------------
// Read
// ---------------------------------------------------------------------------

export function readUsers(): User[] {
  const p = usersFilePath();
  if (!existsSync(p)) return [];
  try {
    const raw = readFileSync(p, "utf-8");
    const parsed = JSON.parse(raw) as UsersFile;
    if (!Array.isArray(parsed.users)) return [];
    return parsed.users;
  } catch {
    return [];
  }
}

export function findUserByEmail(email: string): User | undefined {
  const lower = email.toLowerCase().trim();
  return readUsers().find((u) => u.email.toLowerCase() === lower);
}

export function findUserById(id: string): User | undefined {
  return readUsers().find((u) => u.id === id);
}

// ---------------------------------------------------------------------------
// Write helpers
// ---------------------------------------------------------------------------

function writeUsers(users: User[]): void {
  ensureDenchDir();
  const p = usersFilePath();
  const tmp = `${p}.tmp.${Date.now()}`;
  const data: UsersFile = { version: 1, users };
  writeFileSync(tmp, JSON.stringify(data, null, 2), "utf-8");
  renameSync(tmp, p);
}

// ---------------------------------------------------------------------------
// ID generation
// ---------------------------------------------------------------------------

function generateUserId(): string {
  const hex = Array.from({ length: 8 }, () =>
    Math.floor(Math.random() * 16).toString(16),
  ).join("");
  return `usr_${hex}`;
}

// ---------------------------------------------------------------------------
// Mutations
// ---------------------------------------------------------------------------

export function createUser(
  input: Omit<User, "id" | "createdAt">,
): User {
  const users = readUsers();
  const newUser: User = {
    ...input,
    id: generateUserId(),
    createdAt: new Date().toISOString(),
  };
  writeUsers([...users, newUser]);
  return newUser;
}

export function updateUser(
  id: string,
  patch: Partial<Pick<User, "role" | "active" | "name">>,
): void {
  const users = readUsers();
  const idx = users.findIndex((u) => u.id === id);
  if (idx === -1) return;
  users[idx] = { ...users[idx], ...patch };
  writeUsers(users);
}
