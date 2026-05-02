export const SKILL_TEMPLATE_IDS = ["linkedin-outreach"] as const;

export type SkillTemplateId = (typeof SKILL_TEMPLATE_IDS)[number];

export type SkillTemplate = {
  id: SkillTemplateId;
  title: string;
  summary: string;
  buildPrompt: () => string;
};

const LINKEDIN_OUTREACH_PROMPT = `I want to create a reusable DenchClaw skill for LinkedIn outreach.

Please help me turn this into a durable skill, not a one-off task. Start by interviewing me one question at a time so you can tailor the workflow to my actual use case before writing any files.

The skill should eventually help me run a repeatable LinkedIn outreach process. Before creating the final skill, gather enough context to understand:

- Who I want to reach and how narrowly the audience should be defined.
- What offer, ask, or reason for outreach should drive the message.
- Where the leads will come from, such as CRM records, CSVs, enrichment results, or manual lists.
- Which connected tools are available and should be used, such as CRM, Gmail, Calendar, Notion, HubSpot, enrichment, or web search.
- Whether the skill should draft messages only, ask for approval, or take automated follow-up actions.
- What tone, personalization style, and constraints the outreach should follow.
- What success criteria would make the skill useful enough to reuse.

After you have enough answers, create a SKILL.md for this LinkedIn outreach workflow. The skill should include a clear description that helps future agents know when to trigger it, step-by-step instructions, required inputs, safety checks, approval points, and examples of good output. Do not create the SKILL.md until you have asked the necessary follow-up questions and I have answered them.`;

export const SKILL_TEMPLATES: readonly SkillTemplate[] = [
  {
    id: "linkedin-outreach",
    title: "LinkedIn Outreach",
    summary: "Create a reusable skill for finding, personalizing, and managing LinkedIn outreach.",
    buildPrompt: () => LINKEDIN_OUTREACH_PROMPT,
  },
];

export function isSkillTemplateId(value: unknown): value is SkillTemplateId {
  return (
    typeof value === "string" &&
    (SKILL_TEMPLATE_IDS as readonly string[]).includes(value)
  );
}

export function getSkillTemplate(id: SkillTemplateId): SkillTemplate {
  return SKILL_TEMPLATES.find((template) => template.id === id) ?? SKILL_TEMPLATES[0];
}

export function buildSkillTemplatePrompt(id: SkillTemplateId): string {
  return getSkillTemplate(id).buildPrompt();
}
