import type { SkillTemplateDefinition } from "./types";

export const postMeetingFollowThrough: SkillTemplateDefinition = {
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
};
