import { describe, expect, it } from "vitest";
import {
  SKILL_TEMPLATES,
  buildSkillTemplatePrompt,
  getSkillTemplate,
  isSkillTemplateId,
  type SkillTemplateId,
} from "./skill-templates";

describe("skill templates", () => {
  it("exposes the GTM starter template pack", () => {
    expect(SKILL_TEMPLATES).toHaveLength(8);
    expect(SKILL_TEMPLATES.map((template) => template.id)).toEqual([
      "icp-outreach-builder",
      "target-account-list-builder",
      "morning-lead-research-brief",
      "crm-contact-enricher",
      "stale-thread-follow-up-agent",
      "meeting-prep-brief",
      "post-meeting-follow-through",
      "pipeline-hygiene-digest",
    ]);
    expect(getSkillTemplate("icp-outreach-builder").title).toBe("ICP Outreach Builder");
  });

  it("validates known template ids", () => {
    expect(isSkillTemplateId("icp-outreach-builder")).toBe(true);
    expect(isSkillTemplateId("pipeline-hygiene-digest")).toBe(true);
    expect(isSkillTemplateId("yc-outreach")).toBe(false);
    expect(isSkillTemplateId(null)).toBe(false);
  });

  it("throws when a known id is missing from the template registry", () => {
    const missingTemplateId = "missing-template" as SkillTemplateId;

    expect(() => getSkillTemplate(missingTemplateId)).toThrow(
      "Unknown skill template: missing-template",
    );
  });

  it("builds a reusable skill creation prompt", () => {
    const prompt = buildSkillTemplatePrompt("icp-outreach-builder");

    expect(prompt).toContain("ICP Outreach Builder");
    expect(prompt).toContain("one question at a time");
    expect(prompt).toContain("SKILL.md");
    expect(prompt).toContain("Do not create or edit any files until");
    expect(prompt).toContain("manual trigger and cron/scheduled agent messages");
    expect(prompt).toContain("send rules");
    expect(prompt).toContain("idempotency checks");
  });

  it("marks every template with UI metadata", () => {
    for (const template of SKILL_TEMPLATES) {
      expect(template.category).toBeTruthy();
      expect(template.outcome).toBeTruthy();
      expect(template.autonomy).toBeTruthy();
      expect(template.triggerModes.length).toBeGreaterThan(0);
      expect(template.interviewTopics.length).toBeGreaterThan(3);
      expect(template.skillInstructions.length).toBeGreaterThan(3);
    }
  });
});
