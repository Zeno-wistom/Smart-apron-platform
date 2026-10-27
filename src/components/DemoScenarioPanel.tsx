import { FlaskConical, RotateCcw, TriangleAlert } from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useApp } from "../app/AppProvider";
import { mockAi } from "../services/mockAi";
import { mockDevice } from "../services/mockDevice";
import { Button } from "./ui/Button";
import { Notice, SimulationBadge } from "./ui/Feedback";
import { Modal } from "./ui/Modal";

export function DemoScenarioPanel({ open, onClose }: { open: boolean; onClose: () => void }) {
  const navigate = useNavigate();
  const { activeSession, resetDemoData } = useApp();
  const [aiArmed, setAiArmed] = useState(false);
  const [deviceArmed, setDeviceArmed] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const [resetting, setResetting] = useState(false);

  useEffect(() => {
    if (!open) return;
    setAiArmed(mockAi.isFailureArmed());
    setDeviceArmed(mockDevice.isFailureArmed());
    setConfirmReset(false);
  }, [open]);

  async function handleReset() {
    setResetting(true);
    await resetDemoData();
    setResetting(false);
    onClose();
    navigate("/");
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="演示控制"
      description="用于稳定复现异常流程，不代表真实 AI 或设备能力。"
      variant="drawer"
    >
      <div className="demo-panel-content">
        <Notice variant="info" title="本地演示模式">
          所有数据均为虚构内容，只保存在当前浏览器。此处不会发起真实模型、硬件或云端请求。
        </Notice>

        <section className="demo-section">
          <div className="section-heading compact">
            <div>
              <h3>异常场景</h3>
              <p>设置后关闭面板，再执行对应操作。每次只生效一次。</p>
            </div>
            <SimulationBadge />
          </div>
          <Button
            full
            variant={aiArmed ? "primary" : "secondary"}
            icon={<FlaskConical aria-hidden="true" />}
            onClick={() => {
              if (aiArmed) mockAi.clearNextFailure();
              else mockAi.armNextFailure();
              setAiArmed(!aiArmed);
            }}
          >
            {aiArmed ? "已设置：下次 AI 生成失败" : "让下次 AI 生成失败"}
          </Button>
          <Button
            full
            variant={deviceArmed ? "primary" : "secondary"}
            icon={<TriangleAlert aria-hidden="true" />}
            onClick={() => {
              if (deviceArmed) mockDevice.clearNextFailure();
              else mockDevice.armNextFailure();
              setDeviceArmed(!deviceArmed);
            }}
          >
            {deviceArmed ? "已设置：下次传输失败" : "让下次模拟传输失败"}
          </Button>
        </section>

        <section className="demo-section">
          <h3>当前演示课程</h3>
          <p className="muted-text">{activeSession?.title ?? "尚未选择课程"}</p>
          <p className="small-text">生成失败不会清除原草案；传输失败不会清除已批准教案。</p>
        </section>

        <section className="demo-section demo-reset-section">
          <h3>恢复初始演示</h3>
          <p className="small-text">清除此浏览器中的全部本地演示课程，恢复为只有一个虚构儿童的初始状态。</p>
          {!confirmReset ? (
            <Button variant="secondary" icon={<RotateCcw aria-hidden="true" />} onClick={() => setConfirmReset(true)}>
              准备恢复初始数据
            </Button>
          ) : (
            <Notice
              variant="warning"
              title="确认覆盖当前本地演示数据？"
              actions={
                <div className="button-row">
                  <Button onClick={() => setConfirmReset(false)}>取消</Button>
                  <Button variant="danger" loading={resetting} onClick={handleReset}>
                    确认恢复虚构数据
                  </Button>
                </div>
              }
            >
              此操作只针对本原型的 localStorage，不影响其他文件或真实儿童资料。
            </Notice>
          )}
        </section>
      </div>
    </Modal>
  );
}
