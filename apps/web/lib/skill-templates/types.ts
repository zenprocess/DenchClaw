export const SKILL_TEMPLATE_IDS = [
  "icp-outreach-builder",
  "target-account-list-builder",
  "morning-lead-research-brief",
  "crm-contact-enricher",
  "stale-thread-follow-up-agent",
  "meeting-prep-brief",
  "post-meeting-follow-through",
  "pipeline-hygiene-digest",
] as const;

export type SkillTemplateId = (typeof SKILL_TEMPLATE_IDS)[number];

export type SkillTemplateCategory =
  | "Find leads"
  | "Research"
  | "Follow up"
  | "Meetings"
  | "CRM hygiene";

export type SkillTemplateTriggerMode = "manual" | "scheduled";

export type SkillTemplateAutonomy =
  | "Creates drafts"
  | "Updates CRM"
  | "Can automate";

export type SkillTemplate = {
  id: SkillTemplateId;
  title: string;
  summary: string;
  category: SkillTemplateCategory;
  outcome: string;
  triggerModes: readonly SkillTemplateTriggerMode[];
  autonomy: SkillTemplateAutonomy;
  interviewTopics: readonly string[];
  skillInstructions: readonly string[];
  buildPrompt: () => string;
};

export type SkillTemplateDefinition = Omit<SkillTemplate, "buildPrompt">;
