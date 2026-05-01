// @vitest-environment jsdom

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { BulkActionBar } from "./bulk-action-bar";

/**
 * Visibility + behavior contract for `BulkActionBar`.
 *
 * Why this exists: the bar drives the row-selection UI surface. Two
 * regressions matter most:
 *  1. The bar must not render when nothing is selected (otherwise it
 *     would obscure the table on every interaction).
 *  2. The Enrich button is conditional on the parent passing
 *     `onBulkEnrich`. Object tables only pass it when at least one
 *     enrichable column exists. Showing the button on a table with no
 *     enrichable columns would be a no-op control — exactly the kind of
 *     dead UI the user notices and complains about.
 */

const noop = () => {};

describe("BulkActionBar", () => {
  it("renders nothing when selectedCount is 0 (no chrome over an unselected table)", () => {
    const { container } = render(
      <BulkActionBar
        selectedCount={0}
        actions={[]}
        onDeselectAll={noop}
        onBulkAction={noop}
        onBulkDelete={noop}
      />,
    );
    expect(container.firstChild).toBeNull();
  });

  it("shows Delete and the selected-count badge when a row selection exists", () => {
    render(
      <BulkActionBar
        selectedCount={3}
        actions={[]}
        onDeselectAll={noop}
        onBulkAction={noop}
        onBulkDelete={noop}
      />,
    );
    expect(screen.getByText("3")).toBeInTheDocument();
    expect(screen.getByText("selected")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /delete/i })).toBeInTheDocument();
    // Enrich is omitted when the parent doesn't pass a handler.
    expect(screen.queryByRole("button", { name: /enrich/i })).not.toBeInTheDocument();
  });

  it(
    "renders the Enrich button when onBulkEnrich is provided and invokes it on click " +
      "(this is the row-selection 'enrich the rows I checked' action)",
    async () => {
      const onBulkEnrich = vi.fn();
      const user = userEvent.setup();
      render(
        <BulkActionBar
          selectedCount={2}
          actions={[]}
          onDeselectAll={noop}
          onBulkAction={noop}
          onBulkDelete={noop}
          onBulkEnrich={onBulkEnrich}
        />,
      );
      const enrichBtn = screen.getByRole("button", { name: /enrich/i });
      expect(enrichBtn).toBeInTheDocument();
      expect(enrichBtn).not.toBeDisabled();
      await user.click(enrichBtn);
      expect(onBulkEnrich).toHaveBeenCalledTimes(1);
    },
  );

  it(
    "REGRESSION: omits the Enrich button when onBulkEnrich is undefined " +
      "(object table passes undefined when no column on the object is enrichable; " +
      "showing a no-op button would be dead UI)",
    () => {
      render(
        <BulkActionBar
          selectedCount={5}
          actions={[]}
          onDeselectAll={noop}
          onBulkAction={noop}
          onBulkDelete={noop}
          onBulkEnrich={undefined}
        />,
      );
      expect(screen.queryByRole("button", { name: /enrich/i })).not.toBeInTheDocument();
      // Delete still present — the bar is not entirely empty.
      expect(screen.getByRole("button", { name: /delete/i })).toBeInTheDocument();
    },
  );

  it("disables the Enrich button while enrichBusy is true (avoids overlapping enrichment runs)", async () => {
    const onBulkEnrich = vi.fn();
    const user = userEvent.setup();
    render(
      <BulkActionBar
        selectedCount={1}
        actions={[]}
        onDeselectAll={noop}
        onBulkAction={noop}
        onBulkDelete={noop}
        onBulkEnrich={onBulkEnrich}
        enrichBusy
      />,
    );
    const enrichBtn = screen.getByRole("button", { name: /enrich/i });
    expect(enrichBtn).toBeDisabled();
    await user.click(enrichBtn);
    expect(onBulkEnrich).not.toHaveBeenCalled();
  });

  it("Clear button calls onDeselectAll", async () => {
    const onDeselectAll = vi.fn();
    const user = userEvent.setup();
    render(
      <BulkActionBar
        selectedCount={4}
        actions={[]}
        onDeselectAll={onDeselectAll}
        onBulkAction={noop}
        onBulkDelete={noop}
      />,
    );
    await user.click(screen.getByRole("button", { name: /clear/i }));
    expect(onDeselectAll).toHaveBeenCalledTimes(1);
  });
});
