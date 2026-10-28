const BASE = process.env.BASE_URL ?? "http://127.0.0.1:5184";
import { launchBrowser } from "./browser.mjs";
import { writeFileSync } from "node:fs";
const b = await launchBrowser(),
  p = await b.newPage({ viewport: { width: 1366, height: 900 } });
const results = [];
const check = (name, ok) => {
  results.push({ name, ok: !!ok });
  console.log(`${ok ? "PASS" : "FAIL"} ${name}`);
  if (!ok) throw Error(name);
};
async function tabTo(locator) {
  await locator.waitFor();
  for (let i = 0; i < 150; i++) {
    if (await locator.evaluate((el) => el === document.activeElement)) return;
    await p.keyboard.press("Tab");
  }
  throw Error("Cannot reach " + locator);
}
async function activate(locator) {
  await tabTo(locator);
  await p.keyboard.press("Enter");
}
try {
  await p.goto(`${BASE}/?fast=1#/`);
  await activate(p.getByRole("button", { name: "新建教学活动" }));
  await tabTo(p.locator("#goal-text"));
  await p.keyboard.type("在视觉提示下练习轮流表达");
  await tabTo(p.locator("#goal-observe"));
  await p.keyboard.type("记录每轮回应与提示层级");
  await activate(p.getByTestId("generate-lesson"));
  await activate(p.getByTestId("adopt-lesson"));
  await activate(p.getByTestId("open-preflight"));
  await p.waitForTimeout(80);
  const dialog = p.getByRole("dialog");
  const controls = dialog.locator(
    "button:not(:disabled),input:not(:disabled),select:not(:disabled),a[href]",
  );
  const count = await controls.count();
  const last = controls.last();
  await tabTo(last);
  await p.keyboard.press("Tab");
  check(
    "抽屉 Tab 首尾循环",
    await controls.first().evaluate((el) => el === document.activeElement),
  );
  await p.keyboard.press("Shift+Tab");
  check(
    "抽屉 Shift+Tab 反向循环",
    await last.evaluate((el) => el === document.activeElement),
  );
  await p.keyboard.press("Escape");
  check(
    "Esc 关闭并归还触发按钮焦点",
    await p
      .getByTestId("open-preflight")
      .evaluate((el) => el === document.activeElement),
  );
  await p.keyboard.press("Enter");
  await tabTo(p.getByLabel(/我已核对教案/));
  await p.keyboard.press("Space");
  await activate(p.getByTestId("prepare-lesson"));
  await p.getByTestId("receipt").waitFor();
  await activate(p.getByRole("button", { name: "进入课堂与复盘" }));
  await activate(p.getByRole("button", { name: "结束模拟课堂并生成复盘" }));
  await p.getByTestId("refl-item").first().waitFor();
  await tabTo(p.locator("#teacher-summary"));
  await p.keyboard.type("本次记录来自模拟，已核对教学流程与暂停节点。");
  await tabTo(p.locator("#proposed-observation"));
  await p.keyboard.press("Control+A");
  await p.keyboard.type("模拟流程已验证，不代表儿童真实能力。");
  await activate(p.getByTestId("complete-and-apply"));
  await activate(p.getByTestId("apply-confirm"));
  await activate(p.getByTestId("view-profile"));
  await p.getByTestId("observation").nth(1).waitFor();
  check("仅键盘完成备课至档案闭环", true);
  await p.screenshot({ path: "docs/ux/after/keyboard-profile.png" });
} catch (e) {
  console.error(e);
  await p.screenshot({ path: "docs/ux/after/keyboard-failure.png" });
  process.exitCode = 1;
} finally {
  writeFileSync(
    "docs/ux/after/keyboard-results.json",
    JSON.stringify(results, null, 2),
  );
  await b.close();
}
