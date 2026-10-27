import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { createInitialAppData } from "../domain/fixtures";
import { appReducer, type AppAction } from "../domain/reducer";
import { selectSession } from "../domain/selectors";
import type { AppData, LessonSession } from "../domain/types";
import { localStorageRepository } from "../services/localStorageRepository";

export type LoadStatus = "loading" | "ready" | "error";
export type SaveStatus = "saved" | "saving" | "error";

interface HistoryEntry {
  sessionId: string;
  data: AppData;
}

interface AppContextValue {
  data: AppData;
  activeSession?: LessonSession;
  loadStatus: LoadStatus;
  loadError?: string;
  saveStatus: SaveStatus;
  update: (action: AppAction) => void;
  undo: (sessionId: string) => void;
  canUndo: (sessionId: string) => boolean;
  resetDemoData: () => Promise<void>;
}

const AppContext = createContext<AppContextValue | null>(null);

const nonUndoableActions = new Set<AppAction["type"]>([
  "session/add",
  "session/select",
  "session/approve",
  "transmission/result",
  "class-record/create",
  "reflection/review",
  "profile-history/create",
]);

export function AppProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<AppData>(() => createInitialAppData());
  const dataRef = useRef(data);
  const [loadStatus, setLoadStatus] = useState<LoadStatus>("loading");
  const [loadError, setLoadError] = useState<string>();
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("saved");
  const historyRef = useRef<HistoryEntry[]>([]);
  const lastHistoryKeyRef = useRef<string | undefined>(undefined);
  const saveSequenceRef = useRef(0);

  useEffect(() => {
    let active = true;
    localStorageRepository
      .load()
      .then((stored) => {
        if (!active) return;
        const next = stored ?? createInitialAppData();
        dataRef.current = next;
        setData(next);
        setLoadStatus("ready");
      })
      .catch((error: unknown) => {
        if (!active) return;
        setLoadError(error instanceof Error ? error.message : "无法读取本地演示数据。 ");
        setLoadStatus("error");
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (loadStatus !== "ready") return;
    const sequence = ++saveSequenceRef.current;
    setSaveStatus("saving");
    localStorageRepository
      .save(data)
      .then(() => {
        if (sequence === saveSequenceRef.current) setSaveStatus("saved");
      })
      .catch(() => {
        if (sequence === saveSequenceRef.current) setSaveStatus("error");
      });
  }, [data, loadStatus]);

  function update(action: AppAction): void {
    const current = dataRef.current;
    const next = appReducer(current, {
      ...action,
      at: action.at ?? new Date().toISOString(),
    });
    if (next === current) return;

    const undoable = !action.skipHistory && !nonUndoableActions.has(action.type);
    if (undoable) {
      if (action.historyKey !== lastHistoryKeyRef.current) {
        const sessionId =
          "sessionId" in action ? action.sessionId : current.activeSessionId;
        if (sessionId) {
          historyRef.current = [
            ...historyRef.current.slice(-29),
            { sessionId, data: current },
          ];
        }
      }
    }
    lastHistoryKeyRef.current = action.historyKey;
    dataRef.current = next;
    setData(next);
  }

  function canUndo(sessionId: string): boolean {
    return historyRef.current.at(-1)?.sessionId === sessionId;
  }

  function undo(sessionId: string): void {
    const previous = historyRef.current.at(-1);
    if (!previous || previous.sessionId !== sessionId) return;
    historyRef.current = historyRef.current.slice(0, -1);
    lastHistoryKeyRef.current = undefined;
    dataRef.current = previous.data;
    setData(previous.data);
  }

  async function resetDemoData(): Promise<void> {
    setLoadStatus("loading");
    setLoadError(undefined);
    try {
      await localStorageRepository.resetToFixtures();
      const next = createInitialAppData();
      historyRef.current = [];
      lastHistoryKeyRef.current = undefined;
      dataRef.current = next;
      setData(next);
      setLoadStatus("ready");
    } catch (error: unknown) {
      setLoadError(error instanceof Error ? error.message : "无法恢复演示数据。 ");
      setLoadStatus("error");
    }
  }

  const value: AppContextValue = {
    data,
    activeSession: selectSession(data, data.activeSessionId),
    loadStatus,
    loadError,
    saveStatus,
    update,
    undo,
    canUndo,
    resetDemoData,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp(): AppContextValue {
  const context = useContext(AppContext);
  if (!context) throw new Error("useApp 必须在 AppProvider 内使用。 ");
  return context;
}
