import { sceneConflicts } from "./checks";
import { cueById } from "./fixtures";
import type { Constraint, Scene, Step } from "./types";
/** Deterministic recommendations. Suppressed choices stay visible, never modify an existing choice. */
export function cueMatch(
  scene: Scene,
  role: Step["role"],
  constraints: Constraint[],
) {
  const proposed =
    role === "warmup"
      ? ["cue-lighthouse-glow", "cue-horn", "cue-soft-chime"]
      : role === "review"
        ? ["cue-lighthouse-glow"]
        : role === "fade"
          ? ["cue-turn-card"]
          : ["cue-turn-card", "cue-voice-your-turn"];
  const safe: string[] = [],
    suppressed: { id: string; reason: string }[] = [];
  for (const id of proposed) {
    if (!cueById(id)) continue;
    const conflicts = sceneConflicts(
      { ...scene, cueIds: [id], node: { ...scene.node, allowPause: true } },
      constraints,
    );
    if (conflicts.length) suppressed.push({ id, reason: conflicts.join("；") });
    else safe.push(id);
  }
  return { safe, suppressed };
}
