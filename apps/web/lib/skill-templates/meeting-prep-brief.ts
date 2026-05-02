import type { SkillTemplateDefinition } from "./types";

export const meetingPrepBrief: SkillTemplateDefinition = {
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
};
