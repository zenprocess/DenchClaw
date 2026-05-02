import type { SkillTemplateDefinition } from "./types";

export const morningLeadResearchBrief: SkillTemplateDefinition = {
  id: "morning-lead-research-brief",
  title: "Morning Lead Research Brief",
  summary: "Get a scheduled brief of lead signals and the next best GTM actions.",
  category: "Research",
  outcome:
    "A scheduled research skill that reviews priority leads and accounts each morning, finds fresh signals, and produces a concise action brief.",
  requiredApps: [
    { slug: "hubspot", name: "HubSpot" },
    { slug: "gmail", name: "Gmail" },
    { slug: "google-calendar", name: "Google Calendar" },
  ],
  triggerModes: ["scheduled", "manual"],
  autonomy: "Creates drafts",
  interviewTopics: [
    "Which leads, accounts, saved CRM views, tags, or pipeline stages should be monitored.",
    "The cadence, timezone, and what time the brief should run.",
    "Which signals matter: job changes, funding, hiring, news, product launches, website changes, email replies, or meetings.",
    "What output format is most useful: ranked list, action queue, email draft bundle, CRM note, or workspace document.",
    "How aggressive the agent should be about suggesting outreach or follow-up.",
    "Where completed briefs should be saved and how long historical briefs should matter.",
  ],
  skillInstructions: [
    "A scheduled research workflow with clear inputs, source priorities, and freshness rules.",
    "Ranking logic for deciding which leads deserve attention today.",
    "Instructions for drafting next actions without sending unless a send policy exists.",
    "CRM note/update guidance with citations and timestamps.",
    "An exact cron message that asks the agent to run the morning brief idempotently.",
  ],
};
