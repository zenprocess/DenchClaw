import { spawn } from "node:child_process";
import process from "node:process";
import { confirm, isCancel } from "@clack/prompts";
import gradient from "gradient-string";
import { isTruthyEnvValue } from "../infra/env.js";
import { visibleWidth } from "../terminal/ansi.js";
import { stylePromptMessage } from "../terminal/prompt-style.js";
import { isRich, theme } from "../terminal/theme.js";

/**
 * Marketing destination for the top-level `npx denchclaw` funnel. People who run
 * the bare command are most often evaluating an AI CRM, so we point them at the
 * fully-managed product. DenchClaw itself stays available under `denchclaw local`.
 */
export const DENCH_COM_LOGIN_URL = "https://dench.com/login";

/**
 * The funnel only runs in a real interactive terminal. Piped/redirected stdio,
 * CI, and `--json` invocations get a silent exit so scripts and automation are
 * never blocked on a prompt.
 */
export function isFunnelInteractive(
  argv: string[],
  env: NodeJS.ProcessEnv = process.env,
  io: { stdin?: { isTTY?: boolean }; stdout?: { isTTY?: boolean } } = process,
): boolean {
  if (argv.includes("--json")) {
    return false;
  }
  if (isTruthyEnvValue(env.CI)) {
    return false;
  }
  return Boolean(io.stdin?.isTTY && io.stdout?.isTTY);
}

/**
 * Renders the Dench Cloud promotion banner shown at the top of the funnel. This
 * is intentionally a standalone copy (not imported from the heavy bootstrap
 * module) so the bare `npx denchclaw` path stays cheap, and so the funnel copy
 * can evolve independently of the bootstrap recommendation banner.
 */
export function renderDenchComFunnelBanner(): string {
  const rich = isRich();
  const W = 74;

  const bdr = (s: string) => (rich ? theme.accentDim(s) : s);
  const ironShimmer = rich
    ? gradient(["#374151", "#6B7280", "#9CA3AF", "#D1D5DB", "#9CA3AF", "#6B7280", "#374151"])
    : (s: string) => s;
  const topBar = ironShimmer("─".repeat(W));
  const botBar = ironShimmer("─".repeat(W));
  const top = `  ${bdr("╭")}${topBar}${bdr("╮")}`;
  const bot = `  ${bdr("╰")}${botBar}${bdr("╯")}`;
  const blank = `  ${bdr("│")}${" ".repeat(W)}${bdr("│")}`;

  const row = (content: string, indent = 4): string => {
    const vis = visibleWidth(content);
    const right = Math.max(1, W - indent - vis);
    return `  ${bdr("│")}${" ".repeat(indent)}${content}${" ".repeat(right)}${bdr("│")}`;
  };

  const title = rich
    ? gradient(["#38BDF8", "#2DD4BF", "#34D399"])("D E N C H   C L O U D")
    : "D E N C H   C L O U D";
  const subtitle = rich
    ? theme.muted("The complete, fully-managed AI CRM. Everything is set up for you.")
    : "The complete, fully-managed AI CRM. Everything is set up for you.";

  const bullet = rich ? theme.info("▸") : "▸";
  const lbl = (s: string) => (rich ? theme.accentBright(s) : s);
  const dim = (s: string) => (rich ? theme.muted(s) : s);
  const COL = 14;
  const features: [string, string][] = [
    [lbl("AI Models"), dim("Claude, GPT, Kimi & more — no API keys needed")],
    [lbl("Voice"), dim("ElevenLabs built in — no account required")],
    [lbl("Web Search"), dim("Exa ready out of the box — no key to manage")],
    [lbl("Skills Store"), dim("Browse & install skills instantly")],
    [lbl("Image Gen"), dim("State-of-the-art models from day one")],
  ];
  const featureLines = features.map(([name, desc]) => {
    const gap = " ".repeat(Math.max(1, COL - visibleWidth(name)));
    return `${bullet}  ${name}${gap}${desc}`;
  });

  const star = rich ? theme.warn("★") : "★";
  const intTitle = rich ? theme.warn("1,000+ App Integrations") : "1,000+ App Integrations";
  const dot = rich ? theme.accentDim(" · ") : " · ";
  const apps = [
    rich ? theme.info("Gmail") : "Gmail",
    rich ? theme.accentBright("Notion") : "Notion",
    rich ? theme.success("HubSpot") : "HubSpot",
    rich ? theme.warn("PostHog") : "PostHog",
    rich ? theme.accent("Stripe") : "Stripe",
    rich ? theme.success("Salesforce") : "Salesforce",
    rich ? theme.muted("…") : "…",
  ].join(dot);

  const check = rich ? theme.success("✓") : "✓";
  const cta = rich ? theme.success("Recommended for most users") : "Recommended for most users";

  return [
    "",
    top,
    blank,
    row(title),
    row(subtitle),
    blank,
    ...featureLines.map((l) => row(l)),
    blank,
    row(`${star}  ${intTitle}`),
    row(apps, 7),
    blank,
    row(`${check}  ${cta}`),
    blank,
    bot,
    "",
  ].join("\n");
}

/**
 * Opens a URL in the user's default browser. Best-effort: resolves false when no
 * opener is available or the launch fails, so the caller can degrade gracefully.
 */
async function openUrl(url: string): Promise<boolean> {
  const argv =
    process.platform === "darwin"
      ? ["open", url]
      : process.platform === "win32"
        ? ["cmd", "/c", "start", "", url]
        : ["xdg-open", url];
  const [cmd, ...args] = argv;
  if (!cmd) {
    return false;
  }
  return new Promise<boolean>((resolve) => {
    const child = spawn(cmd, args, {
      stdio: "ignore",
      ...(process.platform === "win32" ? { shell: true, windowsHide: true } : {}),
    });
    const timer = setTimeout(() => {
      child.kill();
      resolve(false);
    }, 5_000);
    child.once("close", (code) => {
      clearTimeout(timer);
      resolve(code === 0);
    });
    child.once("error", () => {
      clearTimeout(timer);
      resolve(false);
    });
  });
}

/**
 * Runs the bare `npx denchclaw` marketing funnel: show the Dench Cloud banner,
 * ask whether the user wants the complete CRM solution, and either open the
 * dench.com sign-in page (yes) or exit cleanly (no). Non-interactive contexts
 * exit silently. Always resolves with exit code 0 semantics.
 */
export async function runDenchComFunnel(
  argv: string[],
  env: NodeJS.ProcessEnv = process.env,
): Promise<void> {
  if (!isFunnelInteractive(argv, env)) {
    return;
  }

  process.stdout.write(`${renderDenchComFunnelBanner()}\n`);

  const wantsCrm = await confirm({
    message: stylePromptMessage("Want the complete, fully-managed AI CRM at dench.com?"),
    initialValue: true,
  });

  if (isCancel(wantsCrm) || !wantsCrm) {
    return;
  }

  process.stdout.write(`\n${theme.muted(`Opening ${DENCH_COM_LOGIN_URL} …`)}\n`);
  const opened = await openUrl(DENCH_COM_LOGIN_URL);
  if (!opened) {
    process.stdout.write(
      `${theme.muted(`Couldn't open your browser. Visit ${DENCH_COM_LOGIN_URL} to sign in.`)}\n`,
    );
  }
}
