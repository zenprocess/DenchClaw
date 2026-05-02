import type { SkillTemplateDefinition } from "./types";

export const staleThreadFollowUpAgent: SkillTemplateDefinition = {
  id: "stale-thread-follow-up-agent",
  title: "Stale Thread Follow-Up Agent",
  summary: "Find conversations that need a nudge and draft or send follow-ups.",
  category: "Follow up",
  outcome:
    "A follow-up skill that scans CRM and Gmail for stale conversations, decides the next best nudge, and drafts or sends follow-ups under explicit rules.",
  requiredApps: [
    { slug: "gmail", name: "Gmail" },
    { slug: "hubspot", name: "HubSpot" },
  ],
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
};
