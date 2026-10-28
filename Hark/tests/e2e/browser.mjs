import { chromium } from "playwright";
export function launchBrowser() {
  const executablePath = process.env.CHROMIUM;
  return chromium.launch(
    executablePath
      ? { executablePath }
      : process.platform === "win32"
        ? { channel: "msedge" }
        : {},
  );
}
