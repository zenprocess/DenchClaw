import { spawn } from "node:child_process";
import { homedir } from "node:os";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { isTruthyEnvValue, normalizeEnv } from "../infra/env.js";
import { isMainModule } from "../infra/is-main.js";
import { ensureOpenClawCliOnPath } from "../infra/path-env.js";
import { assertSupportedRuntime } from "../infra/runtime-guard.js";
import { VERSION } from "../version.js";
import { getCommandPath, getPrimaryCommand, hasHelpOrVersion } from "./argv.js";
import { emitCliBanner } from "./banner.js";
import { resolveCliName } from "./cli-name.js";
import { normalizeWindowsArgv } from "./windows-argv.js";

/**
 * Returns a guaranteed-valid working directory for the spawned child. When the
 * current process's cwd has been deleted (tmp dirs, deleted project folders),
 * `process.cwd()` throws ENOENT and the spawned Node.js child crashes before
 * it can do anything useful. Falling back to the user's home dir prevents that.
 */
function safeChildCwd(): string {
  try {
    return process.cwd();
  } catch {
    return homedir();
  }
}

export function rewriteUpdateFlagArgv(argv: string[]): string[] {
  const index = argv.indexOf("--update");
  if (index === -1) {
    return argv;
  }

  const next = [...argv];
  next.splice(index, 1, "update");
  return next;
}

export function shouldRegisterPrimarySubcommand(argv: string[]): boolean {
  return !hasHelpOrVersion(argv);
}

export function shouldEnsureCliPath(argv: string[]): boolean {
  if (hasHelpOrVersion(argv)) {
    return false;
  }
  const [primary, secondary] = getCommandPath(argv, 2);
  if (!primary) {
    return true;
  }
  if (primary === "status" || primary === "health" || primary === "sessions") {
    return false;
  }
  if (primary === "config" && (secondary === "get" || secondary === "unset")) {
    return false;
  }
  if (primary === "models" && (secondary === "list" || secondary === "status")) {
    return false;
  }
  return true;
}

export function isBareDenchclawInvocation(argv: string[]): boolean {
  if (hasHelpOrVersion(argv)) {
    return false;
  }
  if (getPrimaryCommand(argv)) {
    return false;
  }
  return resolveCliName(argv) === "denchclaw";
}

function isDelegationDisabled(env: NodeJS.ProcessEnv = process.env): boolean {
  return (
    isTruthyEnvValue(env.DENCHCLAW_DISABLE_OPENCLAW_DELEGATION) ||
    isTruthyEnvValue(env.OPENCLAW_DISABLE_OPENCLAW_DELEGATION)
  );
}

export function shouldDelegateToGlobalOpenClaw(
  argv: string[],
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  if (isDelegationDisabled(env)) {
    return false;
  }
  const primary = getPrimaryCommand(argv);
  if (!primary) {
    return false;
  }
  return (
    primary !== "bootstrap" &&
    primary !== "update" &&
    primary !== "stop" &&
    primary !== "start" &&
    primary !== "restart" &&
    primary !== "telemetry"
  );
}

export function shouldHideCliBanner(argv: string[], env: NodeJS.ProcessEnv = process.env): boolean {
  const commandPath = getCommandPath(argv, 2);
  return (
    isTruthyEnvValue(env.DENCHCLAW_HIDE_BANNER) ||
    isTruthyEnvValue(env.OPENCLAW_HIDE_BANNER) ||
    commandPath[0] === "completion" ||
    (commandPath[0] === "plugins" && commandPath[1] === "update")
  );
}

async function delegateToGlobalOpenClaw(argv: string[]): Promise<number> {
  if (
    isTruthyEnvValue(process.env.DENCHCLAW_DELEGATED) ||
    isTruthyEnvValue(process.env.OPENCLAW_DELEGATED)
  ) {
    throw new Error(
      "OpenClaw delegation loop detected. Check PATH so `openclaw` resolves to the global OpenClaw CLI.",
    );
  }
  const delegatedArgv = argv.slice(2);
  return await new Promise<number>((resolve, reject) => {
    const child = spawn("openclaw", delegatedArgv, {
      stdio: "inherit",
      cwd: safeChildCwd(),
      env: {
        ...process.env,
        DENCHCLAW_DELEGATED: "1",
        OPENCLAW_DELEGATED: "1",
      },
      ...(process.platform === "win32" ? { shell: true, windowsHide: true } : {}),
    });

    child.once("error", (error) => {
      const err = error as NodeJS.ErrnoException;
      if (err?.code === "ENOENT") {
        reject(
          new Error(
            [
              "Global `openclaw` CLI was not found on PATH.",
              "Install it once with: npm install -g openclaw",
            ].join("\n"),
          ),
        );
        return;
      }
      reject(error);
    });

    child.once("exit", (code, signal) => {
      if (signal) {
        resolve(1);
        return;
      }
      resolve(code ?? 1);
    });
  });
}

export async function runCli(argv: string[] = process.argv) {
  const normalizedArgv = normalizeWindowsArgv(argv);
  normalizeEnv();
  if (shouldEnsureCliPath(normalizedArgv)) {
    ensureOpenClawCliOnPath();
  }

  // Enforce the minimum supported runtime before doing any work.
  assertSupportedRuntime();

  // Show the animated DenchClaw banner early so it appears for ALL invocations
  // (bare `denchclaw`, subcommands, help, etc.). The bannerEmitted flag inside
  // emitCliBanner prevents double-emission from the route / preAction hooks.
  if (!shouldHideCliBanner(normalizedArgv, process.env)) {
    await emitCliBanner(VERSION, { argv: normalizedArgv });
  }

  // Bare `denchclaw` gets a minimal welcome flow: the Dench Cloud banner plus
  // a single "Continue with Dench.com" action. The full local setup pipeline
  // is reachable explicitly via `denchclaw bootstrap`.
  if (isBareDenchclawInvocation(normalizedArgv)) {
    const { runDenchCloudWelcome } = await import("./dench-cloud-welcome.js");
    await runDenchCloudWelcome();
    return;
  }

  const parseArgv = rewriteUpdateFlagArgv(normalizedArgv);
  if (shouldDelegateToGlobalOpenClaw(parseArgv)) {
    const exitCode = await delegateToGlobalOpenClaw(parseArgv);
    process.exitCode = exitCode;
    return;
  }

  const { buildProgram } = await import("./program.js");
  const program = buildProgram();
  await program.parseAsync(parseArgv);
}

export function isCliMainModule(): boolean {
  return isMainModule({ currentFile: fileURLToPath(import.meta.url) });
}
