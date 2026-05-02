import type { SkillTemplateDefinition } from "./types";

export const targetAccountListBuilder: SkillTemplateDefinition = {
  id: "target-account-list-builder",
  title: "Target Account List Builder",
  summary: "Find, rank, and seed the first set of target accounts into CRM.",
  category: "Find leads",
  outcome:
    "A reusable prospecting skill that turns an ICP into a ranked list of target companies or contacts, with evidence and next actions saved into Dench CRM.",
  triggerModes: ["manual", "scheduled"],
  autonomy: "Updates CRM",
  interviewTopics: [
    "The market segment, target account traits, and hard disqualifiers.",
    "Whether the output should be companies, people, or both.",
    "Preferred sources for discovery and enrichment, including web search, CRM, HubSpot, Notion, or user-provided lists.",
    "Ranking criteria such as fit, urgency signals, funding, hiring, tech stack, geography, or recent news.",
    "How many accounts to create per run and what minimum confidence is required.",
    "Which CRM fields, notes, tags, and source links should be added.",
  ],
  skillInstructions: [
    "A repeatable account discovery and ranking process with source attribution.",
    "A CRM write policy that avoids duplicates and explains how to merge with existing records.",
    "A scoring rubric that future agents can apply consistently.",
    "Output examples for account summaries, contact suggestions, and recommended next actions.",
    "A scheduled digest option for finding a small number of new targets each week.",
  ],
};
