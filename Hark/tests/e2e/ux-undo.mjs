import { launchBrowser } from "./browser.mjs";
import { readFileSync, writeFileSync } from "node:fs";
const b = await launchBrowser(),
  ctx = await b.newContext({ viewport: { width: 1366, height: 900 } }),
  p = await ctx.newPage();
const env = JSON.parse(readFileSync("tests/e2e/legacy-envelope.json", "utf8")),
  id = env.data.activities[0].id;
await ctx.addInitScript((e) => {
  if (!localStorage.getItem("smart-apron:hark:v1"))
    localStorage.setItem("smart-apron:hark:v1", JSON.stringify(e));
}, env);
const results = [];
const check = (name, ok) => {
  results.push({ name, ok });
  console.log(`${ok ? "PASS" : "FAIL"} ${name}`);
  if (!ok) throw Error(name);
};
const BASE = process.env.BASE_URL ?? "http://127.0.0.1:5184";
try {
  await p.goto(
    `${BASE}/?fast=1#/activities/${id}/plan?focus=step-${env.data.activities[0].draft.steps[0].id}`,
  );
  const field = p.locator("#step-title"),
    original = await field.inputValue();
  await field.fill("可撤销的环节标题");
  await p.getByRole("button", { name: "撤销修改", exact: true }).click();
  check("文本编辑可撤销", (await field.inputValue()) === original);
  await p.getByRole("button", { name: "重做修改", exact: true }).click();
  check("文本编辑可重做", (await field.inputValue()) === "可撤销的环节标题");
  await p.getByRole("button", { name: "删除此环节", exact: true }).click();
  await p
    .getByRole("dialog")
    .getByRole("button", { name: "删除", exact: true })
    .click();
  check(
    "环节删除后结构减少",
    (await p.locator(".step-rail ol li").count()) === 4,
  );
  await p.getByRole("button", { name: "撤销修改", exact: true }).click();
  check(
    "撤销恢复环节及原关联关系",
    (await p.locator(".step-rail ol li").count()) === 5,
  );
  await p.getByRole("button", { name: "添加环节", exact: true }).click();
  check("新增环节", (await p.locator(".step-rail ol li").count()) === 6);
  await p.getByRole("button", { name: "撤销修改", exact: true }).click();
  check("撤销新增环节", (await p.locator(".step-rail ol li").count()) === 5);
  await p.waitForTimeout(600);
  const data = await p.evaluate(
    () =>
      JSON.parse(localStorage.getItem("smart-apron:hark:v1")).data
        .activities[0],
  );
  check(
    "编辑撤销不改批准快照",
    JSON.stringify(data.versions) ===
      JSON.stringify(env.data.activities[0].versions),
  );
  await p.screenshot({ path: "docs/ux/after/undo.png" });
} catch (e) {
  console.error(e);
  process.exitCode = 1;
} finally {
  writeFileSync(
    "docs/ux/after/undo-results.json",
    JSON.stringify(results, null, 2),
  );
  await b.close();
}
