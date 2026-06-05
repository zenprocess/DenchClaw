import { describe, expect, it } from "vitest";
import {
  DENCH_COM_LOGIN_URL,
  isFunnelInteractive,
  renderDenchComFunnelBanner,
} from "./dench-funnel.js";

const tty = { stdin: { isTTY: true }, stdout: { isTTY: true } };

describe("dench.com funnel", () => {
  it("points at the dench.com sign-in page", () => {
    expect(DENCH_COM_LOGIN_URL).toBe("https://dench.com/login");
  });

  it("is interactive only in a real TTY without CI/--json", () => {
    expect(isFunnelInteractive(["node", "denchclaw"], {}, tty)).toBe(true);
  });

  it("is non-interactive when stdio is not a TTY", () => {
    expect(isFunnelInteractive(["node", "denchclaw"], {}, { stdin: {}, stdout: {} })).toBe(false);
    expect(
      isFunnelInteractive(["node", "denchclaw"], {}, { stdin: { isTTY: true }, stdout: {} }),
    ).toBe(false);
    expect(
      isFunnelInteractive(["node", "denchclaw"], {}, { stdin: {}, stdout: { isTTY: true } }),
    ).toBe(false);
  });

  it("is non-interactive under CI even with a TTY", () => {
    expect(isFunnelInteractive(["node", "denchclaw"], { CI: "true" }, tty)).toBe(false);
    expect(isFunnelInteractive(["node", "denchclaw"], { CI: "1" }, tty)).toBe(false);
  });

  it("is non-interactive when --json is present", () => {
    expect(isFunnelInteractive(["node", "denchclaw", "--json"], {}, tty)).toBe(false);
  });

  it("renders a banner that promotes the CRM offering", () => {
    const banner = renderDenchComFunnelBanner();
    expect(banner).toContain("D E N C H   C L O U D");
    expect(banner).toContain("fully-managed AI CRM");
    expect(banner).toContain("App Integrations");
  });
});
