import { useEffect, useRef, useState } from "react";
import { useStore } from "../../app/store";
import type { Activity, PlanDraft } from "../../domain/types";
/** In-memory editing history. Approval and revision boundaries clear both stacks. */
export function useDraftHistory(activity: Activity) {
  const { dispatch } = useStore();
  const boundary = `${activity.id}:${activity.versions.length}:${activity.draftLocked}:${activity.draft.basedOnVersionNo ?? 0}`;
  const history = useRef({
    current: activity.draft,
    past: [] as PlanDraft[],
    future: [] as PlanDraft[],
    boundary,
    restoring: false,
  });
  const [available, setAvailable] = useState({ undo: 0, redo: 0 });
  useEffect(() => {
    const h = history.current;
    if (h.boundary !== boundary) {
      h.past = [];
      h.future = [];
      h.boundary = boundary;
      h.restoring = false;
    } else if (h.current.revision !== activity.draft.revision) {
      if (h.restoring) h.restoring = false;
      else {
        h.past = [...h.past.slice(-39), h.current];
        h.future = [];
      }
    }
    h.current = activity.draft;
    setAvailable({ undo: h.past.length, redo: h.future.length });
  }, [activity.draft, boundary]);
  const restore = (direction: "undo" | "redo") => {
    const h = history.current;
    if (activity.draftLocked || h.boundary !== boundary) return;
    const from = direction === "undo" ? h.past : h.future;
    const to = direction === "undo" ? h.future : h.past;
    const draft = from.pop();
    if (!draft) return;
    to.push(h.current);
    h.restoring = true;
    dispatch({
      type: "plan/restore-edit",
      activityId: activity.id,
      draft,
      expectedRevision: activity.draft.revision,
      versionCount: activity.versions.length,
    });
  };
  const sourceRev = activity.draft.steps.find(
    (s) => s.needsReview,
  )?.basedOnGoalRev;
  const comparison =
    history.current.past.find((d) => d.goal.rev === sourceRev) ??
    activity.versions.at(-1)?.snapshot;
  return { ...available, restore, comparison };
}
