import { createInitialAppData } from "../domain/fixtures";
import type { AppData, PersistedEnvelope } from "../domain/types";
import type { AppStorage } from "./contracts";

export const STORAGE_KEY = "smart-apron:p0:v1";

export function encodeStorage(data: AppData, savedAt = new Date().toISOString()): string {
  const envelope: PersistedEnvelope = { schemaVersion: 1, savedAt, data };
  return JSON.stringify(envelope);
}

export function decodeStorage(raw: string): AppData {
  const parsed = JSON.parse(raw) as Partial<PersistedEnvelope>;
  if (
    parsed.schemaVersion !== 1 ||
    !parsed.data ||
    !Array.isArray(parsed.data.children) ||
    !Array.isArray(parsed.data.sessions) ||
    !Array.isArray(parsed.data.profileHistory) ||
    parsed.data.children.some((child) => child.isFictional !== true)
  ) {
    throw new Error("本地数据结构或版本不受支持。 ");
  }
  return parsed.data;
}

export const localStorageRepository: AppStorage = {
  async load(): Promise<AppData | null> {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? decodeStorage(raw) : null;
  },

  async save(data: AppData): Promise<void> {
    window.localStorage.setItem(STORAGE_KEY, encodeStorage(data));
  },

  async resetToFixtures(): Promise<void> {
    window.localStorage.setItem(STORAGE_KEY, encodeStorage(createInitialAppData()));
  },
};
