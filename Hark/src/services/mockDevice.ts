/**
 * 模拟围裙设备适配器。
 * 真实围裙的接口、协议、模块与参数均未确认，这里不定义任何物理通信细节。
 */
import { checksum } from "../domain/checks";
import { uid } from "../domain/fixtures";
import type { PlanVersion, TransferAttempt } from "../domain/types";
import { simControls } from "./simControls";

const wait = (ms: number) => new Promise((r) => setTimeout(r, simControls.latency(ms)));

export async function connectSimulated(): Promise<{ ok: true; label: string }> {
  await wait(600);
  return { ok: true, label: "模拟围裙（未连接真实设备）" };
}

export async function transferSimulated(version: PlanVersion): Promise<TransferAttempt> {
  await wait(1000);
  const at = new Date().toISOString();
  if (simControls.consumeTransferFailure()) {
    return {
      id: uid("tx"),
      versionId: version.id,
      versionNo: version.versionNo,
      at,
      ok: false,
      message: "模拟传输中断：未收到模拟回执（演示控制触发）。教案版本未受影响，可直接重试。",
      simulated: true,
    };
  }
  const sum = checksum(version.snapshot);
  return {
    id: uid("tx"),
    versionId: version.id,
    versionNo: version.versionNo,
    at,
    ok: true,
    message: "模拟传输完成。没有数据发送到真实设备。",
    receipt: {
      receiptId: `SIM-${sum.slice(0, 4).toUpperCase()}-${Date.now().toString(36).slice(-4).toUpperCase()}`,
      checksum: sum,
      stepCount: version.snapshot.steps.length,
      sceneCount: version.snapshot.story?.scenes.length ?? 0,
    },
    simulated: true,
  };
}
