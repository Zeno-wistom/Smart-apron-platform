import {
  CircleAlert,
  CircleCheck,
  FlaskConical,
  HardDrive,
  Info,
  LoaderCircle,
  TriangleAlert,
  type LucideIcon,
} from "lucide-react";
import type { ReactNode } from "react";
import { useApp } from "../../app/AppProvider";
import { classNames } from "./classNames";

export function Badge({
  children,
  variant = "neutral",
  icon,
}: {
  children: ReactNode;
  variant?: "neutral" | "success" | "warning" | "error" | "info";
  icon?: ReactNode;
}) {
  return (
    <span className={classNames("badge", `badge-${variant}`)}>
      {icon}
      {children}
    </span>
  );
}

export function SimulationBadge({ label = "模拟" }: { label?: string }) {
  return (
    <Badge variant="info" icon={<FlaskConical aria-hidden="true" />}>
      {label}
    </Badge>
  );
}

const noticeIcons: Record<string, LucideIcon> = {
  info: Info,
  success: CircleCheck,
  warning: TriangleAlert,
  error: CircleAlert,
};

export function Notice({
  children,
  variant = "info",
  title,
  actions,
}: {
  children: ReactNode;
  variant?: "info" | "success" | "warning" | "error";
  title?: string;
  actions?: ReactNode;
}) {
  const Icon = noticeIcons[variant];
  return (
    <div className={classNames("notice", `notice-${variant}`)} role={variant === "error" ? "alert" : "status"}>
      <Icon className="notice-icon" aria-hidden="true" />
      <div className="notice-content">
        {title && <strong>{title}</strong>}
        <div>{children}</div>
        {actions && <div className="notice-actions">{actions}</div>}
      </div>
    </div>
  );
}

export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon?: ReactNode;
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="empty-state">
      {icon && <div className="empty-icon">{icon}</div>}
      <h3>{title}</h3>
      <p>{description}</p>
      {action}
    </div>
  );
}

export function SaveIndicator() {
  const { saveStatus } = useApp();
  const content = {
    saved: { icon: HardDrive, text: "已保存到此浏览器" },
    saving: { icon: LoaderCircle, text: "正在本地保存" },
    error: { icon: CircleAlert, text: "本地保存失败" },
  }[saveStatus];
  const Icon = content.icon;
  return (
    <span className={classNames("save-indicator", saveStatus === "error" && "save-error")} role="status">
      <Icon className={saveStatus === "saving" ? "spin" : undefined} aria-hidden="true" />
      {content.text}
    </span>
  );
}
