import type { SkillTemplateDefinition } from "./types";

export const pipelineHygieneDigest: SkillTemplateDefinition = {
  id: "pipeline-hygiene-digest",
  title: "Pipeline Hygiene Digest",
  summary: "Surface stale deals, missing fields, and next-step gaps on a schedule.",
  category: "CRM hygiene",
  outcome:
    "A scheduled pipeline hygiene skill that reviews CRM quality, identifies stuck opportunities or missing next steps, and proposes cleanup actions.",
  requiredApps: [
    { slug: "hubspot", name: "HubSpot" },
    { slug: "salesforce", name: "Salesforce" },
    { slug: "slack", name: "Slack" },
  ],
  triggerModes: ["scheduled", "manual"],
  autonomy: "Updates CRM",
  interviewTopics: [
    "Which CRM stages, saved views, owners, or deal types should be audited.",
    "What counts as stale, incomplete, risky, or needing a next step.",
    "Which fields are required at each stage.",
    "Whether the skill may update tags, notes, tasks, or only produce a digest.",
    "Cadence, timezone, and preferred digest destination.",
    "How noisy the digest should be and which issues are worth suppressing.",
  ],
  skillInstructions: [
    "A pipeline audit workflow with stage-aware hygiene checks.",
    "Rules for adding CRM notes, tags, or tasks without overwriting user-authored data.",
    "A prioritized digest format with owners, risks, and recommended actions.",
    "Suppression and idempotency rules for recurring scheduled runs.",
    "A cron message for weekly or daily pipeline hygiene reviews.",
  ],
};
