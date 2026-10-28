const BASE = process.env.BASE_URL ?? "http://127.0.0.1:5184";
import { launchBrowser } from "./browser.mjs";
import { mkdirSync, writeFileSync } from "node:fs";
const browser = await launchBrowser();
const ctx = await browser.newContext({
  viewport: { width: 1366, height: 768 },
});
const p = await ctx.newPage();
const errors = [];
p.on("pageerror", (e) => errors.push(e.message));
p.on("console", (m) => {
  if (m.type() === "error") errors.push(m.text());
});
const out = "docs/ux/after";
mkdirSync(out, { recursive: true });
const results = [];
function check(name, value, detail) {
  results.push({ name, ok: !!value, detail });
  console.log(
    `${value ? "PASS" : "FAIL"} ${name}${detail ? " " + JSON.stringify(detail) : ""}`,
  );
  if (!value) throw Error(name);
}
try {
  await p.goto(`${BASE}/?fast=1#/`);
  await p.getByRole("heading", { name: "教学工作台", exact: true }).waitFor();
  await p.screenshot({ path: out + "/workbench-empty.png" });
  await p.getByRole("button", { name: "新建教学活动" }).click();
  await p.locator("#goal-text").fill("在视觉提示下练习轮流表达");
  await p.locator("#goal-observe").fill("记录每轮的回应与提示层级");
  await p.getByTestId("generate-lesson").click();
  await p.getByTestId("adopt-lesson").waitFor();
  check(
    "整课初稿只产生候选，未直接写入正文",
    await p
      .getByTestId("rail-step-1")
      .innerText()
      .then((s) => !s.includes("认识")),
  );
  await p.screenshot({ path: out + "/lesson-candidate.png" });
  await p.getByTestId("adopt-lesson").click();
  await p.getByTestId("rail-step-1").click();
  await p.locator("#step-title").waitFor();
  check(
    "教学与故事同屏",
    (await p.getByLabel("故事旁白", { exact: true }).count()) === 1,
  );
  const measurements = [];
  for (const [width, height] of [
    [1440, 900],
    [1366, 768],
    [1024, 768],
    [390, 844],
  ]) {
    await p.setViewportSize({ width, height });
    await p.screenshot({ path: `${out}/${width}-preparation.png` });
    const m = await p.evaluate(() => {
      const el = document.querySelector(".lesson-paper"),
        cs = getComputedStyle(el);
      return {
        overflow: document.documentElement.scrollWidth - innerWidth,
        paper: el.getBoundingClientRect().width,
        content:
          el.clientWidth -
          parseFloat(cs.paddingLeft) -
          parseFloat(cs.paddingRight),
        chrome: document.querySelector(".topbar").getBoundingClientRect()
          .height,
        minFont: Math.min(
          ...[...document.querySelectorAll("body *")]
            .filter(
              (e) =>
                e.getClientRects().length &&
                [...e.childNodes].some(
                  (n) => n.nodeType === 3 && n.textContent.trim(),
                ),
            )
            .map((e) => parseFloat(getComputedStyle(e).fontSize)),
        ),
      };
    });
    measurements.push({ width, ...m });
    check(
      `${width}px 无溢出且字号>=13`,
      m.overflow === 0 && m.minFont >= 13,
      m,
    );
    if (width === 1366)
      check("1366 正文>=640且顶部56", m.content >= 640 && m.chrome <= 56, m);
  }
  await p.setViewportSize({ width: 1366, height: 768 });
  const before = await p.locator(".lesson-paper").boundingBox();
  await p.getByRole("button", { name: "儿童与教学参考", exact: true }).click();
  await p.getByRole("dialog").waitFor();
  check(
    "参考抽屉覆盖而不挤压正文",
    (await p.locator(".lesson-paper").boundingBox()).width === before.width,
  );
  check("抽屉背景 inert", await p.locator("#root").evaluate((e) => e.inert));
  await p.keyboard.press("Escape");
  await p.getByRole("button", { name: "完整故事线", exact: true }).click();
  check("故事线显示五幕", (await p.locator(".story-scenes li").count()) === 5);
  await p.screenshot({ path: out + "/storyline.png" });
  await p.keyboard.press("Escape");
  await p.getByTestId("open-preflight").click();
  await p.getByRole("dialog").waitFor();
  await p.getByLabel(/我已核对教案/).check();
  check(
    "一次集中审核可批准",
    await p.getByTestId("prepare-lesson").isEnabled(),
  );
  await p.screenshot({ path: out + "/preflight.png" });
  await p.evaluate(() => {
    window.__setItem = Storage.prototype.setItem;
    Storage.prototype.setItem = function (k, v) {
      if (k === "smart-apron:hark:v1") throw new Error("UX test quota");
      return window.__setItem.call(this, k, v);
    };
  });
  await p.getByTestId("prepare-lesson").click();
  await p.getByText(/批准快照尚未保存/).waitFor();
  const locked = await p.evaluate(
    () =>
      JSON.parse(localStorage.getItem("smart-apron:hark:v1")).data
        .activities[0],
  );
  check("保存失败前无传输", locked.transfers.length === 0);
  await p.screenshot({ path: out + "/save-failure.png" });
  await p.evaluate(() => {
    Storage.prototype.setItem = window.__setItem;
    window.__harkSim.transferFail = true;
  });
  await p.getByTestId("prepare-lesson").click();
  await p.getByText(/模拟传输中断/).waitFor();
  await p.screenshot({ path: out + "/transfer-failure.png" });
  await p.getByTestId("prepare-lesson").click();
  await p.getByTestId("receipt").waitFor();
  const saved = await p.evaluate(
    () =>
      JSON.parse(localStorage.getItem("smart-apron:hark:v1")).data
        .activities[0],
  );
  check(
    "失败重试复用同一批准版本",
    saved.versions.length === 1 && saved.transfers.length === 2,
  );
  check(
    "回执绑定批准版本",
    saved.transfers[1].versionId === saved.versions[0].id,
  );
  await p.screenshot({ path: out + "/transfer-success.png" });
  writeFileSync(
    out + "/new-envelope.json",
    await p.evaluate(() => localStorage.getItem("smart-apron:hark:v1")),
  );
  writeFileSync(out + "/metrics.json", JSON.stringify(measurements, null, 2));
  check("浏览器控制台无错误", errors.length === 0, errors);
} catch (e) {
  await p.screenshot({ path: out + "/failure.png" });
  console.error(e);
  process.exitCode = 1;
} finally {
  writeFileSync(out + "/results.json", JSON.stringify(results, null, 2));
  await browser.close();
}
