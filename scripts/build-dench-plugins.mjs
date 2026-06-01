import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const plugins = [
  "extensions/dench-identity/index.ts",
  "extensions/dench-ai-gateway/index.ts",
];

function runEsbuild(entry) {
  const outfile = entry.replace(/\.ts$/, ".mjs");
  const args = [
    entry,
    "--bundle",
    "--platform=node",
    "--format=esm",
    `--outfile=${outfile}`,
    "--packages=external",
  ];

  const bun = spawnSync("bunx", ["esbuild", ...args], {
    cwd: root,
    stdio: "inherit",
  });
  if (bun.status === 0) {
    return;
  }

  const npx = spawnSync("npx", ["esbuild", ...args], {
    cwd: root,
    stdio: "inherit",
  });
  if (npx.status !== 0) {
    process.exit(npx.status ?? 1);
  }
}

for (const entry of plugins) {
  runEsbuild(entry);
}
