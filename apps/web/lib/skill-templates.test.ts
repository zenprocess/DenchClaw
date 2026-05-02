import { describe, expect, it } from "vitest";
import {
  SKILL_TEMPLATES,
  buildSkillTemplatePrompt,
  getSkillTemplate,
  isSkillTemplateId,
  type SkillTemplateId,
} from "./skill-templates";

describe("skill templates", () => {
  it("exposes the LinkedIn Outreach starter template", () => {
    expect(SKILL_TEMPLATES).toHaveLength(1);
    expect(getSkillTemplate("linkedin-outreach").title).toBe("LinkedIn Outreach");
  });

  it("validates known template ids", () => {
    expect(isSkillTemplateId("linkedin-outreach")).toBe(true);
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
    const prompt = buildSkillTemplatePrompt("linkedin-outreach");

    expect(prompt).toContain("LinkedIn outreach");
    expect(prompt).toContain("one question at a time");
    expect(prompt).toContain("SKILL.md");
    expect(prompt).toContain("Do not create the SKILL.md until");
  });
});
