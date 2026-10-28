import { launchBrowser } from "./browser.mjs";
import { readFileSync, writeFileSync } from "node:fs";
const BASE = process.env.BASE_URL ?? "http://127.0.0.1:5184";
const b = await launchBrowser();
const legacy = JSON.parse(
  readFileSync("tests/e2e/legacy-envelope.json", "utf8"),
);
const results = [];
function check(name, v, details) {
  results.push({ name, ok: !!v, details });
  console.log(`${v ? "PASS" : "FAIL"} ${name}`);
  if (!v) throw Error(name);
}
async function session(seed, route = "") {
  const ctx = await b.newContext({ viewport: { width: 1366, height: 768 } });
  if (seed)
    await ctx.addInitScript((env) => {
      if (!localStorage.getItem("smart-apron:hark:v1"))
        localStorage.setItem(
          "smart-apron:hark:v1",
          typeof env === "string" ? env : JSON.stringify(env),
        );
    }, seed);
  const p = await ctx.newPage();
  await p.goto(`${BASE}/?fast=1#/${route}`);
  return { ctx, p };
}
try {
  const { ctx, p } = await session(legacy);
  await p.locator(".workbench").waitFor();
  const id = legacy.data.activities[0].id;
  await p.goto(
    `${BASE}/?fast=1#/activities/${id}/review?version=${legacy.data.activities[0].versions[0].id}`,
  );
  await p.waitForURL(/\/plan/);
  await p.getByRole("dialog").waitFor();
  check(
    "旧审核链接保留批准版本",
    (await p.locator("#document-version").inputValue()) ===
      legacy.data.activities[0].versions[0].id,
  );
  check(
    "旧批准内容可读",
    !(await p.locator(".doc").innerText()).includes("v2 中修改的标题"),
  );
  await p.keyboard.press("Escape");
  await p.getByRole("button", { name: "课前检查", exact: false }).click();
  await p.getByRole("dialog").waitFor();
  const repair = p.getByRole("button", { name: "去修复" }).first();
  await repair.click();
  await p.waitForTimeout(100);
  check(
    "检查项定位并聚焦原字段",
    await p
      .locator("#step-title")
      .evaluate((el) => el === document.activeElement),
  );
  await p
    .getByRole("button", { name: "教学目标", exact: false })
    .first()
    .click();
  await p.locator("#goal-text").fill("改变教学目标，核对所有下游内容");
  await p.getByRole("button", { name: "查看受影响内容" }).click();
  check(
    "目标变更集中显示所有受影响环节",
    (await p.getByRole("dialog").locator(".draft-change").count()) === 5,
  );
  await p
    .getByRole("button", { name: "以上内容仍适用于当前目标与限制" })
    .click();
  await p.waitForTimeout(500);
  const after = await p.evaluate(
    () =>
      JSON.parse(localStorage.getItem("smart-apron:hark:v1")).data
        .activities[0],
  );
  check(
    "一次明确复核清除标记",
    after.draft.steps.every((s) => !s.needsReview) &&
      !after.draft.story.needsReview,
  );
  check(
    "复核保留旧快照",
    JSON.stringify(after.versions) ===
      JSON.stringify(legacy.data.activities[0].versions),
  );
  await p.getByTestId("rail-step-1").click();
  const firstScene = after.draft.story.scenes.find(
    (sc) => sc.stepId === after.draft.steps[0].id,
  );
  await p.locator(".cue-editor summary").click();
  await p.getByTestId("cue-cue-horn").check();
  check(
    "冲突选择有明确提示",
    (await p.getByRole("alert").filter({ hasText: "冲突" }).count()) > 0,
  );
  await p.getByTestId("open-preflight").click();
  await p.getByLabel(/我已核对教案/).check();
  check(
    "知情勾选不能绕过围裙冲突",
    await p.getByTestId("prepare-lesson").isDisabled(),
  );
  await p.keyboard.press("Escape");
  await p.locator("#step-title").fill("超长教学环节".repeat(90));
  await p
    .locator(`[id="scene-narration-${firstScene.id}"]`)
    .fill("连续叙事内容".repeat(100));
  for (const [width, height] of [
    [1440, 900],
    [1366, 768],
    [1024, 768],
    [390, 844],
  ]) {
    await p.setViewportSize({ width, height });
    check(
      `${width}px 长文本无溢出`,
      await p.evaluate(
        () => document.documentElement.scrollWidth === innerWidth,
      ),
    );
  }
  await p.setViewportSize({ width: 683, height: 384 });
  check(
    "200% 等效布局宽度无横向溢出",
    await p.evaluate(() => document.documentElement.scrollWidth === innerWidth),
  );
  await p.emulateMedia({ reducedMotion: "reduce" });
  check(
    "减少动效偏好生效",
    await p.evaluate(
      () =>
        getComputedStyle(document.documentElement)
          .getPropertyValue("--t-fast")
          .trim() === "0ms",
    ),
  );
  await ctx.close();
  const broken = await session("{broken");
  await broken.p
    .getByRole("alert")
    .filter({ hasText: "自动保存已暂停" })
    .waitFor();
  await broken.p.waitForTimeout(600);
  check(
    "损坏存储不自动覆盖",
    (await broken.p.evaluate(() =>
      localStorage.getItem("smart-apron:hark:v1"),
    )) === "{broken",
  );
  await broken.p.screenshot({ path: "docs/ux/after/corrupt.png" });
  await broken.ctx.close();
  const fresh = await session(null);
  await fresh.p.getByRole("button", { name: "新建教学活动" }).click();
  await fresh.p.locator("#goal-text").fill("练习轮流表达");
  await fresh.p.locator("#goal-observe").fill("记录回应");
  await fresh.p.getByTestId("generate-lesson").click();
  await fresh.p.getByTestId("adopt-lesson").waitFor();
  await fresh.p.locator("#goal-text").fill("生成后改了目标");
  check(
    "源修改立即显示候选过期",
    (await fresh.p
      .getByRole("alert")
      .filter({ hasText: "此候选已过期" })
      .count()) === 1,
  );
  check(
    "过期候选不可应用",
    await fresh.p.getByTestId("adopt-lesson").isDisabled(),
  );
  await fresh.p.waitForTimeout(550);
  await fresh.p.reload();
  await fresh.p.getByTestId("adopt-lesson").waitFor();
  check(
    "刷新恢复未处理候选且仍然过期",
    await fresh.p.getByTestId("adopt-lesson").isDisabled(),
  );
  await fresh.ctx.close();
} catch (e) {
  console.error(e);
  process.exitCode = 1;
} finally {
  writeFileSync(
    "docs/ux/after/recovery-results.json",
    JSON.stringify(results, null, 2),
  );
  await b.close();
}
