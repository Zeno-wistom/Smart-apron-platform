/**
 * 演示控制：让教师/评审在界面里触发“下一次 AI 失败”“下一次传输失败”。
 * 只存在于内存中，不写入 localStorage。
 */
type Listener = () => void;

class SimControls {
  private aiFail = false;
  private transferFail = false;
  /** 测试时可设为 0 以加速 */
  speed = 1;
  private listeners = new Set<Listener>();

  get state() {
    return { aiFail: this.aiFail, transferFail: this.transferFail };
  }
  setAiFail(v: boolean) {
    this.aiFail = v;
    this.emit();
  }
  setTransferFail(v: boolean) {
    this.transferFail = v;
    this.emit();
  }
  consumeAiFailure() {
    if (!this.aiFail) return false;
    this.aiFail = false;
    this.emit();
    return true;
  }
  consumeTransferFailure() {
    if (!this.transferFail) return false;
    this.transferFail = false;
    this.emit();
    return true;
  }
  latency(ms: number) {
    return Math.round(ms * this.speed);
  }
  subscribe(fn: Listener) {
    this.listeners.add(fn);
    return () => {
      this.listeners.delete(fn);
    };
  }
  private emit() {
    this.listeners.forEach((l) => l());
  }
}

export const simControls = new SimControls();
if (typeof window !== "undefined") {
  const q = new URLSearchParams(window.location.search);
  if (q.get("fast") === "1") simControls.speed = 0.05;
}

// 供端到端测试调整模拟延迟（不影响业务数据）
if (typeof window !== "undefined") (window as unknown as { __harkSim: SimControls }).__harkSim = simControls;
