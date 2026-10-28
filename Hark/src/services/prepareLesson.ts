import type { Action } from "../domain/reducer";
import type { AppData, PlanVersion, TransferAttempt } from "../domain/types";
import { checksum } from "../domain/checks";
import { uid } from "../domain/fixtures";
import { connectSimulated, transferSimulated } from "./mockDevice";

interface PrepareContext {
  latest: () => AppData;
  dispatch: (action: Action) => void;
  persist: () => boolean;
  connect?: typeof connectSimulated;
  transfer?: (version: PlanVersion) => Promise<TransferAttempt>;
}
/** Order is a contract: approve → durable snapshot → connect → transfer → durable receipt. */
export async function prepareLesson(
  ctx: PrepareContext,
  activityId: string,
  expectedRevision: number,
) {
  let a = ctx.latest().activities.find((a) => a.id === activityId);
  if (!a) throw Error("教学活动已不存在");
  if (!a.draftLocked) {
    const versionId = uid("ver");
    ctx.dispatch({
      type: "plan/approve-ready",
      activityId,
      expectedRevision,
      versionId,
      at: new Date().toISOString(),
    });
    a = ctx.latest().activities.find((a) => a.id === activityId)!;
    if (!a.draftLocked || a.versions.at(-1)?.id !== versionId)
      throw Error("内容或版本已变化，请重新完成课前检查");
  }
  const version = a.versions.at(-1);
  if (!version || checksum(version.snapshot) !== version.checksum)
    throw Error("批准版本校验失败，未开始传输");
  if (!ctx.persist())
    throw Error("批准快照尚未保存，未开始传输。请恢复本地保存后重试。");
  const existing = [...a.transfers]
    .reverse()
    .find((t) => t.versionId === version.id && t.ok);
  if (existing) return existing;
  await (ctx.connect ?? connectSimulated)();
  const attempt = await (ctx.transfer ?? transferSimulated)(version);
  if (
    attempt.versionId !== version.id ||
    attempt.versionNo !== version.versionNo ||
    (attempt.ok && attempt.receipt?.checksum !== version.checksum)
  )
    throw Error("传输回执与批准版本不一致，未接受回执");
  ctx.dispatch({ type: "transfer/record", activityId, attempt });
  if (!ctx.persist())
    throw Error("传输回执保存失败，请重试保存；批准版本仍保留。");
  if (!attempt.ok) throw Error(attempt.message);
  return attempt;
}
