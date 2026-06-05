const HELP_FLAGS = new Set(["-h", "--help"]);
const VERSION_FLAGS = new Set(["-V", "--version"]);
const ROOT_VERSION_ALIAS_FLAG = "-v";
const ROOT_BOOLEAN_FLAGS = new Set(["--dev", "--no-color"]);
const ROOT_VALUE_FLAGS = new Set(["--profile"]);
const FLAG_TERMINATOR = "--";

export function hasHelpOrVersion(argv: string[]): boolean {
  return (
    argv.some((arg) => HELP_FLAGS.has(arg) || VERSION_FLAGS.has(arg)) || hasRootVersionAlias(argv)
  );
}

function isValueToken(arg: string | undefined): boolean {
  if (!arg) {
    return false;
  }
  if (arg === FLAG_TERMINATOR) {
    return false;
  }
  if (!arg.startsWith("-")) {
    return true;
  }
  return /^-\d+(?:\.\d+)?$/.test(arg);
}

function parsePositiveInt(value: string): number | undefined {
  const parsed = Number.parseInt(value, 10);
  if (Number.isNaN(parsed) || parsed <= 0) {
    return undefined;
  }
  return parsed;
}

export function hasFlag(argv: string[], name: string): boolean {
  const args = argv.slice(2);
  for (const arg of args) {
    if (arg === FLAG_TERMINATOR) {
      break;
    }
    if (arg === name) {
      return true;
    }
  }
  return false;
}

export function hasRootVersionAlias(argv: string[]): boolean {
  const args = argv.slice(2);
  let hasAlias = false;
  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (!arg) {
      continue;
    }
    if (arg === FLAG_TERMINATOR) {
      break;
    }
    if (arg === ROOT_VERSION_ALIAS_FLAG) {
      hasAlias = true;
      continue;
    }
    if (ROOT_BOOLEAN_FLAGS.has(arg)) {
      continue;
    }
    if (arg.startsWith("--profile=")) {
      continue;
    }
    if (ROOT_VALUE_FLAGS.has(arg)) {
      const next = args[i + 1];
      if (isValueToken(next)) {
        i += 1;
      }
      continue;
    }
    if (arg.startsWith("-")) {
      continue;
    }
    return false;
  }
  return hasAlias;
}

export function getFlagValue(argv: string[], name: string): string | null | undefined {
  const args = argv.slice(2);
  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (arg === FLAG_TERMINATOR) {
      break;
    }
    if (arg === name) {
      const next = args[i + 1];
      return isValueToken(next) ? next : null;
    }
    if (arg.startsWith(`${name}=`)) {
      const value = arg.slice(name.length + 1);
      return value ? value : null;
    }
  }
  return undefined;
}

export function getVerboseFlag(argv: string[], options?: { includeDebug?: boolean }): boolean {
  if (hasFlag(argv, "--verbose")) {
    return true;
  }
  if (options?.includeDebug && hasFlag(argv, "--debug")) {
    return true;
  }
  return false;
}

export function getPositiveIntFlagValue(argv: string[], name: string): number | null | undefined {
  const raw = getFlagValue(argv, name);
  if (raw === null || raw === undefined) {
    return raw;
  }
  return parsePositiveInt(raw);
}

export function getCommandPath(argv: string[], depth = 2): string[] {
  const args = argv.slice(2);
  const path: string[] = [];
  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (!arg) {
      continue;
    }
    if (arg === "--") {
      break;
    }
    if (arg.startsWith("-")) {
      continue;
    }
    path.push(arg);
    if (path.length >= depth) {
      break;
    }
  }
  return path;
}

export function getPrimaryCommand(argv: string[]): string | null {
  const [primary] = getCommandPath(argv, 1);
  return primary ?? null;
}

export const LOCAL_NAMESPACE_TOKEN = "local";

/**
 * Finds the absolute index (into the full argv) of the first positional command
 * token, skipping root flags in a value-aware manner (e.g. `--profile <value>`,
 * `--profile=<value>`, boolean root flags, and `-`-prefixed flags). Stops at the
 * `--` terminator. Returns `null` when there is no positional token.
 */
export function findFirstCommandIndex(argv: string[]): number | null {
  const args = argv.slice(2);
  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (!arg) {
      continue;
    }
    if (arg === FLAG_TERMINATOR) {
      return null;
    }
    if (arg.startsWith("--profile=")) {
      continue;
    }
    if (ROOT_VALUE_FLAGS.has(arg)) {
      const next = args[i + 1];
      if (isValueToken(next)) {
        i += 1;
      }
      continue;
    }
    if (arg.startsWith("-")) {
      continue;
    }
    return i + 2;
  }
  return null;
}

/**
 * True when the first positional command token is the `local` namespace token.
 */
export function isLocalNamespace(argv: string[]): boolean {
  const index = findFirstCommandIndex(argv);
  return index !== null && argv[index] === LOCAL_NAMESPACE_TOKEN;
}

/**
 * Removes a single leading `local` namespace token from argv, preserving any
 * root flags that appeared before it. Returns argv unchanged when the first
 * positional token is not `local`.
 */
export function stripLocalNamespace(argv: string[]): string[] {
  const index = findFirstCommandIndex(argv);
  if (index === null || argv[index] !== LOCAL_NAMESPACE_TOKEN) {
    return argv;
  }
  return [...argv.slice(0, index), ...argv.slice(index + 1)];
}

export function buildParseArgv(params: {
  programName?: string;
  rawArgs?: string[];
  fallbackArgv?: string[];
}): string[] {
  const baseArgv =
    params.rawArgs && params.rawArgs.length > 0
      ? params.rawArgs
      : params.fallbackArgv && params.fallbackArgv.length > 0
        ? params.fallbackArgv
        : process.argv;
  const programName = params.programName ?? "";
  const normalizedArgv =
    programName && baseArgv[0] === programName
      ? baseArgv.slice(1)
      : baseArgv[0]?.endsWith("openclaw") || baseArgv[0]?.endsWith("denchclaw")
        ? baseArgv.slice(1)
        : baseArgv;
  const executable = (normalizedArgv[0]?.split(/[/\\]/).pop() ?? "").toLowerCase();
  const looksLikeNode =
    normalizedArgv.length >= 2 && (isNodeExecutable(executable) || isBunExecutable(executable));
  if (looksLikeNode) {
    return normalizedArgv;
  }
  return ["node", programName || "denchclaw", ...normalizedArgv];
}

const nodeExecutablePattern = /^node-\d+(?:\.\d+)*(?:\.exe)?$/;

function isNodeExecutable(executable: string): boolean {
  return (
    executable === "node" ||
    executable === "node.exe" ||
    executable === "nodejs" ||
    executable === "nodejs.exe" ||
    nodeExecutablePattern.test(executable)
  );
}

function isBunExecutable(executable: string): boolean {
  return executable === "bun" || executable === "bun.exe";
}

export function shouldMigrateStateFromPath(path: string[]): boolean {
  if (path.length === 0) {
    return true;
  }
  const [primary, secondary] = path;
  if (primary === "health" || primary === "status" || primary === "sessions") {
    return false;
  }
  if (primary === "config" && (secondary === "get" || secondary === "unset")) {
    return false;
  }
  if (primary === "models" && (secondary === "list" || secondary === "status")) {
    return false;
  }
  if (primary === "memory" && secondary === "status") {
    return false;
  }
  if (primary === "agent") {
    return false;
  }
  return true;
}

export function shouldMigrateState(argv: string[]): boolean {
  return shouldMigrateStateFromPath(getCommandPath(argv, 2));
}
