import { BookOpen, Check, ClipboardCheck, Send, UserRound } from "lucide-react";
import { NavLink } from "react-router-dom";
import { useApp } from "../app/AppProvider";
import { getSessionStageLabel, isApronStale, isStoryStale } from "../domain/selectors";
import type { LessonSession } from "../domain/types";
import { Badge, SimulationBadge } from "./ui/Feedback";

export function SessionHeader({ session }: { session: LessonSession }) {
  const { data } = useApp();
  const child = data.children.find((item) => item.id === session.childId);
  const planningDone =
    session.goalSet.status === "confirmed" &&
    session.steps.length >= 3 &&
    session.steps.every((step) => step.status === "confirmed");
  const experienceDone =
    session.story.status === "confirmed" &&
    session.apronConfig.status === "confirmed" &&
    !isStoryStale(session) &&
    !isApronStale(session);

  const steps = [
    { to: "plan", label: "AI 备课", icon: BookOpen, done: planningDone },
    { to: "experience", label: "故事与围裙", icon: ClipboardCheck, done: experienceDone },
    { to: "review", label: "确认与传输", icon: Send, done: Boolean(session.approval) },
  ];

  return (
    <header className="session-header">
      <div className="session-title-block">
        <div className="session-child">
          <UserRound aria-hidden="true" />
          <span>{child?.displayName ?? "虚构儿童"}</span>
          <Badge>虚构档案</Badge>
        </div>
        <div className="session-title-row">
          <h1>{session.title}</h1>
          <Badge variant="info">{getSessionStageLabel(session)}</Badge>
          <SimulationBadge label="本地演示" />
        </div>
      </div>
      <div className="session-nav-label">本节课的课前流程 <span>可返回前面的阶段查看或修改</span></div>
      <nav className="session-steps" aria-label="课程备课步骤">
        {steps.map((step, index) => {
          const Icon = step.icon;
          return (
            <NavLink
              key={step.to}
              to={step.to}
              className={({ isActive }) => isActive ? "session-step active" : "session-step"}
            >
              <span className="step-index">{step.done ? <Check aria-hidden="true" /> : index + 1}</span>
              <Icon aria-hidden="true" />
              <span className="session-step-copy"><strong>{step.label}</strong><small>{step.done ? "已完成，可查看" : "待完成"}</small></span>
            </NavLink>
          );
        })}
      </nav>
    </header>
  );
}
