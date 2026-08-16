import type { ArmModel } from './ArmModel'

/** 点位间插值步数（每段约 25ms × 20 步 = 0.5s） */
const STEPS_PER_SEGMENT = 20
const STEP_MS = 25

const STORAGE_KEY = 'robot-arm-waypoints'

export type WaypointState = 'idle' | 'playing'

/**
 * 点位示教（关键帧模式）
 * 记录离散点位（每点 = 6 关节角）→ 保存（localStorage）→ 回放（逐点位线性插值）
 */
export class WaypointPlayback {
  private arm: ArmModel
  waypoints: number[][] = []
  private playing = false
  private stopFlag = false
  private onStateChange: (playing: boolean, count: number) => void

  constructor(arm: ArmModel, onStateChange: (playing: boolean, count: number) => void) {
    this.arm = arm
    this.onStateChange = onStateChange
  }

  /** 记录当前关节角为一个点位 */
  record(): number {
    this.waypoints.push(this.arm.joints.map((j) => j.angle))
    this.onStateChange(this.playing, this.waypoints.length)
    return this.waypoints.length
  }

  clear(): void {
    this.waypoints = []
    this.onStateChange(false, 0)
  }

  /** 保存到 localStorage（持久化） */
  save(): boolean {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.waypoints))
      return true
    } catch {
      return false
    }
  }

  /** 从 localStorage 加载 */
  load(): boolean {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (!raw) return false
      const data = JSON.parse(raw)
      if (Array.isArray(data) && data.every((p) => Array.isArray(p))) {
        this.waypoints = data
        this.onStateChange(false, this.waypoints.length)
        return true
      }
      return false
    } catch {
      return false
    }
  }

  /** 依次运动到每个点位（线性插值）；无点位返回 false */
  async play(): Promise<boolean> {
    if (this.waypoints.length === 0) return false
    if (this.playing) return false
    this.playing = true
    this.stopFlag = false
    this.onStateChange(true, this.waypoints.length)

    for (const wp of this.waypoints) {
      if (this.stopFlag) break
      const start = this.arm.joints.map((j) => j.angle)
      for (let s = 1; s <= STEPS_PER_SEGMENT; s++) {
        if (this.stopFlag) break
        const t = s / STEPS_PER_SEGMENT
        this.arm.joints.forEach((js, i) => {
          const v = start[i] + (wp[i] - start[i]) * t
          this.arm.robot.setJointValue(js.name, v)
        })
        this.arm.sync()
        await sleep(STEP_MS)
      }
    }

    this.playing = false
    this.onStateChange(false, this.waypoints.length)
    return true
  }

  stop(): void {
    this.stopFlag = true
  }

  isPlaying(): boolean {
    return this.playing
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
