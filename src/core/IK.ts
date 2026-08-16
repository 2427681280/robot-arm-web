import { Vector3 } from 'three'
import type { URDFRobot, URDFJoint } from 'urdf-loader'

/** 末端坐标系（UR5e URDF 中的 tool0 frame） */
const END_FRAME = 'tool0'

export interface IKOptions {
  /** 最大迭代轮数（每轮遍历全部可动关节一次） */
  iterations?: number
  /** 收敛容差（米） */
  tolerance?: number
  /** 单关节单次最大旋转步长（弧度），防止大幅跳跃抖动 */
  maxStep?: number
}

const _v = (): Vector3 => new Vector3()

/**
 * CCD（循环坐标下降）逆运动学求解器
 *
 * 原理：从末端关节向基座逐个迭代，每次把「关节枢轴→末端」向量旋转到
 * 「关节枢轴→目标」方向，多轮迭代使末端逼近目标。
 *
 * 特点：
 * - 无外部依赖、对通用 URDF 关节树直接可用（不限定 DH 构型）
 * - 通过 URDFJoint.setJointValue() 应用关节角，自动夹取 URDF limit 限位
 * - 单关节步长限制 + 收敛容差，避免奇异位形附近的抖动
 */
export class CCDIK {
  private robot: URDFRobot
  private jointNames: string[]

  constructor(robot: URDFRobot, jointNames: string[]) {
    this.robot = robot
    this.jointNames = jointNames
  }

  /**
   * 求解：让末端执行器逼近目标点（世界坐标）
   * @param target 目标点（世界坐标）
   * @returns 是否收敛（末端已进入容差范围）
   */
  solve(target: Vector3, opts: IKOptions = {}): boolean {
    const { iterations = 40, tolerance = 0.015, maxStep = 0.5 } = opts

    const end = _v()
    const pivot = _v()
    const toEnd = _v()
    const toTarget = _v()
    const axis = _v()

    for (let iter = 0; iter < iterations; iter++) {
      this.robot.updateMatrixWorld(true)
      this.getEndEffector(end)
      if (end.distanceTo(target) < tolerance) return true

      // 从末端关节向基座方向逐个调整
      for (let i = this.jointNames.length - 1; i >= 0; i--) {
        const joint = this.robot.joints[this.jointNames[i]]
        if (!joint || joint.jointType === 'fixed') continue

        joint.updateMatrixWorld(true)
        pivot.setFromMatrixPosition(joint.matrixWorld)
        this.getEndEffector(end)
        if (end.distanceTo(target) < tolerance) return true

        toEnd.subVectors(end, pivot)
        toTarget.subVectors(target, pivot)
        const lenEnd = toEnd.length()
        const lenTarget = toTarget.length()
        if (lenEnd < 1e-6 || lenTarget < 1e-6) continue

        // 关节旋转轴的世界方向
        axis.copy(joint.axis).transformDirection(joint.matrixWorld).normalize()

        const angle = signedAngleBetween(toEnd, toTarget, axis)
        if (Math.abs(angle) < 1e-4) continue

        // 限幅：单步不超过 maxStep，避免抖动/大跳
        const step = clamp(angle, -maxStep, maxStep)
        joint.setJointValue(joint.angle + step)
      }
    }

    this.robot.updateMatrixWorld(true)
    this.getEndEffector(end)
    return end.distanceTo(target) < tolerance
  }

  /** 获取末端执行器世界坐标 */
  getEndEffector(out: Vector3): Vector3 {
    this.robot.updateMatrixWorld(true)
    const frame = this.robot.getFrame(END_FRAME)
    return out.setFromMatrixPosition(frame.matrixWorld)
  }
}

/** 绕 axis 从 a 到 b 的有符号夹角（右手定则） */
function signedAngleBetween(a: Vector3, b: Vector3, axis: Vector3): number {
  const cross = _v().crossVectors(a, b)
  const sin = cross.dot(axis)
  const cos = a.dot(b) / (a.length() * b.length())
  return Math.atan2(sin, cos)
}

function clamp(v: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, v))
}

export type { URDFJoint }
