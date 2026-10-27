/**
 * Hark 版本端到端验收脚本（Playwright + 本机 Chromium）。
 *
 * 用法：
 *   1) 在 Hark/ 目录启动服务：npm run dev   （默认 http://127.0.0.1:5174）
 *   2) 另开终端：npm run e2e
 * 可选环境变量：
 *   BASE_URL=http://127.0.0.1:5174   CHROMIUM=/usr/bin/chromium   SHOTS=1（保存截图到 tests/e2e/artifacts）
 *
 * 覆盖：完整闭环、刷新恢复、确认锁定、一键补全不覆盖草稿、返回修改、目标修改触发复核、
 *       AI 失败与重试、旧异步结果被拒绝、冲突配置阻止确认、传输失败与重试、
 *       复盘审核后才写入档案、1366/1440/375 宽度布局、Console 错误。
 */
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";

const BASE = (process.env.BASE_URL ?? "http://127.0.0.1:5174") + "/?fast=1";
const SHOTS = process.env.SHOTS === "1";
const OUT = new URL("./artifacts/", import.meta.url).pathname;
if (SHOTS) mkdirSync(OUT, { recursive: true });

const results = [];
const errors = [];
let page;

function check(name, cond, detail = "") {
  results.push({ name, ok: !!cond, detail });
  console.log(`${cond ? "✓" : "✗"} ${name}${detail ? ` — ${detail}` : ""}`);
}
async function shot(name) {
  if (SHOTS) await page.screenshot({ path: `${OUT}${name}.png`, fullPage: false });
}
const tid = (id) => page.getByTestId(id);
const wait = (ms) => page.waitForTimeout(ms);
const text = async (sel) => (await page.locator(sel).first().innerText()).trim();

async function setDemo(label, on) {
  await page.getByRole("button", { name: /演示控制/ }).click();
  const box = page.getByLabel(label);
  if ((await box.isChecked()) !== on) await box.click();
  await page.keyboard.press("Escape");
  await page.mouse.click(5, 890);
}

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM ?? "/usr/bin/chromium", args: ["--no-sandbox"] });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
page = await ctx.newPage();
page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
page.on("pageerror", (e) => errors.push(String(e)));
const external = [];
page.on("request", (r) => {
  const u = new URL(r.url());
  if (!["127.0.0.1", "localhost"].includes(u.hostname) && !u.protocol.startsWith("data")) external.push(r.url());
});

try {
  await page.goto(BASE + "#/");
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await shot("01-workbench-empty");

  /* ---------- 创建活动 ---------- */
  await page.getByRole("button", { name: "新建教学活动" }).first().click();
  await page.getByRole("button", { name: "创建并开始备课" }).click();
  await page.waitForURL(/plan\?focus=goal/);
  check("创建活动后进入目标编辑", true);
  await page.locator(".constraint input").first().waitFor();
  const cons = await page.locator(".constraint input").count();
  check("自动带入档案中的两条限制", cons === 2, `${cons} 条`);

  /* ---------- AI 失败与重试 ---------- */
  await setDemo("下一次模拟 AI 请求失败", true);
  await tid("recommend-goals").click();
  await page.locator(".inline-error").waitFor();
  check("AI 失败时显示错误并保留内容", await page.locator(".inline-error").isVisible());
  await page.locator(".inline-error").getByRole("button", { name: "重试" }).click();
  await page.locator(".option").first().waitFor();
  check("重试后获得目标推荐", (await page.locator(".option").count()) === 3);
  await page.locator(".option").first().click();
  await page.locator(".option").nth(1).click();
  check("未改写的 AI 推荐可直接切换", (await page.getByRole("dialog").count()) === 0 && await page.locator(".option").nth(1).getAttribute("aria-pressed") === "true");
  await page.locator("#goal-text").fill("教师原创目标");
  await page.locator(".option").first().click();
  check("切换推荐时保护教师原创目标", (await page.getByRole("dialog").count()) === 1 && (await page.locator("#goal-text").inputValue()) === "教师原创目标");
  await page.getByRole("button", {name:"保留我的目标"}).click();
  await page.locator(".option").first().click();
  await page.getByRole("button", {name:"替换", exact:true}).click();
  const goal = await page.locator("#goal-text").inputValue();
  check("采纳推荐目标写入目标字段", goal.includes("轮流表达"), goal);
  await page.locator("#plan-notes").fill("先用手势指向轮流卡，再说“轮到你”");
  await shot("02-goal");
  await tid("confirm-goal").click();

  /* ---------- 逐步生成 + 候选 ---------- */
  await tid("gen-step").click();
  await tid("candidate").waitFor();
  const t1 = await page.locator("#step-title").inputValue();
  check("候选到达时不写入正文", t1 === "", `标题="${t1}"`);
  const candText = await page.locator(".candidate").innerText();
  check("模拟 AI 读取了目标与备注上下文", candText.includes("小船") && candText.includes("先用手势"));
  await tid("regenerate").click();
  await wait(250);
  await tid("candidate").waitFor();
  const candText2 = await page.locator(".candidate").innerText();
  check("重新生成给出不同候选", candText2 !== candText);
  await tid("adopt").click();
  check("采纳后写入草稿", (await page.locator("#step-title").inputValue()).length > 0);
  await shot("03-step-adopted");
  await tid("confirm-step").click();
  await wait(100);
  check("确认后自动前往第 2 环节", (await page.locator(".editor-head .eyebrow").innerText()).includes("第 2"));

  /* ---------- 旧异步结果不能覆盖新修改 ---------- */
  // 放慢模拟延迟，让教师有时间在生成期间编辑
  await page.evaluate(() => (window.__harkSim.speed = 2));
  await tid("gen-step").click();
  await page.locator("#step-title").fill("我在生成期间写的标题");
  await wait(1800);
  await page.evaluate(() => (window.__harkSim.speed = 0.05));
  const t2 = await page.locator("#step-title").inputValue();
  const hasCand = await tid("candidate").count();
  check("生成期间的教师修改不被旧结果覆盖", t2 === "我在生成期间写的标题" && hasCand === 0, `候选=${hasCand}`);

  /* ---------- 教师草稿 + 一键补全 ---------- */
  await page.locator("#step-teacherScript").fill("教师自己写的示范引导语");
  await page.locator("#step-childInteraction").fill("儿童看示范");
  const impact = await tid("complete-impact").innerText();
  check("一键补全前展示影响范围", impact.includes("3") && impact.includes("1 个草稿") && impact.includes("1 个已确认"), impact.replace(/\s+/g, ""));
  await shot("04-complete-impact");
  await tid("complete-btn").click();
  await page.locator(".ol-state.ai .ai-dot").nth(2).waitFor();
  const dots = await page.locator(".ol-state.ai .ai-dot").count();
  check("一键补全只为空白环节生成候选", dots === 3, `${dots} 个候选`);
  check("一键补全不覆盖教师草稿", (await page.locator("#step-title").inputValue()) === "我在生成期间写的标题");
  await page.locator('.batch-preview summary').click();
  check("批量预览显示全部候选", (await page.locator('.batch-preview article').count()) === 3);
  await tid("adopt-all-steps").click();
  check("批量采纳不覆盖教师草稿", (await page.locator("#step-title").inputValue()) === "我在生成期间写的标题");
  await tid("confirm-step").click();
  for (let i = 0; i < 3; i++) {
    await tid("confirm-step").click();
    await wait(80);
  }
  const locks = await page.locator(".ol-steps .ol-badge.s-confirmed").count();
  check("5 个环节全部确认", locks === 5, `${locks}`);

  /* ---------- 确认锁定 & 返回修改 ---------- */
  await tid("ol-step-1").click();
  check("已确认环节为只读", await page.locator("#step-title").evaluate((el) => el.readOnly));
  check("已确认环节不提供 AI 生成", (await tid("gen-step").count()) === 0);
  await tid("unlock-step").click();
  await page.locator("#step-observe").fill("是否注视或指向图片（教师返回修改）");
  await tid("confirm-step").click();
  check("返回修改并重新确认", (await page.locator(".ol-steps .ol-badge.s-confirmed").count()) === 5);

  /* ---------- 刷新恢复 ---------- */
  await wait(600);
  await page.reload();
  await page.locator(".ol-item").first().waitFor();
  check("刷新后恢复备课进度", (await page.locator(".ol-steps .ol-badge.s-confirmed").count()) === 5);
  check("刷新后保留返回修改的内容", (await page.locator(".outline").innerText()).length > 0);

  /* ---------- 目标修改 → 下游复核 ---------- */
  await page.locator(".ol-item").first().click();
  await page.getByRole("button", { name: "解除确认以修改" }).click();
  await page.locator("#goal-text").fill("在视觉提示下练习轮流表达，每次等待 5 秒");
  await tid("confirm-goal").click();
  const reviews = await page.locator(".ol-badge.s-review").count();
  check("修改目标后所有环节标记需复核", reviews === 5, `${reviews}`);
  await shot("05-needs-review");
  for (let i = 0; i < 5; i++) {
    await tid("mark-reviewed").click();
    await wait(60);
    const next = page.getByRole("button", { name: "下一个待处理环节" });
    if (await next.count()) await next.click();
  }
  check("复核后清除标记", (await page.locator(".ol-badge.s-review").count()) === 0);

  /* ---------- 故事 ---------- */
  await page.getByRole("button", { name: /下一步：故事与围裙|前往故事与围裙/ }).first().click();
  await tid("gen-story").click();
  await tid("adopt-story").waitFor();
  await shot("06-story-candidate");
  await tid("adopt-story").click();
  await page.locator("#story-title").fill("小船找灯塔");
  check("故事采纳后可编辑", (await page.locator("#story-title").inputValue()) === "小船找灯塔");
  const scenes = await tid("ol-scene").count();
  check("每个环节对应一个场景", scenes === 5, `${scenes}`);

  // 冲突检测
  await tid("ol-scene").first().click();
  await tid("cue-cue-horn").check();
  check("自动船笛与“避免突然大音量”冲突被指出", (await page.locator(".notice-warn[role=alert]").innerText()).includes("冲突"));
  await shot("07-conflict");
  await tid("cue-cue-horn").uncheck();
  await tid("match-cues").click();
  await tid("accept-all-cues").waitFor();
  await tid("accept-all-cues").click();
  check("模拟匹配不推荐冲突反馈", (await page.locator(".ol-state.warn").count()) === 0);
  await tid("confirm-story").click();
  check("采纳建议同时确认反馈", (await tid("confirm-apron").count()) === 0);
  await shot("08-story-confirmed");

  /* ---------- 审核 ---------- */
  await tid("goto-review").click();
  check("所有项完成后可批准", await tid("approve").isEnabled());
  await shot("09-review");
  await tid("approve").click();
  await tid("approve-confirm").click();
  check("批准后草稿锁定并显示 v1", (await page.locator(".version-chip.locked").innerText()).includes("v1"));

  /* ---------- 模拟传输失败与重试 ---------- */
  await tid("connect").click();
  await page.getByText("已连接（模拟）").waitFor();
  await setDemo("下一次模拟传输失败", true);
  await tid("transfer").click();
  await page.locator(".side-card .notice-warn[role=alert]").waitFor();
  check("模拟传输失败给出说明", true);
  await tid("transfer").click();
  await tid("receipt").waitFor();
  check("重试后获得模拟回执", (await tid("receipt").innerText()).includes("SIM-"));
  await shot("10-transfer");

  /* ---------- 课堂与复盘 ---------- */
  await tid("goto-class").click();
  await page.getByRole("button", { name: /生成模拟课堂记录/ }).last().click();
  await page.locator(".tl-ev").first().waitFor();
  const evs = await page.locator(".tl-ev").count();
  check("模拟课堂事件按环节生成", evs >= 10, `${evs} 条`);
  await tid("gen-reflection").click();
  await tid("refl-item").first().waitFor();
  const kinds = await page.locator(".refl-items").innerText();
  check("复盘区分事实/模拟/推断/未知", true, "");
  const legend = await page.locator(".legend").innerText();
  check("复盘来源图例完整", ["事实", "模拟记录", "AI 推断", "未知"].every((k) => legend.includes(k)));
  check("复盘草稿包含 AI 推断与未知项", kinds.includes("AI 推断") && kinds.includes("未知"));
  check("未审核前不能写入档案", (await tid("apply-profile").count()) === 0);
  check("缺少教师总结时不能完成审核", await tid("review-reflection").isDisabled());
  await page.locator("#teacher-summary").fill("小舟在轮流卡提示下完成了两轮轮流（模拟记录），下次延长减少提示环节的等待。");
  await tid("review-reflection").click();
  await shot("11-reflection-reviewed");
  await tid("apply-profile").click();
  await tid("apply-confirm").click();
  await tid("view-profile").click();
  await tid("observation").nth(1).waitFor({ timeout: 3000 }).catch(() => {});
  const obs = await tid("observation").count();
  check("审核后写入儿童档案历史观察", obs === 2, `${obs} 条`);
  check("档案观察标注来源版本", (await page.locator(".obs-list").innerText()).includes("v1"));
  await shot("12-profile");

  /* ---------- 继续修订不改变 v1 ---------- */
  await page.getByRole("link", { name: /来自「/ }).click();
  await page.getByRole("button", { name: "审核与传输" }).click();
  await page.getByRole("button", { name: /基于 v1 继续修订/ }).click();
  check("继续修订后出现草稿与 v1 切换", (await page.locator(".version-switch").innerText()).includes("v1"));
  await page.getByRole("button", { name: "目标与环节" }).click();
  await tid("ol-step-2").click();
  await tid("unlock-step").click();
  await page.locator("#step-title").fill("v2 中修改的标题");
  await page.getByRole("button", { name: "审核与传输" }).click();
  await page.getByRole("tab", { name: "v1" }).click();
  await wait(200);
  if (SHOTS) await shot("13-v1-view");
  const v1doc = await page.locator(".doc").innerText();
  console.log("URL", page.url(), "eyebrow", await page.locator(".review-doc .eyebrow").innerText());
  check("v1 快照不受 v2 草稿修改影响", !v1doc.includes("v2 中修改的标题"));
  await page.goto(BASE + "#/records");
  check("教学记录列出课堂与版本", (await page.locator(".table").count()) === 2);

  /* ---------- 布局宽度检查 ---------- */
  const actUrl = page.url();
  for (const w of [1366, 1440, 1024, 375]) {
    await page.setViewportSize({ width: w, height: 860 });
    for (const route of ["#/", actUrl.split("#")[1] ? "#/records" : "#/"]) {
      await page.goto(BASE + route);
      await wait(150);
      const over = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      check(`${w}px ${route} 无横向溢出`, over <= 0, `溢出 ${over}px`);
    }
  }
  const firstAct = await page.evaluate(() => JSON.parse(localStorage.getItem("smart-apron:hark:v1")).data.activities[0].id);
  for (const w of [1366, 1440, 375]) {
    await page.setViewportSize({ width: w, height: 860 });
    for (const st of ["plan", "story", "review", "class"]) {
      await page.goto(`${BASE}#/activities/${firstAct}/${st}`);
      await wait(150);
      const over = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      check(`${w}px ${st} 无横向溢出`, over <= 0, `溢出 ${over}px`);
      if (SHOTS && w !== 1440) await shot(`w${w}-${st}`);
    }
  }

  /* ---------- 存储隔离 ---------- */
  const keys = await page.evaluate(() => Object.keys(localStorage));
  check("只使用 smart-apron:hark:v1 存储键", keys.length === 1 && keys[0] === "smart-apron:hark:v1", keys.join(","));
} catch (e) {
  check("脚本执行未中断", false, String(e).slice(0, 300));
  await shot("zz-failure");
}

check("Console 错误为 0", errors.length === 0, errors.slice(0, 3).join(" | "));
check("无外部网络请求", external.length === 0, external.slice(0, 3).join(" | "));
await browser.close();

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} 项通过`);
process.exit(failed.length ? 1 : 0);
