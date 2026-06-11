import gradient from "gradient-string";
import { visibleWidth } from "../terminal/ansi.js";
import { isRich, theme } from "../terminal/theme.js";

export function renderDenchCloudRecommendationBanner(): string {
  const rich = isRich();
  const W = 74;

  const bdr = (s: string) => (rich ? theme.accentDim(s) : s);
  const ironShimmer = rich
    ? gradient(["#374151", "#6B7280", "#9CA3AF", "#D1D5DB", "#9CA3AF", "#6B7280", "#374151"])
    : (s: string) => s;
  const topBar = ironShimmer("─".repeat(W));
  const botBar = ironShimmer("─".repeat(W));
  const top = `  ${bdr("╭")}${topBar}${bdr("╮")}`;
  const bot = `  ${bdr("╰")}${botBar}${bdr("╯")}`;
  const blank = `  ${bdr("│")}${" ".repeat(W)}${bdr("│")}`;

  const row = (content: string, indent = 4): string => {
    const vis = visibleWidth(content);
    const right = Math.max(1, W - indent - vis);
    return `  ${bdr("│")}${" ".repeat(indent)}${content}${" ".repeat(right)}${bdr("│")}`;
  };

  const title = rich
    ? gradient(["#38BDF8", "#2DD4BF", "#34D399"])("D E N C H   C L O U D")
    : "D E N C H   C L O U D";
  const subtitle = rich
    ? theme.muted("The Ultimate CRM for your AI Agents.")
    : "The Ultimate CRM for your AI Agents.";

  const bullet = rich ? theme.info("▸") : "▸";
  const lbl = (s: string) => (rich ? theme.accentBright(s) : s);
  const dim = (s: string) => (rich ? theme.muted(s) : s);
  const COL = 14;
  const features: [string, string][] = [
    [lbl("AI Models"), dim("Claude, GPT, Kimi & more — no API keys needed")],
    [lbl("CRM"), dim("Custom objects, companies, people, etc.")],
    [lbl("Files"), dim("File Storage on Cloud")],
    [lbl("24x7"), dim("Cron jobs that run in the background")],
    [lbl("Web Search"), dim("Ready out of the box — no keys to manage")],
    [lbl("Skills Store"), dim("Browse & install skills instantly")],
    [lbl("Image Gen"), dim("State-of-the-art models from day one")],
  ];
  const featureLines = features.map(([name, desc]) => {
    const gap = " ".repeat(Math.max(1, COL - visibleWidth(name)));
    return `${bullet}  ${name}${gap}${desc}`;
  });

  const star = rich ? theme.warn("★") : "★";
  const intTitle = rich ? theme.warn("1,000+ App Integrations") : "1,000+ App Integrations";
  const dot = rich ? theme.accentDim(" · ") : " · ";
  const apps = [
    rich ? theme.info("Gmail") : "Gmail",
    rich ? theme.accentBright("Notion") : "Notion",
    rich ? theme.success("HubSpot") : "HubSpot",
    rich ? theme.warn("PostHog") : "PostHog",
    rich ? theme.accent("Stripe") : "Stripe",
    rich ? theme.success("Salesforce") : "Salesforce",
    rich ? theme.muted("…") : "…",
  ].join(dot);

  const check = rich ? theme.success("✓") : "✓";

  return [
    "",
    top,
    blank,
    row(title),
    row(subtitle),
    blank,
    ...featureLines.map((l) => row(l)),
    blank,
    row(`${star}  ${intTitle}`),
    row(apps, 7),
    blank,
    bot,
    "",
  ].join("\n");
}
