import { crmContactEnricher } from "./skill-templates/crm-contact-enricher";
import { icpOutreachBuilder } from "./skill-templates/icp-outreach-builder";
import { meetingPrepBrief } from "./skill-templates/meeting-prep-brief";
import { morningLeadResearchBrief } from "./skill-templates/morning-lead-research-brief";
import { pipelineHygieneDigest } from "./skill-templates/pipeline-hygiene-digest";
import { postMeetingFollowThrough } from "./skill-templates/post-meeting-follow-through";
import { buildGtmSkillPrompt } from "./skill-templates/prompt";
import { staleThreadFollowUpAgent } from "./skill-templates/stale-thread-follow-up-agent";
import { targetAccountListBuilder } from "./skill-templates/target-account-list-builder";
import {
  SKILL_TEMPLATE_IDS,
  type SkillTemplate,
  type SkillTemplateDefinition,
  type SkillTemplateId,
} from "./skill-templates/types";

export {
  SKILL_TEMPLATE_CATEGORIES,
  SKILL_TEMPLATE_IDS,
  type SkillTemplate,
  type SkillTemplateAutonomy,
  type SkillTemplateCategory,
  type SkillTemplateId,
  type SkillTemplateTriggerMode,
} from "./skill-templates/types";

const TEMPLATE_DEFINITIONS: readonly SkillTemplateDefinition[] = [
  icpOutreachBuilder,
  targetAccountListBuilder,
  morningLeadResearchBrief,
  crmContactEnricher,
  staleThreadFollowUpAgent,
  meetingPrepBrief,
  postMeetingFollowThrough,
  pipelineHygieneDigest,
];

export const SKILL_TEMPLATES: readonly SkillTemplate[] = [
  ...TEMPLATE_DEFINITIONS.map((template) => ({
    ...template,
    buildPrompt: () => buildGtmSkillPrompt(template),
  })),
];

export function isSkillTemplateId(value: unknown): value is SkillTemplateId {
  return (
    typeof value === "string" &&
    (SKILL_TEMPLATE_IDS as readonly string[]).includes(value)
  );
}

export function getSkillTemplate(id: SkillTemplateId): SkillTemplate {
  const template = SKILL_TEMPLATES.find((candidate) => candidate.id === id);
  if (!template) {
    throw new Error(`Unknown skill template: ${id}`);
  }
  return template;
}

export function buildSkillTemplatePrompt(id: SkillTemplateId): string {
  return getSkillTemplate(id).buildPrompt();
}
