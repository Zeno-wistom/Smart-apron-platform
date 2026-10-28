const BASE = process.env.BASE_URL ?? "http://127.0.0.1:5184";
import { launchBrowser } from "./browser.mjs";
import AxeBuilder from "@axe-core/playwright";
import { readFileSync, writeFileSync } from "node:fs";
const b = await launchBrowser();
const env = JSON.parse(readFileSync("tests/e2e/legacy-envelope.json", "utf8"));
const id = env.data.activities[0].id;
const audits = [];
for (const width of [1366, 390]) {
  const ctx = await b.newContext({ viewport: { width, height: 844 } });
  await ctx.addInitScript((e) => {
    if (!localStorage.getItem("smart-apron:hark:v1"))
      localStorage.setItem("smart-apron:hark:v1", JSON.stringify(e));
  }, env);
  const p = await ctx.newPage();
  for (const route of [
    "",
    `activities/${id}/plan?focus=step-${env.data.activities[0].draft.steps[0].id}`,
    `activities/${id}/class`,
    "records",
    "children/child-xiaozhou",
  ]) {
    await p.goto(`${BASE}/?fast=1#/${route}`);
    await p.waitForTimeout(120);
    await p.waitForTimeout(250);
    const result = await new AxeBuilder({ page: p })
      .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
      .analyze();
    audits.push({
      width,
      route,
      violations: result.violations.map((v) => ({
        id: v.id,
        impact: v.impact,
        description: v.description,
        nodes: v.nodes.map((n) => ({
          html: n.html,
          target: n.target,
          summary: n.failureSummary,
        })),
      })),
    });
    console.log(
      width,
      route,
      result.violations.map((v) => `${v.impact}:${v.id}`).join(","),
    );
  }
  await p.goto(`${BASE}/?fast=1#/activities/${id}/plan`);
  await p.getByTestId("open-preflight").click();
  await p.waitForTimeout(250);
  const result = await new AxeBuilder({ page: p })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
    .analyze();
  audits.push({ width, route: "preflight", violations: result.violations });
  await ctx.close();
}
writeFileSync(
  "docs/ux/after/accessibility.json",
  JSON.stringify(audits, null, 2),
);
await b.close();
const blocking = audits.flatMap((a) =>
  a.violations.filter((v) => ["critical", "serious"].includes(v.impact)),
);
if (blocking.length) {
  console.error(`${blocking.length} critical/serious findings`);
  process.exitCode = 1;
} else console.log("No critical/serious axe findings");
