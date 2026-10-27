import { chromium } from "playwright";

const base = process.env.BASE_URL ?? "http://127.0.0.1:5174";
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
try {
  await page.goto(`${base}/?fast=1#/`);
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.getByRole("button", { name: "新建教学活动" }).first().click();
  await page.getByRole("button", { name: "创建并开始备课" }).click();
  for (const size of [{ width: 1366, height: 768 }, { width: 1440, height: 900 }, { width: 1024, height: 768 }]) {
    await page.setViewportSize(size);
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.mouse.move(400, 500);
    await page.mouse.wheel(0, 600);
    await page.waitForTimeout(200);
    const wheel = await page.evaluate(() => scrollY);
    await page.evaluate(() => { window.scrollTo(0, 0); document.activeElement?.blur(); });
    await page.keyboard.press("PageDown");
    await page.waitForTimeout(250);
    const key = await page.evaluate(() => scrollY);
    const layout = await page.evaluate(() => ({
      overflow: document.documentElement.scrollWidth > innerWidth,
      outline: getComputedStyle(document.querySelector(".outline")).position,
      context: getComputedStyle(document.querySelector(".context")).position,
    }));
    if (!wheel || !key || layout.overflow || layout.outline !== "static" || layout.context !== "static") throw new Error(`滚动异常：${JSON.stringify({ size, wheel, key, layout })}`);
    await page.locator("#goal-text").fill("教师测试目标");
    const action = page.getByTestId("confirm-goal");
    await action.scrollIntoViewIfNeeded();
    const clickable = await action.evaluate((el) => {
      const r = el.getBoundingClientRect();
      return document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2)?.closest("button") === el;
    });
    if (!clickable) throw new Error(`底部操作被遮挡：${size.width}`);
    console.log(`PASS ${size.width}×${size.height} 滚轮、PageDown、面板和底部操作`);
  }
  await page.setViewportSize({ width: 1366, height: 768 });
  await page.getByTestId("confirm-goal").click();
  const target = page.getByTestId("ol-step-2");
  await target.scrollIntoViewIfNeeded();
  const before = await page.evaluate(() => scrollY);
  await target.click();
  const after = await page.evaluate(() => scrollY);
  if (Math.abs(before - after) > 5) throw new Error(`切换环节时页面跳动：${before} → ${after}`);
  console.log("PASS 切换环节不强制跳回顶部");
} finally {
  await browser.close();
}
