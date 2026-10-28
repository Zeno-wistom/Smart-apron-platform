import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { reducer, type Action } from "../domain/reducer";
import type { AppData } from "../domain/types";
import { initialData } from "../domain/fixtures";
import * as storage from "../services/storage";

export type SaveState =
  | { kind: "idle"; savedAt?: string }
  | { kind: "pending" }
  | { kind: "saved"; savedAt: string }
  | { kind: "error"; error: string };

export interface Toast {
  id: number;
  tone: "info" | "success" | "warn" | "error";
  text: string;
}

interface StoreValue {
  data: AppData;
  dispatch: (a: Action) => void;
  /** 读取最新数据（异步回调里使用，避免闭包中的旧值） */
  latest: () => AppData;
  save: SaveState;
  saveNow: () => boolean;
  loadStatus: storage.LoadResult["status"];
  corruptRaw?: string;
  resetAll: () => void;
  toasts: Toast[];
  toast: (text: string, tone?: Toast["tone"]) => void;
  dismissToast: (id: number) => void;
}

const Ctx = createContext<StoreValue | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const loaded = useMemo(() => storage.load(), []);
  const [data, setData] = useState<AppData>(loaded.data);
  const dataRef = useRef(data);
  const [loadStatus, setLoadStatus] = useState(loaded.status);
  const [save, setSave] = useState<SaveState>(
    loaded.status === "restored" ? { kind: "saved", savedAt: loaded.savedAt } : { kind: "idle" },
  );
  const first = useRef(true);
  const timer = useRef<number | undefined>(undefined);

  const persist = useCallback(() => {
    if (loadStatus === "corrupt") return false; // 损坏数据不自动覆盖
    window.clearTimeout(timer.current);
    const r = storage.save(dataRef.current);
    setSave(r.ok ? { kind: "saved", savedAt: r.savedAt } : { kind: "error", error: r.error });
    return r.ok;
  }, [loadStatus]);

  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    if (loadStatus === "corrupt") return;
    setSave({ kind: "pending" });
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(persist, 400);
  }, [data, persist, loadStatus]);

  useEffect(() => {
    const flush = () => {
      if (loadStatus !== "corrupt") storage.save(dataRef.current);
    };
    window.addEventListener("beforeunload", flush);
    return () => window.removeEventListener("beforeunload", flush);
  }, [loadStatus]);

  const dispatch = useCallback((a: Action) => {
    // 单一数据源：同步计算并更新 ref，保证连续派发与异步 guard 读取到最新值
    const next = reducer(dataRef.current, a);
    if (next === dataRef.current) return;
    dataRef.current = next;
    setData(next);
  }, []);

  const [toasts, setToasts] = useState<Toast[]>([]);
  const seq = useRef(0);
  const dismissToast = useCallback((id: number) => setToasts((t) => t.filter((x) => x.id !== id)), []);
  const toast = useCallback(
    (text: string, tone: Toast["tone"] = "info") => {
      const id = ++seq.current;
      setToasts((t) => [...t.slice(-1), { id, text, tone }]);
      window.setTimeout(() => dismissToast(id), tone === "error" || tone === "warn" ? 6000 : 3200);
    },
    [dismissToast],
  );

  const resetAll = useCallback(() => {
    storage.clear();
    const fresh = initialData();
    dataRef.current = fresh;
    setData(fresh);
    setLoadStatus("fresh");
    const r = storage.save(fresh);
    setSave(r.ok ? { kind: "saved", savedAt: r.savedAt } : { kind: "error", error: r.error });
  }, []);

  const value: StoreValue = {
    data,
    dispatch,
    latest: () => dataRef.current,
    save,
    saveNow: persist,
    loadStatus,
    corruptRaw: loaded.status === "corrupt" ? loaded.raw : undefined,
    resetAll,
    toasts,
    toast,
    dismissToast,
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useStore() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useStore must be used within StoreProvider");
  return v;
}

export function useActivity(id: string | undefined) {
  const { data } = useStore();
  const activity = data.activities.find((a) => a.id === id);
  const child = activity ? data.children.find((c) => c.id === activity.childId) : undefined;
  return { activity, child };
}

/* ---------------- 进行中的异步请求（仅内存） ---------------- */

type PendingMap = Record<string, { requestId: string; label: string } | undefined>;
type ErrorMap = Record<string, string | undefined>;

interface RequestsValue {
  pending: PendingMap;
  errors: ErrorMap;
  begin: (key: string, label: string) => string;
  end: (key: string, requestId: string, error?: string) => boolean;
  isCurrent: (key: string, requestId: string) => boolean;
  cancel: (key: string) => void;
  clearError: (key: string) => void;
}

const ReqCtx = createContext<RequestsValue | null>(null);

export function RequestsProvider({ children }: { children: ReactNode }) {
  const [pending, setPending] = useState<PendingMap>({});
  const [errors, setErrors] = useState<ErrorMap>({});
  const ref = useRef<PendingMap>({});
  const seq = useRef(0);

  const begin = useCallback((key: string, label: string) => {
    const requestId = `req-${++seq.current}`;
    ref.current = { ...ref.current, [key]: { requestId, label } };
    setPending(ref.current);
    setErrors((e) => ({ ...e, [key]: undefined }));
    return requestId;
  }, []);
  const isCurrent = useCallback((key: string, requestId: string) => ref.current[key]?.requestId === requestId, []);
  const end = useCallback((key: string, requestId: string, error?: string) => {
    if (ref.current[key]?.requestId !== requestId) return false; // 已被取消或被新请求替代
    ref.current = { ...ref.current, [key]: undefined };
    setPending(ref.current);
    if (error) setErrors((e) => ({ ...e, [key]: error }));
    return true;
  }, []);
  const cancel = useCallback((key: string) => {
    ref.current = { ...ref.current, [key]: undefined };
    setPending(ref.current);
  }, []);
  const clearError = useCallback((key: string) => setErrors((e) => ({ ...e, [key]: undefined })), []);

  return (
    <ReqCtx.Provider value={{ pending, errors, begin, end, isCurrent, cancel, clearError }}>{children}</ReqCtx.Provider>
  );
}

export function useRequests() {
  const v = useContext(ReqCtx);
  if (!v) throw new Error("useRequests must be used within RequestsProvider");
  return v;
}
