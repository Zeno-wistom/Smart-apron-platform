import type {
  AppData,
  ApronMapping,
  ClassRecord,
  Goal,
  LessonSession,
  LessonStep,
  ProfileHistoryEntry,
  Reflection,
  Story,
  StoryScene,
} from "./types";
import {
  getApprovalBlockers,
  getUnmappedCueIds,
  hasCurrentApproval,
  isSessionContentLocked,
} from "./selectors";

interface ActionMeta {
  historyKey?: string;
  skipHistory?: boolean;
  at?: string;
}

export type AppAction = ActionMeta &
  (
    | { type: "session/add"; session: LessonSession }
    | { type: "session/select"; sessionId: string }
    | { type: "goals/add"; sessionId: string; goal: Goal }
    | { type: "goals/update"; sessionId: string; goalId: string; text: string }
    | { type: "goals/remove"; sessionId: string; goalId: string }
    | {
        type: "goals/update-details";
        sessionId: string;
        constraintText?: string;
        teacherNotes?: string;
      }
    | { type: "goals/confirm"; sessionId: string }
    | { type: "goals/unlock"; sessionId: string }
    | { type: "steps/append"; sessionId: string; steps: LessonStep[] }
    | {
        type: "step/update";
        sessionId: string;
        stepId: string;
        patch: Partial<
          Pick<LessonStep, "title" | "teacherInstruction" | "interaction" | "note">
        >;
      }
    | {
        type: "step/adopt";
        sessionId: string;
        stepId: string;
        replacement: LessonStep;
      }
    | { type: "step/delete"; sessionId: string; stepId: string }
    | { type: "step/move"; sessionId: string; stepId: string; direction: -1 | 1 }
    | { type: "step/confirm"; sessionId: string; stepId: string }
    | { type: "step/unlock"; sessionId: string; stepId: string }
    | { type: "story/apply"; sessionId: string; story: Story }
    | {
        type: "story/update";
        sessionId: string;
        patch: Partial<Pick<Story, "title" | "summary">>;
      }
    | {
        type: "scene/update";
        sessionId: string;
        sceneId: string;
        patch: Partial<
          Pick<StoryScene, "title" | "text" | "characters" | "interaction">
        >;
      }
    | { type: "story/rebase"; sessionId: string }
    | { type: "story/confirm"; sessionId: string }
    | { type: "story/unlock"; sessionId: string }
    | { type: "apron/apply"; sessionId: string; mappings: ApronMapping[] }
    | {
        type: "apron/update";
        sessionId: string;
        cueId: string;
        patch: Partial<Pick<ApronMapping, "moduleId" | "enabled" | "note">>;
      }
    | { type: "apron/rebase"; sessionId: string }
    | { type: "apron/confirm"; sessionId: string }
    | { type: "apron/unlock"; sessionId: string }
    | {
        type: "session/approve";
        sessionId: string;
        snapshotId: string;
        approvedAt: string;
      }
    | {
        type: "transmission/result";
        sessionId: string;
        status: "success" | "failure";
        message: string;
      }
    | { type: "class-record/create"; sessionId: string; record: ClassRecord }
    | { type: "reflection/apply"; sessionId: string; reflection: Reflection }
    | {
        type: "reflection/update";
        sessionId: string;
        patch: Partial<Pick<Reflection, "observations" | "suggestions">>;
      }
    | { type: "reflection/review"; sessionId: string; reviewedAt: string }
    | { type: "reflection/unlock"; sessionId: string }
    | { type: "professional/update"; sessionId: string; note: string }
    | {
        type: "profile-history/create";
        sessionId: string;
        entry: ProfileHistoryEntry;
      }
  );

function updateSession(
  data: AppData,
  sessionId: string,
  at: string,
  updater: (session: LessonSession) => LessonSession,
): AppData {
  const current = data.sessions.find((session) => session.id === sessionId);
  if (!current) return data;
  const updated = updater(current);
  if (updated === current) return data;
  return {
    ...data,
    sessions: data.sessions.map((session) =>
      session.id === sessionId ? { ...updated, updatedAt: at } : session,
    ),
  };
}

function bumpPlan(session: LessonSession): LessonSession {
  return { ...session, planRevision: session.planRevision + 1 };
}

export function appReducer(data: AppData, action: AppAction): AppData {
  const at = action.at ?? new Date().toISOString();
  switch (action.type) {
    case "session/add":
      if (data.sessions.some((session) => session.id === action.session.id)) return data;
      return {
        ...data,
        sessions: [action.session, ...data.sessions],
        activeSessionId: action.session.id,
      };
    case "session/select":
      if (!data.sessions.some((session) => session.id === action.sessionId)) return data;
      return { ...data, activeSessionId: action.sessionId };
    case "goals/add":
      return updateSession(data, action.sessionId, at, (session) => {
        if (
          isSessionContentLocked(session) ||
          session.goalSet.status === "confirmed" ||
          !action.goal.text.trim()
        ) {
          return session;
        }
        return bumpPlan({
          ...session,
          goalSet: {
            ...session.goalSet,
            items: [...session.goalSet.items, action.goal],
          },
        });
      });
    case "goals/update":
      return updateSession(data, action.sessionId, at, (session) => {
        if (isSessionContentLocked(session) || session.goalSet.status === "confirmed") {
          return session;
        }
        return bumpPlan({
          ...session,
          goalSet: {
            ...session.goalSet,
            items: session.goalSet.items.map((goal) =>
              goal.id === action.goalId ? { ...goal, text: action.text } : goal,
            ),
          },
        });
      });
    case "goals/remove":
      return updateSession(data, action.sessionId, at, (session) => {
        if (isSessionContentLocked(session) || session.goalSet.status === "confirmed") {
          return session;
        }
        return bumpPlan({
          ...session,
          goalSet: {
            ...session.goalSet,
            items: session.goalSet.items.filter((goal) => goal.id !== action.goalId),
          },
        });
      });
    case "goals/update-details":
      return updateSession(data, action.sessionId, at, (session) => {
        if (isSessionContentLocked(session) || session.goalSet.status === "confirmed") {
          return session;
        }
        const constraints =
          action.constraintText === undefined
            ? session.goalSet.constraints
            : action.constraintText.split("\n").map((text, index) => ({
                id: session.goalSet.constraints[index]?.id ?? `constraint-${index + 1}`,
                text,
              }));
        return bumpPlan({
          ...session,
          goalSet: {
            ...session.goalSet,
            constraints,
            teacherNotes: action.teacherNotes ?? session.goalSet.teacherNotes,
          },
        });
      });
    case "goals/confirm":
      return updateSession(data, action.sessionId, at, (session) => {
        if (
          isSessionContentLocked(session) ||
          session.goalSet.status === "confirmed" ||
          !session.goalSet.items.some((goal) => goal.text.trim())
        ) {
          return session;
        }
        return bumpPlan({
          ...session,
          goalSet: {
            ...session.goalSet,
            items: session.goalSet.items.filter((goal) => goal.text.trim()),
            constraints: session.goalSet.constraints.filter((item) => item.text.trim()),
            status: "confirmed",
            revision: session.goalSet.revision + 1,
          },
        });
      });
    case "goals/unlock":
      return updateSession(data, action.sessionId, at, (session) => {
        if (isSessionContentLocked(session) || session.goalSet.status === "draft") {
          return session;
        }
        return {
          ...session,
          goalSet: { ...session.goalSet, status: "draft" },
        };
      });
    case "steps/append":
      return updateSession(data, action.sessionId, at, (session) => {
        if (isSessionContentLocked(session) || session.goalSet.status !== "confirmed") {
          return session;
        }
        const existingIds = new Set(session.steps.map((step) => step.id));
        const additions = action.steps.filter((step) => !existingIds.has(step.id));
        if (additions.length === 0) return session;
        return bumpPlan({ ...session, steps: [...session.steps, ...additions] });
      });
    case "step/update":
      return updateSession(data, action.sessionId, at, (session) => {
        const target = session.steps.find((step) => step.id === action.stepId);
        if (isSessionContentLocked(session) || !target || target.status === "confirmed") {
          return session;
        }
        return bumpPlan({
          ...session,
          steps: session.steps.map((step) =>
            step.id === action.stepId ? { ...step, ...action.patch } : step,
          ),
        });
      });
    case "step/adopt":
      return updateSession(data, action.sessionId, at, (session) => {
        const target = session.steps.find((step) => step.id === action.stepId);
        if (isSessionContentLocked(session) || !target || target.status === "confirmed") {
          return session;
        }
        return bumpPlan({
          ...session,
          steps: session.steps.map((step) =>
            step.id === action.stepId
              ? {
                  ...action.replacement,
                  id: step.id,
                  status: "draft" as const,
                }
              : step,
          ),
        });
      });
    case "step/delete":
      return updateSession(data, action.sessionId, at, (session) => {
        if (isSessionContentLocked(session)) return session;
        const steps = session.steps.filter((step) => step.id !== action.stepId);
        if (steps.length === session.steps.length) return session;
        return bumpPlan({ ...session, steps });
      });
    case "step/move":
      return updateSession(data, action.sessionId, at, (session) => {
        if (isSessionContentLocked(session)) return session;
        const index = session.steps.findIndex((step) => step.id === action.stepId);
        const nextIndex = index + action.direction;
        if (index < 0 || nextIndex < 0 || nextIndex >= session.steps.length) return session;
        const steps = [...session.steps];
        [steps[index], steps[nextIndex]] = [steps[nextIndex], steps[index]];
        return bumpPlan({ ...session, steps });
      });
    case "step/confirm":
      return updateSession(data, action.sessionId, at, (session) => {
        const target = session.steps.find((step) => step.id === action.stepId);
        if (
          isSessionContentLocked(session) ||
          !target ||
          !target.title.trim() ||
          !target.teacherInstruction.trim()
        ) {
          return session;
        }
        return bumpPlan({
          ...session,
          steps: session.steps.map((step) =>
            step.id === action.stepId ? { ...step, status: "confirmed" as const } : step,
          ),
        });
      });
    case "step/unlock":
      return updateSession(data, action.sessionId, at, (session) => {
        if (isSessionContentLocked(session)) return session;
        return {
          ...session,
          steps: session.steps.map((step) =>
            step.id === action.stepId ? { ...step, status: "draft" as const } : step,
          ),
        };
      });
    case "story/apply":
      return updateSession(data, action.sessionId, at, (session) => {
        if (isSessionContentLocked(session)) return session;
        return {
          ...session,
          story: {
            ...action.story,
            status: "draft",
            basedOnPlanRevision: session.planRevision,
          },
        };
      });
    case "story/update":
      return updateSession(data, action.sessionId, at, (session) => {
        if (isSessionContentLocked(session) || session.story.status === "confirmed") {
          return session;
        }
        return { ...session, story: { ...session.story, ...action.patch } };
      });
    case "scene/update":
      return updateSession(data, action.sessionId, at, (session) => {
        if (isSessionContentLocked(session) || session.story.status === "confirmed") {
          return session;
        }
        return {
          ...session,
          story: {
            ...session.story,
            scenes: session.story.scenes.map((scene) =>
              scene.id === action.sceneId ? { ...scene, ...action.patch } : scene,
            ),
          },
        };
      });
    case "story/rebase":
      return updateSession(data, action.sessionId, at, (session) => {
        if (isSessionContentLocked(session) || session.story.scenes.length === 0) {
          return session;
        }
        const stepOrder = new Map(session.steps.map((step, index) => [step.id, index]));
        if (session.story.scenes.some((scene) => !stepOrder.has(scene.stepId))) {
          return session;
        }
        return {
          ...session,
          story: {
            ...session.story,
            basedOnPlanRevision: session.planRevision,
            scenes: [...session.story.scenes].sort(
              (a, b) => (stepOrder.get(a.stepId) ?? 0) - (stepOrder.get(b.stepId) ?? 0),
            ),
          },
        };
      });
    case "story/confirm":
      return updateSession(data, action.sessionId, at, (session) => {
        const stepIds = new Set(session.steps.map((step) => step.id));
        if (
          isSessionContentLocked(session) ||
          session.story.scenes.length === 0 ||
          session.story.basedOnPlanRevision !== session.planRevision ||
          session.story.scenes.some((scene) => !stepIds.has(scene.stepId))
        ) {
          return session;
        }
        return { ...session, story: { ...session.story, status: "confirmed" } };
      });
    case "story/unlock":
      return updateSession(data, action.sessionId, at, (session) => {
        if (isSessionContentLocked(session) || session.story.status === "draft") {
          return session;
        }
        return { ...session, story: { ...session.story, status: "draft" } };
      });
    case "apron/apply":
      return updateSession(data, action.sessionId, at, (session) => {
        if (isSessionContentLocked(session)) return session;
        return {
          ...session,
          apronConfig: {
            mappings: action.mappings,
            status: "draft",
            basedOnPlanRevision: session.planRevision,
          },
        };
      });
    case "apron/update":
      return updateSession(data, action.sessionId, at, (session) => {
        if (isSessionContentLocked(session) || session.apronConfig.status === "confirmed") {
          return session;
        }
        const exists = session.apronConfig.mappings.some(
          (mapping) => mapping.cueId === action.cueId,
        );
        const mappings = exists
          ? session.apronConfig.mappings.map((mapping) =>
              mapping.cueId === action.cueId ? { ...mapping, ...action.patch } : mapping,
            )
          : [
              ...session.apronConfig.mappings,
              {
                cueId: action.cueId,
                moduleId: action.patch.moduleId ?? "",
                enabled: action.patch.enabled ?? true,
                note: action.patch.note ?? "",
              },
            ];
        return {
          ...session,
          apronConfig: { ...session.apronConfig, mappings },
        };
      });
    case "apron/rebase":
      return updateSession(data, action.sessionId, at, (session) => {
        if (isSessionContentLocked(session) || getUnmappedCueIds(session).length > 0) {
          return session;
        }
        return {
          ...session,
          apronConfig: {
            ...session.apronConfig,
            basedOnPlanRevision: session.planRevision,
          },
        };
      });
    case "apron/confirm":
      return updateSession(data, action.sessionId, at, (session) => {
        if (
          isSessionContentLocked(session) ||
          session.story.status !== "confirmed" ||
          session.apronConfig.basedOnPlanRevision !== session.planRevision ||
          getUnmappedCueIds(session).length > 0
        ) {
          return session;
        }
        return {
          ...session,
          apronConfig: { ...session.apronConfig, status: "confirmed" },
        };
      });
    case "apron/unlock":
      return updateSession(data, action.sessionId, at, (session) => {
        if (isSessionContentLocked(session) || session.apronConfig.status === "draft") {
          return session;
        }
        return {
          ...session,
          apronConfig: { ...session.apronConfig, status: "draft" },
        };
      });
    case "session/approve":
      return updateSession(data, action.sessionId, at, (session) => {
        if (
          isSessionContentLocked(session) ||
          hasCurrentApproval(session) ||
          getApprovalBlockers(session).length > 0
        ) {
          return session;
        }
        return {
          ...session,
          approval: {
            id: action.snapshotId,
            childId: session.childId,
            sessionTitle: session.title,
            approvedAt: action.approvedAt,
            planRevision: session.planRevision,
            goalSet: structuredClone(session.goalSet),
            steps: structuredClone(session.steps),
            story: structuredClone(session.story),
            apronConfig: structuredClone(session.apronConfig),
          },
          transmission: { mode: "simulated", status: "idle", attempts: 0 },
        };
      });
    case "transmission/result":
      return updateSession(data, action.sessionId, at, (session) => {
        if (!hasCurrentApproval(session)) return session;
        return {
          ...session,
          transmission: {
            mode: "simulated",
            status: action.status,
            attempts: session.transmission.attempts + 1,
            message: action.message,
            updatedAt: at,
          },
        };
      });
    case "class-record/create":
      return updateSession(data, action.sessionId, at, (session) => {
        if (
          session.classRecord ||
          session.transmission.status !== "success" ||
          action.record.sessionId !== session.id
        ) {
          return session;
        }
        return { ...session, classRecord: action.record };
      });
    case "reflection/apply":
      return updateSession(data, action.sessionId, at, (session) => {
        if (!session.classRecord || session.reflection) return session;
        return { ...session, reflection: action.reflection };
      });
    case "reflection/update":
      return updateSession(data, action.sessionId, at, (session) => {
        if (!session.reflection || session.reflection.status === "reviewed") {
          return session;
        }
        return {
          ...session,
          reflection: {
            ...session.reflection,
            ...action.patch,
            updatedAt: at,
          },
        };
      });
    case "reflection/review":
      return updateSession(data, action.sessionId, at, (session) => {
        if (!session.reflection || !session.reflection.observations.trim()) return session;
        return {
          ...session,
          reflection: {
            ...session.reflection,
            status: "reviewed",
            reviewedAt: action.reviewedAt,
            updatedAt: at,
          },
        };
      });
    case "reflection/unlock":
      if (data.profileHistory.some((entry) => entry.sessionId === action.sessionId)) {
        return data;
      }
      return updateSession(data, action.sessionId, at, (session) => {
        if (!session.reflection || session.reflection.status === "draft") return session;
        return {
          ...session,
          reflection: {
            ...session.reflection,
            status: "draft",
            reviewedAt: undefined,
            updatedAt: at,
          },
        };
      });
    case "professional/update":
      return updateSession(data, action.sessionId, at, (session) => ({
        ...session,
        professionalAssessment: {
          note: action.note,
          authorRole: "teacher",
          updatedAt: at,
        },
      }));
    case "profile-history/create": {
      const session = data.sessions.find((item) => item.id === action.sessionId);
      if (
        !session ||
        session.reflection?.status !== "reviewed" ||
        action.entry.sessionId !== session.id ||
        data.profileHistory.some((entry) => entry.sessionId === session.id)
      ) {
        return data;
      }
      return { ...data, profileHistory: [action.entry, ...data.profileHistory] };
    }
  }
}
