import type {
  SkillTemplateApp,
  SkillTemplateCategory,
  SkillTemplateDefinition,
} from "./types";

export const externalApps = {
  gmail: { slug: "gmail", name: "Gmail" },
  googleCalendar: { slug: "google-calendar", name: "Google Calendar" },
  hubspot: { slug: "hubspot", name: "HubSpot" },
  notion: { slug: "notion", name: "Notion" },
  slack: { slug: "slack", name: "Slack" },
  github: { slug: "github", name: "GitHub" },
  linkedin: { slug: "linkedin", name: "LinkedIn" },
} satisfies Record<string, SkillTemplateApp>;

const customerValidatedInstructions = [
  "Start from the user's current pressure and produce a ranked action queue before any long narrative; if the run produces a brief, cap the first section to the smallest useful skim.",
  "Default external communication and data writes to draft or review unless the skill instructions and the user's answers clearly authorize a narrow automated action.",
  "Attach evidence, confidence, missing-data caveats, and recommended next owner action to every scored lead, risk, cleanup suggestion, follow-up, or brief section.",
  "Ask the fewest setup questions needed, infer sane defaults from the selected template, and let the user override details later instead of front-loading configuration.",
  "For scheduled runs, suppress unchanged findings and explain what changed since the last run or last touchpoint before repeating a recommendation.",
] as const;

const categoryValidatedInstructions: Record<SkillTemplateCategory, readonly string[]> = {
  "Find Leads": [
    "Prioritize signal-backed opportunities over raw account volume; include disqualifiers, why-now rationale, and draft-only personalized outreach angles for each top lead.",
  ],
  "Follow Up": [
    "Differentiate champions, economic buyers, operators, and internal owners before drafting follow-up; keep follow-up sequences short and avoid generic checking-in language.",
  ],
  "Keep CRM Clean": [
    "Treat CRM mutations as high-risk: provide dry-run output, before/after diffs, audit reasons, manual-edit preservation, and approval gates before any bulk write.",
  ],
  "Prep Meetings": [
    "Lead with a 60-second skim: who, last touch, open asks, what changed, and the recommended CTA; demote static background unless it changes the meeting plan.",
  ],
  "Research Anything": [
    "Use source-quality tiers, prefer primary sources, cite exact support for material claims, and mark unverifiable claims as unable to verify instead of filling gaps.",
  ],
  "Hire People": [
    "Protect candidate experience: keep candidate-facing communication draft-only, respect stage-specific context, and route hiring-manager actions as concise decision prompts.",
  ],
  "Grow Customers": [
    "Surface anomaly-backed customer risks and expansion plays with evidence trails and CSM-led talk tracks; never turn relationship-sensitive guidance into auto-sent customer email by default.",
  ],
  "Run Founder Ops": [
    "Optimize for solo-founder time: avoid assumed teams or CRMs, write the actual draft or decision artifact, and call out missing business metrics instead of producing fill-in-the-blank templates.",
  ],
};

export function defineSkillTemplate(
  template: SkillTemplateDefinition,
): SkillTemplateDefinition {
  return {
    ...template,
    skillInstructions: [
      ...template.skillInstructions,
      ...customerValidatedInstructions,
      ...categoryValidatedInstructions[template.category],
    ],
  };
}
