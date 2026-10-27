import { useOutletContext } from "react-router-dom";
import { Notice } from "../../components/ui/Feedback";
import { isSessionContentLocked } from "../../domain/selectors";
import type { LessonSession } from "../../domain/types";
import { GoalSetup } from "./GoalSetup";
import { StepWorkspace } from "./StepWorkspace";
import "./planning.css";

export function PlanningPage() {
  const session = useOutletContext<LessonSession>();
  const locked = isSessionContentLocked(session);

  return (
    <div className="planning-page">
      {locked && (
        <Notice variant="success" title="本课程已完成模拟传输">
          备课内容现在只读，课堂记录仍引用批准时的版本。如需调整教学，请从工作台创建新课程。
        </Notice>
      )}
      {session.goalSet.status === "draft" ? (
        <GoalSetup session={session} />
      ) : (
        <StepWorkspace session={session} />
      )}
    </div>
  );
}
