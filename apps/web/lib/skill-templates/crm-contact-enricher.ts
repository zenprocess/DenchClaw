import type { SkillTemplateDefinition } from "./types";

export const crmContactEnricher: SkillTemplateDefinition = {
  id: "crm-contact-enricher",
  title: "CRM Contact Enricher",
  summary: "Fill missing CRM context with sources, confidence, and next steps.",
  category: "CRM hygiene",
  outcome:
    "A reusable enrichment skill that finds missing contact and company details, updates CRM safely, and leaves clear source-backed notes.",
  triggerModes: ["manual", "scheduled"],
  autonomy: "Updates CRM",
  interviewTopics: [
    "Which CRM segment or fields should be enriched first.",
    "Required fields versus nice-to-have fields.",
    "Which sources are allowed for enrichment and whether paid enrichment tools are available.",
    "Confidence thresholds for writing directly to CRM versus reporting uncertainty.",
    "Overwrite policy for existing fields, user-authored notes, and conflicting data.",
    "How many records to process per run and how progress should be reported.",
  ],
  skillInstructions: [
    "A field-by-field enrichment workflow with source and confidence requirements.",
    "Deduplication and conflict handling rules before any CRM write.",
    "Additive CRM update instructions with clear notes for uncertain fields.",
    "Batch limits for manual and scheduled runs.",
    "Examples of enriched contact records and an audit-style summary.",
  ],
};
