import { describe, it, expect } from "vitest";
import {
  isBareDenchclawInvocation,
  shouldHideCliBanner,
  shouldEnsureCliPath,
  shouldDelegateToGlobalOpenClaw,
} from "./run-main.js";

describe("run-main bare invocation welcome flow", () => {
  it("detects bare denchclaw invocations", () => {
    expect(isBareDenchclawInvocation(["node", "denchclaw"])).toBe(true);
  });

  it("does not treat subcommand invocations as bare", () => {
    expect(isBareDenchclawInvocation(["node", "denchclaw", "bootstrap"])).toBe(false);
    expect(isBareDenchclawInvocation(["node", "denchclaw", "chat"])).toBe(false);
  });

  it("does not treat help/version invocations as bare", () => {
    expect(isBareDenchclawInvocation(["node", "denchclaw", "--help"])).toBe(false);
    expect(isBareDenchclawInvocation(["node", "denchclaw", "--version"])).toBe(false);
  });

  it("does not treat non-denchclaw CLIs as bare", () => {
    expect(isBareDenchclawInvocation(["node", "openclaw"])).toBe(false);
  });
});

describe("run-main delegation and path guards", () => {
  it("skips CLI path bootstrap for read-only status/help commands", () => {
    expect(shouldEnsureCliPath(["node", "denchclaw", "--help"])).toBe(false);
    expect(shouldEnsureCliPath(["node", "denchclaw", "status"])).toBe(false);
    expect(shouldEnsureCliPath(["node", "denchclaw", "health"])).toBe(false);
    expect(shouldEnsureCliPath(["node", "denchclaw", "sessions"])).toBe(false);
    expect(shouldEnsureCliPath(["node", "denchclaw", "config", "get"])).toBe(false);
    expect(shouldEnsureCliPath(["node", "denchclaw", "models", "list"])).toBe(false);
    expect(shouldEnsureCliPath(["node", "denchclaw", "chat", "send"])).toBe(true);
  });

  it("delegates non-core commands to OpenClaw and never delegates core CLI commands", () => {
    expect(shouldDelegateToGlobalOpenClaw(["node", "denchclaw", "chat"])).toBe(true);
    expect(shouldDelegateToGlobalOpenClaw(["node", "denchclaw", "bootstrap"])).toBe(false);
    expect(shouldDelegateToGlobalOpenClaw(["node", "denchclaw", "update"])).toBe(false);
    expect(shouldDelegateToGlobalOpenClaw(["node", "denchclaw", "stop"])).toBe(false);
    expect(shouldDelegateToGlobalOpenClaw(["node", "denchclaw", "start"])).toBe(false);
    expect(shouldDelegateToGlobalOpenClaw(["node", "denchclaw", "restart"])).toBe(false);
    expect(shouldDelegateToGlobalOpenClaw(["node", "denchclaw", "telemetry"])).toBe(false);
    expect(shouldDelegateToGlobalOpenClaw(["node", "denchclaw"])).toBe(false);
  });

  it("does not delegate telemetry subcommands to OpenClaw (prevents 'unknown command' error)", () => {
    expect(shouldDelegateToGlobalOpenClaw(["node", "denchclaw", "telemetry", "status"])).toBe(
      false,
    );
    expect(
      shouldDelegateToGlobalOpenClaw(["node", "denchclaw", "telemetry", "privacy", "on"]),
    ).toBe(false);
    expect(
      shouldDelegateToGlobalOpenClaw(["node", "denchclaw", "telemetry", "privacy", "off"]),
    ).toBe(false);
  });

  it("disables delegation when explicit env disable flag is set", () => {
    expect(
      shouldDelegateToGlobalOpenClaw(["node", "denchclaw", "chat"], {
        DENCHCLAW_DISABLE_OPENCLAW_DELEGATION: "1",
      }),
    ).toBe(false);
    expect(
      shouldDelegateToGlobalOpenClaw(["node", "denchclaw", "chat"], {
        OPENCLAW_DISABLE_OPENCLAW_DELEGATION: "true",
      }),
    ).toBe(false);
  });
});

describe("run-main banner visibility", () => {
  it("keeps banner visible for update/start/stop lifecycle commands", () => {
    expect(shouldHideCliBanner(["node", "denchclaw", "update"])).toBe(false);
    expect(shouldHideCliBanner(["node", "denchclaw", "start"])).toBe(false);
    expect(shouldHideCliBanner(["node", "denchclaw", "stop"])).toBe(false);
  });

  it("hides banner only for completion and plugin-update helper commands", () => {
    expect(shouldHideCliBanner(["node", "denchclaw", "completion"])).toBe(true);
    expect(shouldHideCliBanner(["node", "denchclaw", "plugins", "update"])).toBe(true);
    expect(shouldHideCliBanner(["node", "denchclaw", "chat"])).toBe(false);
  });
});
