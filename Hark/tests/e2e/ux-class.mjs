import { chromium } from "playwright";
import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
const b = await chromium.launch({ channel: "msedge" }),
  ctx = await b.newContext({ viewport: { width: 1366, height: 768 } }),
  p = await ctx.newPage();
const saved = JSON.parse(
  readFileSync("docs/ux/after/new-envelope.json", "utf8"),
);
const id = saved.data.activities[0].id;
const errors = [];
p.on("pageerror", (e) => errors.push(e.message));
const results = [];
const check = (name, v) => {
  results.push({ name, ok: !!v });
  console.log(`${v ? "PASS" : "FAIL"} ${name}`);
  if (!v) throw Error(name);
};
await p.addInitScript((env) => {
  if (!localStorage.getItem("smart-apron:hark:v1"))
    localStorage.setItem("smart-apron:hark:v1", JSON.stringify(env));
}, saved);
try {
  await p.goto(`http://127.0.0.1:5184/?fast=1#/activities/${id}/class`);
  await p.getByRole("button", { name: "结束模拟课堂并生成复盘" }).click();
  await p.getByTestId("refl-item").first().waitFor();
  check("课堂与复盘一次生成", (await p.locator(".tl-ev").count()) > 10);
  check(
    "来源默认分类，无需逐条选择",
    (await p.getByLabel("来源类型").count()) === 0,
  );
  check(
    "未写总结时不能完成归档",
    await p.getByTestId("complete-and-apply").isDisabled(),
  );
  await p.screenshot({ path: "docs/ux/after/class-reflection.png" });
  await p
    .getByRole("button", { name: "更改来源", exact: true })
    .first()
    .click();
  check("按需更改来源", (await p.getByLabel("来源类型").count()) === 1);
  await p.getByLabel("来源类型").selectOption("simulated");
  await p
    .locator("#teacher-summary")
    .fill("根据模拟事件核对本课流程；本次没有真实儿童表现证据。");
  await p
    .locator("#proposed-observation")
    .fill("已演示轮流表达课堂的模拟流程，不能据此推断儿童能力。");
  await p.getByTestId("complete-and-apply").click();
  check(
    "归档前预览具体观察与来源版本",
    await p
      .getByRole("dialog")
      .innerText()
      .then((s) => s.includes("v1") && s.includes("不能据此推断")),
  );
  await p.screenshot({ path: "docs/ux/after/archive-preview.png" });
  await p.getByTestId("apply-confirm").click();
  await p.getByTestId("view-profile").waitFor();
  await p.waitForTimeout(550);
  const data = await p.evaluate(
    () => JSON.parse(localStorage.getItem("smart-apron:hark:v1")).data,
  );
  check(
    "先审核再写入，同一课堂一条观察",
    data.activities[0].sessions[0].reflection.status === "reviewed" &&
      data.children[0].observations.filter((o) => o.origin.kind === "review")
        .length === 1,
  );
  const v1 = data.activities[0].versions[0];
  await p.getByRole("button", { name: "备课", exact: true }).click();
  await p.getByRole("button", { name: "继续修订", exact: true }).click();
  await p.getByTestId("rail-step-1").click();
  await p.locator("#step-title").fill("v2 修改后的标题");
  await p.waitForTimeout(600);
  const after = await p.evaluate(
    () =>
      JSON.parse(localStorage.getItem("smart-apron:hark:v1")).data
        .activities[0],
  );
  check(
    "继续修订直接编辑且历史快照不变",
    JSON.stringify(v1) === JSON.stringify(after.versions[0]),
  );
  check("课堂仍绑定 v1", after.sessions[0].versionId === v1.id);
  await p.getByRole("button", { name: "查看受影响内容", exact: true }).click();
  await p
    .getByRole("button", { name: "以上内容仍适用于当前目标与限制" })
    .click();
  await p.goto(
    `http://127.0.0.1:5184/?fast=1#/activities/${id}/story?focus=scene-${after.draft.story.scenes[0].id}`,
  );
  await p.waitForURL(/\/plan\?focus=step-/);
  check(
    "旧故事场景深链定位对应环节",
    (await p.locator("#step-title").inputValue()) === "v2 修改后的标题",
  );
  for (const [w, h] of [
    [1440, 900],
    [1366, 768],
    [1024, 768],
    [390, 844],
  ]) {
    await p.setViewportSize({ width: w, height: h });
    await p.getByRole("button", { name: "课堂与复盘", exact: true }).click();
    const overflow = await p.evaluate(
      () => document.documentElement.scrollWidth - innerWidth,
    );
    check(`${w}px 课堂无溢出`, overflow === 0);
    await p.screenshot({ path: `docs/ux/after/${w}-class.png` });
  }
  check("运行时无异常", errors.length === 0);
} catch (e) {
  console.error(e);
  await p.screenshot({ path: "docs/ux/after/class-failure.png" });
  process.exitCode = 1;
} finally {
  writeFileSync(
    "docs/ux/after/class-results.json",
    JSON.stringify(results, null, 2),
  );
  await b.close();
}
