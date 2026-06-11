import { spawn } from "node:child_process";
import process from "node:process";
import { isCancel, select } from "@clack/prompts";
import { stylePromptMessage } from "../terminal/prompt-style.js";
import { isRich, theme } from "../terminal/theme.js";
import { renderDenchCloudRecommendationBanner } from "./dench-cloud-banner.js";

export const DENCH_LOGIN_URL = "https://dench.com/login";

async function openUrlInBrowser(url: string): Promise<boolean> {
  const [command, ...args] =
    process.platform === "darwin"
      ? ["open", url]
      : process.platform === "win32"
        ? ["cmd", "/c", "start", "", url]
        : ["xdg-open", url];
  return await new Promise<boolean>((resolve) => {
    const child = spawn(command, args, { stdio: "ignore", detached: true });
    child.once("error", () => resolve(false));
    child.once("spawn", () => {
      child.unref();
      resolve(true);
    });
  });
}

/**
 * The bare `npx denchclaw` flow: show the Dench Cloud banner, offer a single
 * "Continue with Dench.com" action that opens dench.com/login, then end the
 * session. The full local setup lives under `npx denchclaw bootstrap`.
 */
export async function runDenchCloudWelcome(): Promise<void> {
  const log = (line: string) => process.stdout.write(`${line}\n`);
  log(renderDenchCloudRecommendationBanner());

  const interactive = Boolean(process.stdin.isTTY && process.stdout.isTTY);
  if (!interactive) {
    log(`Continue with Dench.com: ${DENCH_LOGIN_URL}`);
    return;
  }

  const choice = await select({
    message: stylePromptMessage("Get started with Dench Cloud"),
    options: [{ value: "continue", label: "Continue with Dench.com" }],
  });
  if (isCancel(choice)) {
    return;
  }

  const opened = await openUrlInBrowser(DENCH_LOGIN_URL);
  const rich = isRich();
  const url = rich ? theme.accentBright(DENCH_LOGIN_URL) : DENCH_LOGIN_URL;
  log("");
  log(opened ? `  Opening ${url} in your browser…` : `  Open ${url} in your browser to continue.`);
  log("");
}
