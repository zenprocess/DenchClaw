"use client";

import { useMemo, useRef, useState, type ReactNode } from "react";
import { FiSearch } from "react-icons/fi";
import {
  SKILL_TEMPLATES,
  SKILL_TEMPLATE_CATEGORIES,
  getSkillTemplate,
  type SkillTemplate,
  type SkillTemplateCategory,
  type SkillTemplateId,
} from "@/lib/skill-templates";
import { SkillTemplateCard } from "./skill-template-card";

type SkillTemplateGalleryMode = "onboarding" | "dashboard";

type SkillTemplateGalleryProps = {
  selectedTemplateId?: SkillTemplateId;
  onSelectTemplate: (templateId: SkillTemplateId) => void;
  mode?: SkillTemplateGalleryMode;
  className?: string;
  title?: string;
  description?: string;
  actionLabel?: string;
};

function templateMatches(template: SkillTemplate, query: string): boolean {
  const normalized = query.trim().toLowerCase();
  if (!normalized) {
    return true;
  }

  return [
    template.title,
    template.summary,
    template.category,
    template.outcome,
    template.autonomy,
    ...template.triggerModes,
    ...template.interviewTopics,
  ]
    .join(" ")
    .toLowerCase()
    .includes(normalized);
}

function badgeText(mode: SkillTemplate["triggerModes"][number]): string {
  return mode === "scheduled" ? "Cron" : "Manual";
}

function DefaultHeader({ mode }: { mode: SkillTemplateGalleryMode }) {
  const copy =
    mode === "dashboard"
      ? {
          title: "Start from a template.",
          description:
            "Pick a proven GTM workflow and DenchClaw will open a chat to shape it into your own reusable skill.",
        }
      : {
          title: "Choose your first GTM skill.",
          description:
            "Pick one concrete workflow. DenchClaw will interview you, then turn your answers into a reusable skill.",
        };

  return (
    <div>
      <h1
        className="font-instrument text-[34px] leading-[1.1] tracking-tight"
        style={{ color: "var(--color-text)" }}
      >
        {copy.title}
      </h1>
      <p
        className="mt-3 max-w-2xl text-[13.5px] leading-relaxed"
        style={{ color: "var(--color-text-muted)" }}
      >
        {copy.description}
      </p>
    </div>
  );
}

function TemplatePreview({ template }: { template: SkillTemplate }) {
  return (
    <aside
      className="rounded-2xl border p-4 lg:sticky lg:top-4"
      style={{
        borderColor: "var(--color-border)",
        background: "var(--color-surface-hover)",
      }}
    >
      <p
        className="text-[11px] font-semibold uppercase tracking-[0.08em]"
        style={{ color: "var(--color-text-muted)" }}
      >
        Selected template
      </p>
      <h2
        className="mt-2 font-instrument text-[22px] leading-tight tracking-tight"
        style={{ color: "var(--color-text)" }}
      >
        {template.title}
      </h2>
      <p
        className="mt-3 text-[12.5px] leading-relaxed"
        style={{ color: "var(--color-text-muted)" }}
      >
        {template.outcome}
      </p>

      <div className="mt-4 flex flex-wrap gap-1.5">
        <TemplateBadge>{template.category}</TemplateBadge>
        {template.triggerModes.map((mode) => (
          <TemplateBadge key={mode}>{badgeText(mode)}</TemplateBadge>
        ))}
        <TemplateBadge>{template.autonomy}</TemplateBadge>
      </div>

      <div className="mt-5 space-y-2">
        <p
          className="text-[11px] font-semibold uppercase tracking-[0.08em]"
          style={{ color: "var(--color-text-muted)" }}
        >
          The agent will ask about
        </p>
        <ul className="space-y-2">
          {template.interviewTopics.slice(0, 4).map((topic) => (
            <li key={topic} className="flex gap-2 text-[12px] leading-relaxed">
              <span
                className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full"
                style={{ background: "var(--color-accent)" }}
              />
              <span style={{ color: "var(--color-text-muted)" }}>{topic}</span>
            </li>
          ))}
        </ul>
      </div>
    </aside>
  );
}

function TemplateBadge({ children }: { children: ReactNode }) {
  return (
    <span
      className="rounded-full px-2 py-1 text-[10.5px] font-medium"
      style={{
        background: "color-mix(in srgb, var(--color-text) 8%, transparent)",
        color: "var(--color-text-muted)",
      }}
    >
      {children}
    </span>
  );
}

export function SkillTemplateGallery({
  selectedTemplateId,
  onSelectTemplate,
  mode = "dashboard",
  className,
  title,
  description,
  actionLabel = "Use",
}: SkillTemplateGalleryProps) {
  const [query, setQuery] = useState("");
  const [selectedCategory, setSelectedCategory] =
    useState<SkillTemplateCategory | null>(null);
  const gridRef = useRef<HTMLDivElement>(null);

  const selectedTemplate = selectedTemplateId
    ? getSkillTemplate(selectedTemplateId)
    : SKILL_TEMPLATES[0];

  const filteredTemplates = useMemo(() => {
    return SKILL_TEMPLATES.filter((template) => {
      const matchesCategory = selectedCategory
        ? template.category === selectedCategory
        : true;
      return matchesCategory && templateMatches(template, query);
    });
  }, [query, selectedCategory]);

  const handleInteraction = () => {
    window.setTimeout(() => {
      gridRef.current?.scrollIntoView?.({ behavior: "smooth", block: "start" });
    }, 100);
  };

  const handleCategoryClick = (category: SkillTemplateCategory | null) => {
    setSelectedCategory((current) => (current === category ? null : category));
    handleInteraction();
  };

  return (
    <section className={className ? `w-full space-y-6 ${className}` : "w-full space-y-6"}>
      {title || description ? (
        <div>
          {title && (
            <h1
              className="font-instrument text-[34px] leading-[1.1] tracking-tight"
              style={{ color: "var(--color-text)" }}
            >
              {title}
            </h1>
          )}
          {description && (
            <p
              className="mt-3 max-w-2xl text-[13.5px] leading-relaxed"
              style={{ color: "var(--color-text-muted)" }}
            >
              {description}
            </p>
          )}
        </div>
      ) : (
        <DefaultHeader mode={mode} />
      )}

      <div className="flex min-h-10 items-center gap-2 overflow-x-auto py-1">
        <div className="group relative shrink-0">
          <FiSearch
            aria-hidden="true"
            className="absolute left-3 top-1/2 z-10 h-3.5 w-3.5 -translate-y-1/2 transition-colors"
            style={{ color: "var(--color-text-muted)" }}
          />
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onFocus={handleInteraction}
            aria-label="Search templates"
            placeholder="Search templates..."
            className="h-8 w-48 rounded-full border bg-transparent pl-8 pr-3 text-[13px] outline-none transition-[border-color,box-shadow]"
            style={{
              borderColor: "var(--color-border)",
              color: "var(--color-text)",
            }}
          />
        </div>

        <div
          className="h-4 w-px shrink-0"
          style={{ background: "var(--color-border)" }}
        />

        <button
          type="button"
          onClick={() => handleCategoryClick(null)}
          aria-pressed={selectedCategory === null}
          className="shrink-0 rounded-full border px-3 py-1.5 text-[12px] font-medium transition-colors"
          style={{
            borderColor:
              selectedCategory === null ? "var(--color-border)" : "transparent",
            background:
              selectedCategory === null
                ? "var(--color-surface-hover)"
                : "transparent",
            color:
              selectedCategory === null
                ? "var(--color-text)"
                : "var(--color-text-muted)",
          }}
        >
          All
        </button>

        {SKILL_TEMPLATE_CATEGORIES.map((category) => {
          const active = selectedCategory === category;
          return (
            <button
              key={category}
              type="button"
              onClick={() => handleCategoryClick(category)}
              aria-pressed={active}
              className="shrink-0 rounded-full border px-3 py-1.5 text-[12px] font-medium transition-colors hover:bg-[var(--color-surface-hover)]"
              style={{
                borderColor: active ? "var(--color-border)" : "transparent",
                background: active ? "var(--color-surface-hover)" : "transparent",
                color: active ? "var(--color-text)" : "var(--color-text-muted)",
              }}
            >
              {category}
            </button>
          );
        })}
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_300px]">
        <div
          ref={gridRef}
          className="grid scroll-mt-24 grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3"
        >
          {filteredTemplates.map((template) => (
            <SkillTemplateCard
              key={template.id}
              template={template}
              selected={template.id === selectedTemplate.id}
              onSelect={() => onSelectTemplate(template.id)}
              actionLabel={actionLabel}
            />
          ))}

          {filteredTemplates.length === 0 && (
            <div
              className="rounded-2xl border px-4 py-10 text-center text-[13px] md:col-span-2 xl:col-span-3"
              style={{
                borderColor: "var(--color-border)",
                color: "var(--color-text-muted)",
              }}
            >
              No templates found matching your criteria.
            </div>
          )}
        </div>

        <TemplatePreview template={selectedTemplate} />
      </div>
    </section>
  );
}
