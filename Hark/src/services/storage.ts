import { initialData } from "../domain/fixtures";
import type { AppData, Envelope } from "../domain/types";

/** 与根目录旧版本隔离的存储键 */
export const STORAGE_KEY = "smart-apron:hark:v1";

export type LoadResult =
  | { status: "fresh"; data: AppData }
  | { status: "restored"; data: AppData; savedAt: string }
  | { status: "corrupt"; data: AppData; raw: string };

function isEnvelope(v: unknown): v is Envelope {
  if (!v || typeof v !== "object") return false;
  const e = v as Envelope;
  return e.schemaVersion === 1 && Array.isArray(e.data?.children) && Array.isArray(e.data?.activities);
}

export function load(storage: Pick<Storage, "getItem"> = localStorage): LoadResult {
  const raw = storage.getItem(STORAGE_KEY);
  if (!raw) return { status: "fresh", data: initialData() };
  try {
    const parsed = JSON.parse(raw);
    if (!isEnvelope(parsed)) return { status: "corrupt", data: initialData(), raw };
    return { status: "restored", data: parsed.data, savedAt: parsed.savedAt };
  } catch {
    return { status: "corrupt", data: initialData(), raw };
  }
}

export function save(data: AppData, storage: Pick<Storage, "setItem"> = localStorage): { ok: true; savedAt: string } | { ok: false; error: string } {
  const savedAt = new Date().toISOString();
  try {
    const env: Envelope = { schemaVersion: 1, savedAt, data };
    storage.setItem(STORAGE_KEY, JSON.stringify(env));
    return { ok: true, savedAt };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "未知错误" };
  }
}

export function clear(storage: Pick<Storage, "removeItem"> = localStorage) {
  storage.removeItem(STORAGE_KEY);
}
