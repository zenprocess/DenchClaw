"use client";

import { useMemo, useState } from "react";
import type { QuestionBlock, QuestionOption } from "@/lib/question-blocks";

type ChatQuestionCardProps = {
  question: QuestionBlock;
  onAnswer?: (answerText: string) => void;
};

export function ChatQuestionCard({ question, onAnswer }: ChatQuestionCardProps) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const [details, setDetails] = useState("");
  const [submitted, setSubmitted] = useState<"answered" | "skipped" | null>(null);

  const selectedOptions = useMemo(
    () => question.options.filter((option) => selectedIds.has(option.id)),
    [question.options, selectedIds],
  );

  const canSubmit = selectedOptions.length > 0 && !submitted;

  function toggleOption(optionId: string) {
    if (submitted) {
      return;
    }

    setSelectedIds((previous) => {
      if (!question.allowMultiple) {
        return new Set([optionId]);
      }

      const next = new Set(previous);
      if (next.has(optionId)) {
        next.delete(optionId);
      } else {
        next.add(optionId);
      }
      return next;
    });
  }

  function submitAnswer() {
    if (!canSubmit) {
      return;
    }
    setSubmitted("answered");
    onAnswer?.(formatQuestionAnswer(question, selectedOptions, details));
  }

  function skipQuestion() {
    if (submitted) {
      return;
    }
    setSubmitted("skipped");
    onAnswer?.(formatSkippedQuestion(question, details));
  }

  return (
    <section
      className="my-2 overflow-hidden rounded-2xl border"
      style={{
        borderColor: "var(--color-border)",
        background: "var(--color-surface)",
        boxShadow: "0 10px 30px color-mix(in srgb, var(--color-text) 6%, transparent)",
      }}
      aria-label="Question from assistant"
    >
      <div className="border-b px-4 py-3" style={{ borderColor: "var(--color-border)" }}>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p
              className="text-[11px] font-semibold uppercase tracking-[0.08em]"
              style={{ color: "var(--color-accent)" }}
            >
              Choose an answer
            </p>
            <h3
              className="mt-1 text-[14px] font-medium leading-relaxed"
              style={{ color: "var(--color-text)" }}
            >
              {question.prompt}
            </h3>
          </div>
          <span
            className="shrink-0 rounded-full px-2.5 py-1 text-[11px] font-medium"
            style={{
              background: "color-mix(in srgb, var(--color-accent) 12%, transparent)",
              color: "var(--color-accent)",
            }}
          >
            {question.allowMultiple ? "Select all" : "Pick one"}
          </span>
        </div>
      </div>

      <div className="space-y-2 px-4 py-3">
        {question.options.map((option, index) => {
          const selected = selectedIds.has(option.id);
          return (
            <button
              key={option.id}
              type="button"
              disabled={!!submitted}
              aria-pressed={selected}
              onClick={() => toggleOption(option.id)}
              className="group flex w-full items-start gap-3 rounded-xl border px-3 py-2.5 text-left transition-[background,border-color,opacity] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] disabled:cursor-default disabled:opacity-75"
              style={{
                borderColor: selected
                  ? "var(--color-accent)"
                  : "color-mix(in srgb, var(--color-border) 78%, transparent)",
                background: selected
                  ? "color-mix(in srgb, var(--color-accent) 10%, transparent)"
                  : "var(--color-background)",
              }}
            >
              <span
                className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-[11px] font-semibold"
                style={{
                  borderColor: selected ? "var(--color-accent)" : "var(--color-border)",
                  background: selected ? "var(--color-accent)" : "transparent",
                  color: selected ? "#fff" : "var(--color-text-muted)",
                }}
              >
                {question.allowMultiple && selected ? "OK" : String.fromCharCode(65 + index)}
              </span>
              <span className="min-w-0">
                <span
                  className="block text-[13px] font-medium leading-5"
                  style={{ color: "var(--color-text)" }}
                >
                  {option.label}
                </span>
                {option.description && (
                  <span
                    className="mt-0.5 block text-[12px] leading-relaxed"
                    style={{ color: "var(--color-text-muted)" }}
                  >
                    {option.description}
                  </span>
                )}
              </span>
            </button>
          );
        })}
      </div>

      <div className="space-y-3 px-4 pb-4">
        <label className="block">
          <span
            className="mb-1.5 block text-[11px] font-medium uppercase tracking-[0.06em]"
            style={{ color: "var(--color-text-muted)" }}
          >
            Optional context
          </span>
          <textarea
            value={details}
            disabled={!!submitted}
            onChange={(event) => setDetails(event.target.value)}
            placeholder={question.optionalDetailsPlaceholder ?? "Add anything the options miss..."}
            className="min-h-[66px] w-full resize-y rounded-xl border px-3 py-2 text-[13px] leading-relaxed outline-none transition-[border-color,box-shadow] disabled:opacity-70"
            style={{
              borderColor: "var(--color-border)",
              background: "var(--color-background)",
              color: "var(--color-text)",
            }}
            onFocus={(event) => {
              event.currentTarget.style.borderColor = "var(--color-accent)";
              event.currentTarget.style.boxShadow =
                "0 0 0 3px color-mix(in srgb, var(--color-accent) 16%, transparent)";
            }}
            onBlur={(event) => {
              event.currentTarget.style.borderColor = "var(--color-border)";
              event.currentTarget.style.boxShadow = "none";
            }}
          />
        </label>

        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="text-[12px]" style={{ color: "var(--color-text-muted)" }}>
            {submitted === "answered" && "Answer sent."}
            {submitted === "skipped" && "Question skipped."}
            {!submitted && selectedOptions.length > 0 &&
              `${selectedOptions.length} selected`}
          </div>
          <div className="flex items-center gap-2">
            {question.optional && (
              <button
                type="button"
                disabled={!!submitted}
                onClick={skipQuestion}
                className="h-9 rounded-lg px-3 text-[13px] font-medium transition-opacity disabled:opacity-50"
                style={{
                  border: "1px solid var(--color-border)",
                  color: "var(--color-text-muted)",
                  background: "var(--color-background)",
                }}
              >
                Skip
              </button>
            )}
            <button
              type="button"
              disabled={!canSubmit}
              onClick={submitAnswer}
              className="h-9 rounded-lg px-4 text-[13px] font-medium transition-opacity disabled:opacity-50"
              style={{
                background: "var(--color-accent)",
                color: "#fff",
              }}
            >
              {submitted ? "Sent" : "Continue"}
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}

function formatQuestionAnswer(
  question: QuestionBlock,
  selectedOptions: QuestionOption[],
  details: string,
): string {
  const optionLines = selectedOptions
    .map((option) => `- ${option.label} (${option.id})`)
    .join("\n");
  const detailText = details.trim();

  return [
    `Answer to "${question.prompt}"`,
    `Question ID: ${question.id}`,
    question.allowMultiple ? "Selected options:" : "Selected option:",
    optionLines,
    detailText ? `Additional context:\n${detailText}` : "",
  ]
    .filter(Boolean)
    .join("\n\n");
}

function formatSkippedQuestion(question: QuestionBlock, details: string): string {
  const detailText = details.trim();
  return [
    `Skipped question "${question.prompt}"`,
    `Question ID: ${question.id}`,
    detailText ? `Additional context:\n${detailText}` : "",
  ]
    .filter(Boolean)
    .join("\n\n");
}
