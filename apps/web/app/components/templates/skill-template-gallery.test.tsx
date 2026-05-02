// @vitest-environment jsdom

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { SkillTemplateGallery } from "./skill-template-gallery";

describe("SkillTemplateGallery", () => {
  it("filters templates by search query", async () => {
    const user = userEvent.setup();

    render(
      <SkillTemplateGallery
        selectedTemplateId="icp-outreach-builder"
        onSelectTemplate={() => {}}
      />,
    );

    await user.type(screen.getByLabelText("Search templates"), "meeting prep");

    expect(
      screen.getByRole("button", { name: /Meeting Prep Brief/i }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /ICP Outreach Builder/i }),
    ).not.toBeInTheDocument();
  });

  it("filters templates by category chip", async () => {
    const user = userEvent.setup();

    render(
      <SkillTemplateGallery
        selectedTemplateId="icp-outreach-builder"
        onSelectTemplate={() => {}}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Meetings" }));

    expect(
      screen.getByRole("button", { name: /Meeting Prep Brief/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Post-Meeting Follow-Through/i }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /ICP Outreach Builder/i }),
    ).not.toBeInTheDocument();
  });

  it("calls selection callback from accessible card action", async () => {
    const user = userEvent.setup();
    const onSelectTemplate = vi.fn();

    render(
      <SkillTemplateGallery
        selectedTemplateId="icp-outreach-builder"
        onSelectTemplate={onSelectTemplate}
        actionLabel="Start"
      />,
    );

    const templateCard = screen.getByRole("button", {
      name: /Morning Lead Research Brief/i,
    });

    expect(templateCard).toHaveAccessibleName(/Start/i);

    await user.click(templateCard);

    expect(onSelectTemplate).toHaveBeenCalledWith("morning-lead-research-brief");
  });
});
