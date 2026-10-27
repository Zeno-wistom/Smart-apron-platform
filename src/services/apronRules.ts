import type { ApronMapping, Story } from "../domain/types";

export function matchApronMappings(story: Story): ApronMapping[] {
  return story.scenes.flatMap((scene) =>
    scene.cues.map((cue) => ({
      cueId: cue.id,
      moduleId: cue.kind === "visual" ? "sim-visual" : "sim-audio",
      enabled: true,
      note: "本地规则匹配；仅为模拟配置，不包含真实设备参数。",
    })),
  );
}
