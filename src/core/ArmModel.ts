import type { URDFRobot, URDFJoint } from 'urdf-loader'

export interface JointState {
  name: string
  /** 当前角度（弧度） */
  angle: number
  /** 关节类型 */
  type: string
  /** 限位（弧度），无限制时为 ±Infinity */
  lower: number
  upper: number
}

type Listener = () => void

/**
 * 机械臂关节状态模型（模型层，与渲染解耦）
 * 持有 URDFRobot 引用，对外提供关节状态查询/修改与变更订阅。
 */
export class ArmModel {
  readonly robot: URDFRobot
  readonly joints: JointState[] = []
  private listeners: Listener[] = []

  constructor(robot: URDFRobot) {
    this.robot = robot
    // 提取可动关节（revolute/continuous/prismatic），保持 URDF 定义顺序
    for (const name of Object.keys(robot.joints)) {
      const j = robot.joints[name]
      if (j.jointType === 'fixed') continue
      this.joints.push({
        name,
        angle: j.angle ?? 0,
        type: j.jointType,
        lower: j.limit?.lower ?? -Infinity,
        upper: j.limit?.upper ?? Infinity,
      })
    }
  }

  /** 获取关节当前角度（弧度） */
  getAngle(name: string): number {
    const j = this.robot.joints[name]
    return j ? (j.angle ?? 0) : 0
  }

  /** 设置关节角度（弧度）；经 urdf-loader 的 setJointValue 自动夹取限位 */
  setAngle(name: string, angle: number): void {
    const ok = this.robot.setJointValue(name, angle)
    if (ok) this.sync() // 更新 JointState 快照并通知（滑块/显示依赖）
  }

  /** 订阅关节状态变化（拖拽/程序驱动后触发） */
  subscribe(fn: Listener): () => void {
    this.listeners.push(fn)
    return () => {
      const i = this.listeners.indexOf(fn)
      if (i >= 0) this.listeners.splice(i, 1)
    }
  }

  /** 内部：同步 JointState 快照并通知（供拖拽回调调用） */
  sync(): void {
    for (const js of this.joints) {
      const j = this.robot.joints[js.name]
      if (j) js.angle = j.angle ?? 0
    }
    this.emit()
  }

  private emit(): void {
    for (const fn of this.listeners) fn()
  }
}
