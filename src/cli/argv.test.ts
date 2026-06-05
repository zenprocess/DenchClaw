import { describe, expect, it } from "vitest";
import {
  buildParseArgv,
  findFirstCommandIndex,
  getCommandPath,
  getFlagValue,
  getPositiveIntFlagValue,
  getPrimaryCommand,
  hasHelpOrVersion,
  hasRootVersionAlias,
  isBareInvocation,
  isLocalNamespace,
  shouldMigrateState,
  shouldMigrateStateFromPath,
  stripLocalNamespace,
} from "./argv.js";

describe("argv helpers", () => {
  it("detects help/version flags and root -v alias only in root-flag contexts", () => {
    expect(hasHelpOrVersion(["node", "denchclaw", "--help"])).toBe(true);
    expect(hasHelpOrVersion(["node", "denchclaw", "-V"])).toBe(true);
    expect(hasHelpOrVersion(["node", "denchclaw", "-v"])).toBe(true);
    expect(hasRootVersionAlias(["node", "denchclaw", "-v", "chat"])).toBe(false);
  });

  it("extracts flag values across --name value and --name=value forms", () => {
    expect(getFlagValue(["node", "denchclaw", "--profile", "dev"], "--profile")).toBe("dev");
    expect(getFlagValue(["node", "denchclaw", "--profile=team-a"], "--profile")).toBe("team-a");
    expect(getFlagValue(["node", "denchclaw", "--profile", "--verbose"], "--profile")).toBeNull();
    expect(getFlagValue(["node", "denchclaw", "--profile="], "--profile")).toBeNull();
  });

  it("parses positive integer flags and rejects invalid numeric values", () => {
    expect(getPositiveIntFlagValue(["node", "denchclaw", "--port", "19001"], "--port")).toBe(19001);
    expect(getPositiveIntFlagValue(["node", "denchclaw", "--port", "0"], "--port")).toBeUndefined();
    expect(
      getPositiveIntFlagValue(["node", "denchclaw", "--port", "-1"], "--port"),
    ).toBeUndefined();
    expect(
      getPositiveIntFlagValue(["node", "denchclaw", "--port", "abc"], "--port"),
    ).toBeUndefined();
  });

  it("derives command path while skipping leading flags and stopping at terminator", () => {
    // Low-level parser skips flag tokens but not their values.
    expect(getCommandPath(["node", "denchclaw", "--profile", "dev", "chat"], 2)).toEqual([
      "dev",
      "chat",
    ]);
    expect(getCommandPath(["node", "denchclaw", "config", "get"], 2)).toEqual(["config", "get"]);
    expect(getCommandPath(["node", "denchclaw", "--", "chat", "send"], 2)).toEqual([]);
    expect(getPrimaryCommand(["node", "denchclaw", "--verbose", "status"])).toBe("status");
  });

  it("builds parse argv consistently across runtime invocation styles", () => {
    expect(
      buildParseArgv({
        programName: "denchclaw",
        rawArgs: ["node", "cli.js", "status"],
      }),
    ).toEqual(["node", "cli.js", "status"]);

    expect(
      buildParseArgv({
        programName: "denchclaw",
        rawArgs: ["denchclaw", "status"],
      }),
    ).toEqual(["node", "denchclaw", "status"]);

    expect(
      buildParseArgv({
        programName: "denchclaw",
        rawArgs: ["node-22.12.0.exe", "cli.js", "agent", "run"],
      }),
    ).toEqual(["node-22.12.0.exe", "cli.js", "agent", "run"]);

    expect(
      buildParseArgv({
        programName: "denchclaw",
        rawArgs: ["bun", "cli.ts", "status"],
      }),
    ).toEqual(["bun", "cli.ts", "status"]);
  });

  it("skips state migration for read-only command paths and keeps mutations enabled for others", () => {
    expect(shouldMigrateStateFromPath([])).toBe(true);
    expect(shouldMigrateStateFromPath(["health"])).toBe(false);
    expect(shouldMigrateStateFromPath(["status"])).toBe(false);
    expect(shouldMigrateStateFromPath(["sessions"])).toBe(false);
    expect(shouldMigrateStateFromPath(["config", "get"])).toBe(false);
    expect(shouldMigrateStateFromPath(["models", "list"])).toBe(false);
    expect(shouldMigrateStateFromPath(["memory", "status"])).toBe(false);
    expect(shouldMigrateStateFromPath(["agent"])).toBe(false);
    expect(shouldMigrateStateFromPath(["chat", "send"])).toBe(true);

    expect(shouldMigrateState(["node", "denchclaw", "health"])).toBe(false);
    expect(shouldMigrateState(["node", "denchclaw", "chat", "send"])).toBe(true);
  });
});

describe("local namespace helpers", () => {
  it("finds the first positional command index while skipping root flags", () => {
    expect(findFirstCommandIndex(["node", "denchclaw", "local"])).toBe(2);
    expect(findFirstCommandIndex(["node", "denchclaw", "local", "bootstrap"])).toBe(2);
    expect(findFirstCommandIndex(["node", "denchclaw", "--profile", "dench", "local"])).toBe(4);
    expect(findFirstCommandIndex(["node", "denchclaw", "--profile=dench", "local"])).toBe(3);
    expect(findFirstCommandIndex(["node", "denchclaw", "--verbose", "status"])).toBe(3);
  });

  it("returns null when there is no positional command token", () => {
    expect(findFirstCommandIndex(["node", "denchclaw"])).toBeNull();
    expect(findFirstCommandIndex(["node", "denchclaw", "--help"])).toBeNull();
    expect(findFirstCommandIndex(["node", "denchclaw", "--profile", "dench"])).toBeNull();
    expect(findFirstCommandIndex(["node", "denchclaw", "--", "local"])).toBeNull();
  });

  it("detects the local namespace only when it is the first command token", () => {
    expect(isLocalNamespace(["node", "denchclaw", "local"])).toBe(true);
    expect(isLocalNamespace(["node", "denchclaw", "local", "bootstrap"])).toBe(true);
    expect(isLocalNamespace(["node", "denchclaw", "--profile", "dench", "local", "sessions"])).toBe(
      true,
    );
    expect(isLocalNamespace(["node", "denchclaw"])).toBe(false);
    expect(isLocalNamespace(["node", "denchclaw", "--help"])).toBe(false);
    expect(isLocalNamespace(["node", "denchclaw", "--version"])).toBe(false);
    expect(isLocalNamespace(["node", "denchclaw", "chat"])).toBe(false);
    expect(isLocalNamespace(["node", "denchclaw", "--", "local"])).toBe(false);
  });

  it("strips a single leading local token while preserving root flags", () => {
    expect(stripLocalNamespace(["node", "denchclaw", "local"])).toEqual(["node", "denchclaw"]);
    expect(stripLocalNamespace(["node", "denchclaw", "local", "bootstrap"])).toEqual([
      "node",
      "denchclaw",
      "bootstrap",
    ]);
    expect(
      stripLocalNamespace(["node", "denchclaw", "--profile", "dench", "local", "sessions"]),
    ).toEqual(["node", "denchclaw", "--profile", "dench", "sessions"]);
    // Only the first local token is removed; a later one is left intact.
    expect(stripLocalNamespace(["node", "denchclaw", "local", "local"])).toEqual([
      "node",
      "denchclaw",
      "local",
    ]);
  });

  it("returns argv unchanged when there is no leading local token", () => {
    const argv = ["node", "denchclaw", "chat"];
    expect(stripLocalNamespace(argv)).toEqual(argv);
    expect(stripLocalNamespace(["node", "denchclaw"])).toEqual(["node", "denchclaw"]);
    expect(stripLocalNamespace(["node", "denchclaw", "--", "local"])).toEqual([
      "node",
      "denchclaw",
      "--",
      "local",
    ]);
  });

  it("detects a truly bare invocation with no command tokens or flags", () => {
    expect(isBareInvocation(["node", "denchclaw"])).toBe(true);
    expect(isBareInvocation(["node", "denchclaw", ""])).toBe(true);
    expect(isBareInvocation(["node", "denchclaw", "   "])).toBe(true);
    expect(isBareInvocation(["node", "denchclaw", "--help"])).toBe(false);
    expect(isBareInvocation(["node", "denchclaw", "--json"])).toBe(false);
    expect(isBareInvocation(["node", "denchclaw", "local"])).toBe(false);
    expect(isBareInvocation(["node", "denchclaw", "foobar"])).toBe(false);
  });
});
