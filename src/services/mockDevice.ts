import type {
  ConnectionResult,
  DemoFailureControls,
  DeviceAdapter,
  DeviceCapability,
  TransferResult,
} from "./contracts";
import type { ApprovedLessonSnapshot } from "../domain/types";

const capabilities: DeviceCapability[] = [
  {
    id: "sim-visual",
    name: "模拟视觉反馈模块",
    kind: "visual",
    description: "仅用于配置故事视觉提示，不代表真实硬件型号或参数。",
    simulated: true,
  },
  {
    id: "sim-audio",
    name: "模拟声音反馈模块",
    kind: "audio",
    description: "仅用于配置故事声音提示，不发生真实音频或设备输出。",
    simulated: true,
  },
];

const delay = (ms = 550) => new Promise((resolve) => setTimeout(resolve, ms));

class SimulatedDeviceAdapter implements DeviceAdapter, DemoFailureControls {
  private failNext = false;

  armNextFailure(): void {
    this.failNext = true;
  }

  clearNextFailure(): void {
    this.failNext = false;
  }

  isFailureArmed(): boolean {
    return this.failNext;
  }

  async getCapabilities(): Promise<DeviceCapability[]> {
    return structuredClone(capabilities);
  }

  async connect(): Promise<ConnectionResult> {
    await delay();
    return {
      ok: true,
      message: "已进入模拟设备连接状态；没有连接任何真实围裙。",
    };
  }

  async transfer(
    snapshot: ApprovedLessonSnapshot,
  ): Promise<TransferResult> {
    await delay(700);
    if (this.failNext) {
      this.failNext = false;
      return {
        ok: false,
        message: "模拟传输失败：演示控制触发。教案已保留，可以直接重试。",
      };
    }
    return {
      ok: true,
      message: `模拟传输流程完成：${snapshot.steps.length} 个环节，未发送至真实设备。`,
    };
  }
}

export const mockDevice = new SimulatedDeviceAdapter();
