import type { SkillTemplateDefinition } from "./types";

export const icpOutreachBuilder: SkillTemplateDefinition = {
  id: "icp-outreach-builder",
  title: "ICP Outreach Builder",
  summary: "Turn an ICP, offer, and lead source into reusable personalized outreach.",
  category: "Find leads",
  outcome:
    "A repeatable outreach skill that finds or accepts target leads, researches each person, writes personalized messages, and follows a configured send or approval policy.",
  requiredApps: [
    { slug: "gmail", name: "Gmail" },
    { slug: "hubspot", name: "HubSpot" },
    { slug: "apollo", name: "Apollo" },
  ],
  triggerModes: ["manual", "scheduled"],
  autonomy: "Can automate",
  interviewTopics: [
    "The exact ICP, buyer persona, geography, company size, and exclusion criteria.",
    "The offer, call to action, proof points, and why this audience should care now.",
    "Where leads should come from: Dench CRM, manual lists, enrichment, web search, HubSpot, Notion, or another source.",
    "Personalization depth, voice, message length, and channels to prepare for.",
    "Whether the skill should draft only, batch for approval, or send automatically after rules are configured.",
    "Follow-up cadence, send caps, stop rules, and what should be written back to CRM.",
  ],
  skillInstructions: [
    "A clear trigger description for when future agents should use the outreach skill.",
    "Step-by-step research, personalization, drafting, sending, follow-up, and CRM logging instructions.",
    "Required inputs and sensible defaults for ICP, offer, source list, tone, cadence, and limits.",
    "Safety checks for duplicate outreach, reply detection, blocked domains, and disallowed recipients.",
    "Examples of high-quality personalized outputs and a cron message for scheduled follow-up runs.",
  ],
};
