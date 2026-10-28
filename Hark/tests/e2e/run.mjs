import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
const cwd = fileURLToPath(new URL("../../", import.meta.url));
const port = process.env.E2E_PORT ?? "5194";
const base = `http://127.0.0.1:${port}`;
const vite = spawn(
  process.execPath,
  [
    resolve(cwd, "node_modules/vite/bin/vite.js"),
    "--host",
    "127.0.0.1",
    "--port",
    port,
    "--strictPort",
  ],
  { cwd, windowsHide: true, stdio: ["ignore", "pipe", "pipe"] },
);
let output = "";
vite.stdout.on("data", (s) => {
  output += s;
});
vite.stderr.on("data", (s) => {
  output += s;
});
let ready = false;
try {
  for (let attempt = 0; attempt < 60; attempt++) {
    if (vite.exitCode !== null)
      throw Error("Isolated test server failed: " + output);
    try {
      const response = await fetch(base, { signal: AbortSignal.timeout(250) });
      if (response.ok && output.includes(base)) {
        ready = true;
        break;
      }
    } catch {}
    await new Promise((r) => setTimeout(r, 150));
  }
  if (!ready) throw Error("Test server not ready: " + output);
  console.log("Isolated E2E server: " + base);
  for (const script of [
    "ux-flow.mjs",
    "ux-class.mjs",
    "ux-recovery.mjs",
    "ux-keyboard.mjs",
    "ux-undo.mjs",
    "ux-audit.mjs",
  ]) {
    const code = await new Promise((resolve, reject) => {
      const child = spawn(process.execPath, [resolvePath(script)], {
        cwd,
        windowsHide: true,
        stdio: "inherit",
        env: { ...process.env, BASE_URL: base },
      });
      child.on("error", reject);
      child.on("exit", resolve);
    });
    if (code !== 0) throw Error(`${script} failed (${code})`);
  }
} catch (error) {
  console.error(error);
  process.exitCode = 1;
} finally {
  vite.kill();
}
function resolvePath(script) {
  return resolve(cwd, "tests/e2e", script);
}
