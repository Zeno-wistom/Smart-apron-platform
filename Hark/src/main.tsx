import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { HashRouter, Navigate, Route, Routes } from "react-router-dom";
import "./styles/tokens.css";
import "./styles/base.css";
import "./styles/components.css";
import "./styles/layout.css";
import "./styles/features.css";
import { RequestsProvider, StoreProvider } from "./app/store";
import { Shell } from "./app/Shell";
import { WorkbenchPage } from "./features/workbench/WorkbenchPage";
import { ChildPage } from "./features/child/ChildPage";
import { RecordsPage } from "./features/records/RecordsPage";
import { ActivityPage } from "./features/activity/ActivityPage";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <StoreProvider>
      <RequestsProvider>
        <HashRouter>
          <Shell>
            <Routes>
              <Route path="/" element={<WorkbenchPage />} />
              <Route path="/children/:childId" element={<ChildPage />} />
              <Route path="/records" element={<RecordsPage />} />
              <Route path="/activities/:activityId" element={<ActivityPage />} />
              <Route path="/activities/:activityId/:stage" element={<ActivityPage />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </Shell>
        </HashRouter>
      </RequestsProvider>
    </StoreProvider>
  </StrictMode>,
);
