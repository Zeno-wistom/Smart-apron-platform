import { useEffect } from "react";
import { Link, Outlet, useParams } from "react-router-dom";
import { SessionHeader } from "../components/SessionHeader";
import { Notice } from "../components/ui/Feedback";
import { selectSession } from "../domain/selectors";
import { useApp } from "./AppProvider";

export function SessionLayout() {
  const { sessionId } = useParams();
  const { data, update } = useApp();
  const session = selectSession(data, sessionId);

  useEffect(() => {
    if (sessionId && data.activeSessionId !== sessionId) {
      update({ type: "session/select", sessionId, skipHistory: true });
    }
  }, [sessionId, data.activeSessionId, update]);

  if (!session) {
    return (
      <Notice variant="warning" title="没有找到这门课程">
        本地数据可能已恢复初始状态。<Link to="/">返回教学工作台</Link>
      </Notice>
    );
  }

  return (
    <div className="session-page">
      <SessionHeader session={session} />
      <Outlet context={session} />
    </div>
  );
}
