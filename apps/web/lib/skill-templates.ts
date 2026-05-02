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

type SkillTemplateDefinition = Omit<SkillTemplate, "buildPrompt">;

function bulletList(items: readonly string[]): string {
  return items.map((item) => `- ${item}`).join("\n");
}

function buildGtmSkillPrompt(template: SkillTemplateDefinition): string {
  const triggerModes = template.triggerModes
    .map((mode) => (mode === "scheduled" ? "cron/scheduled agent message" : "manual trigger"))
    .join(" and ");

  return `I want to create a reusable DenchClaw skill called "${template.title}".

This should become a durable GTM skill, not a one-off chat. DenchClaw is my AI workspace with CRM, Gmail, Calendar, enrichment, web search, and optional HubSpot or Notion context. Treat Dench CRM as the default system of record, and use Gmail and Calendar as first-class context when they are connected.

The desired outcome is:
${template.outcome}

Available trigger modes for this product are only manual trigger and cron/scheduled agent messages. For this skill, design around ${triggerModes}. Do not assume webhooks, event listeners, or automatic app callbacks exist.

Start by interviewing me one question at a time. Ask the smallest next question needed, wait for my answer, then ask the next question. Do not create or edit any files until you have enough context to tailor the workflow.

Before writing the final SKILL.md, gather these specifics:
${bulletList(template.interviewTopics)}

When you have enough context, create a complete SKILL.md for this workflow. The skill should include:
${bulletList(template.skillInstructions)}

Automation policy:
- If the skill sends email or LinkedIn-style outreach, it may be fully automated only after you define explicit send rules with me.
- Capture daily or weekly caps, allowlists or exclusions, quiet hours, stop conditions, duplicate prevention, and what counts as a reply or conversion.
- For scheduled skills, include idempotency checks so a cron run does not repeat work already done in a previous run.
- For CRM writes, prefer additive updates with source attribution and confidence notes. Ask before overwriting existing user-authored fields unless I explicitly allow overwrites.

End by showing me the created skill path, how to invoke it manually, and the exact cron/scheduled message to use if the workflow should run on a schedule.`;
}

const TEMPLATE_DEFINITIONS: readonly SkillTemplateDefinition[] = [
  {
    id: "icp-outreach-builder",
    title: "ICP Outreach Builder",
    summary: "Turn an ICP, offer, and lead source into reusable personalized outreach.",
    category: "Find leads",
    outcome:
      "A repeatable outreach skill that finds or accepts target leads, researches each person, writes personalized messages, and follows a configured send or approval policy.",
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
  },
  {
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
  },
  {
    id: "morning-lead-research-brief",
    title: "Morning Lead Research Brief",
    summary: "Get a scheduled brief of lead signals and the next best GTM actions.",
    category: "Research",
    outcome:
      "A scheduled research skill that reviews priority leads and accounts each morning, finds fresh signals, and produces a concise action brief.",
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
  },
  {
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
  },
  {
    id: "stale-thread-follow-up-agent",
    title: "Stale Thread Follow-Up Agent",
    summary: "Find conversations that need a nudge and draft or send follow-ups.",
    category: "Follow up",
    outcome:
      "A follow-up skill that scans CRM and Gmail for stale conversations, decides the next best nudge, and drafts or sends follow-ups under explicit rules.",
    triggerModes: ["scheduled", "manual"],
    autonomy: "Can automate",
    interviewTopics: [
      "Which relationships, CRM stages, labels, or inbox threads should be eligible.",
      "What counts as stale for each stage or conversation type.",
      "Which threads must never be automated, such as investors, customers, partners, or personal contacts.",
      "Tone, urgency, and fallback copy for first, second, and final follow-ups.",
      "Whether the skill can send automatically after caps, quiet hours, and stop rules are configured.",
      "How sent messages, skipped threads, and replies should update CRM.",
    ],
    skillInstructions: [
      "A stale-thread detection process that checks last inbound, last outbound, CRM stage, and prior follow-up count.",
      "Drafting and sending rules with explicit caps, exclusions, and duplicate prevention.",
      "Stop conditions for replies, bounces, unsubscribes, closed opportunities, and manual owner notes.",
      "CRM logging instructions for sent, drafted, skipped, and completed follow-ups.",
      "A safe scheduled-agent message for recurring follow-up scans.",
    ],
  },
  {
    id: "meeting-prep-brief",
    title: "Meeting Prep Brief",
    summary: "Prepare for sales calls with CRM, Gmail, Calendar, and web context.",
    category: "Meetings",
    outcome:
      "A prep skill that turns upcoming meetings into concise briefs with relationship context, company research, open questions, and suggested agenda.",
    triggerModes: ["scheduled", "manual"],
    autonomy: "Creates drafts",
    interviewTopics: [
      "Which meetings should receive prep briefs and how far ahead to prepare them.",
      "Which context matters most: CRM stage, prior emails, calendar history, company research, LinkedIn-style background, or notes.",
      "Preferred brief format, length, and where it should be saved.",
      "Questions the user always wants answered before a call.",
      "Whether the skill should draft agenda emails or internal notes.",
      "What data should never be included in a brief.",
    ],
    skillInstructions: [
      "A calendar scanning workflow for finding eligible meetings.",
      "Research steps across CRM, Gmail, Calendar, web search, and optional notes systems.",
      "A structured brief format with priorities, risks, open loops, agenda, and suggested asks.",
      "Privacy and relevance filters so briefs stay useful and concise.",
      "A cron message for preparing briefs before the user's workday or before each call window.",
    ],
  },
  {
    id: "post-meeting-follow-through",
    title: "Post-Meeting Follow-Through",
    summary: "Convert meeting notes into CRM updates, tasks, and follow-up emails.",
    category: "Meetings",
    outcome:
      "A follow-through skill that turns meeting notes or a short user recap into CRM updates, next steps, owner tasks, and follow-up drafts or sends.",
    triggerModes: ["manual", "scheduled"],
    autonomy: "Can automate",
    interviewTopics: [
      "Where meeting notes or recaps will come from and whether transcripts are available.",
      "Which CRM objects, stages, fields, and tasks should be updated after meetings.",
      "The user's preferred follow-up email structure and tone.",
      "What should require confirmation before writing to CRM or sending externally.",
      "How to detect meetings that have not yet been processed in scheduled lookbacks.",
      "How next steps, dates, and owners should be represented.",
    ],
    skillInstructions: [
      "A manual flow for processing pasted notes or selected meeting context.",
      "A scheduled lookback flow that finds recently ended meetings without assuming webhooks.",
      "CRM update, task creation, and follow-up drafting/sending rules.",
      "Idempotency checks to avoid processing the same meeting twice.",
      "Examples of concise CRM notes, next-step summaries, and follow-up messages.",
    ],
  },
  {
    id: "pipeline-hygiene-digest",
    title: "Pipeline Hygiene Digest",
    summary: "Surface stale deals, missing fields, and next-step gaps on a schedule.",
    category: "CRM hygiene",
    outcome:
      "A scheduled pipeline hygiene skill that reviews CRM quality, identifies stuck opportunities or missing next steps, and proposes cleanup actions.",
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
  },
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
