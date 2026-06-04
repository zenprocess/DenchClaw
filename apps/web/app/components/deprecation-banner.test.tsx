// @vitest-environment jsdom

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { DeprecationBanner } from "./deprecation-banner";

describe("DeprecationBanner", () => {
  it("renders the one-line message and dench.com link", () => {
    render(<DeprecationBanner />);

    expect(screen.getByTestId("deprecation-banner")).toBeInTheDocument();
    expect(screen.getByText(/For the latest features, go to/i)).toBeInTheDocument();

    const cta = screen.getByTestId("deprecation-banner-cta");
    expect(cta).toHaveAttribute("href", "https://dench.com");
    expect(cta).toHaveAttribute("target", "_blank");
    expect(cta).toHaveTextContent("dench.com");
  });
});
