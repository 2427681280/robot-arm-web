import type { ArmModel } from './ArmModel'

export type RecorderState = 'idle' | 'recording' | 'playing'

/** 回放帧间隔（ms），约 30fps */
const PLAY_INTERVAL_MS = 33

/**
 * 路径记录/回放器（示教功能）
 * - 记录：渲染循环每帧采样各关节角（recording 时由外部调用 sample()）
 * - 回放：按固定帧间隔逐帧应用关节角（自动夹取限位）
 * - 与实时操作互斥：回放期间调用方应禁用拖拽
 */
export class Recorder {
  private arm: ArmModel
  private frames: number[][] = []
  private state: RecorderState = 'idle'
  private playIndex = 0
  private timer: ReturnType<typeof setInterval> | null = null

  private onStateChange: (state: RecorderState, frameCount: number) => void

  constructor(arm: ArmModel, onStateChange: (state: RecorderState, frameCount: number) => void) {
    this.arm = arm
    this.onStateChange = onStateChange
  }

  getState(): RecorderState {
    return this.state
  }

  getFrameCount(): number {
    return this.frames.length
  }

  /** 渲染循环调用：记录状态下采样当前关节角 */
  sample(): void {
    if (this.state !== 'recording') return
    this.frames.push(this.arm.joints.map((j) => j.angle))
  }

  startRecording(): void {
    if (this.state === 'playing') this.stopPlayback()
    this.frames = []
    this.state = 'recording'
    this.onStateChange(this.state, this.frames.length)
  }

  stopRecording(): void {
    if (this.state !== 'recording') return
    this.state = 'idle'
    this.onStateChange(this.state, this.frames.length)
  }

  /** 开始回放；没有记录时返回 false */
  play(): boolean {
    if (this.frames.length < 2) return false
    if (this.state === 'recording') this.stopRecording()
    if (this.state === 'playing') this.stopPlayback()
    this.state = 'playing'
    this.playIndex = 0
    this.applyFrame(0)
    this.onStateChange(this.state, this.frames.length)
    this.timer = setInterval(() => {
      this.playIndex++
      if (this.playIndex >= this.frames.length) {
        // 循环回放
        this.playIndex = 0
      }
      this.applyFrame(this.playIndex)
    }, PLAY_INTERVAL_MS)
    return true
  }

  stopPlayback(): void {
    if (this.timer !== null) {
      clearInterval(this.timer)
      this.timer = null
    }
    if (this.state === 'playing') {
      this.state = 'idle'
      this.onStateChange(this.state, this.frames.length)
    }
  }

  /** 停止一切（记录或回放） */
  stopAll(): void {
    this.stopPlayback()
    this.stopRecording()
  }

  private applyFrame(index: number): void {
    const frame = this.frames[index]
    if (!frame) return
    this.arm.joints.forEach((js, i) => {
      if (i < frame.length) this.arm.robot.setJointValue(js.name, frame[i])
    })
    this.arm.sync()
  }
}
