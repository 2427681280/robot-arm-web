import { Vector3 } from 'three'
import type { URDFRobot } from 'urdf-loader'
import type { ArmModel } from './ArmModel'

/** 轴对齐包围盒（世界坐标） */
export interface AABB {
  min: Vector3
  max: Vector3
}

/** 机械臂碰撞采样点：各关节枢轴 + 末端 + 夹爪两指尖 */
const MAX_POINTS = 16

/**
 * 碰撞防护：检测机械臂关键点是否穿透物件碰撞盒，穿透时逐步回退关节角
 * - 采样点：每个可动关节枢轴、tool0 末端、夹爪左右指尖
 * - 回退：向"上一安全帧"角度按比例回退，直到不再穿透（最多 N 次）
 * - 每帧在渲染循环调用 update()
 */
export class CollisionGuard {
  private robot: URDFRobot
  private jointNames: string[]
  private boxes: AABB[] = []
  private points: Vector3[] = []
  private pointCount = 0
  private lastSafe: number[] = []
  private tmp = new Vector3()
  private initialized = false

  constructor(robot: URDFRobot, jointNames: string[]) {
    this.robot = robot
    this.jointNames = jointNames
    for (let i = 0; i < MAX_POINTS; i++) this.points.push(new Vector3())
  }

  /** 更新碰撞盒列表（物件增删时调用） */
  setBoxes(boxes: AABB[]): void {
    this.boxes = boxes
  }

  /** 每帧调用：检测碰撞并回退关节角 */
  update(arm: ArmModel): void {
    if (!this.initialized) {
      this.lastSafe = arm.joints.map((j) => j.angle)
      this.initialized = true
    }
    if (this.boxes.length === 0) {
      this.lastSafe = arm.joints.map((j) => j.angle)
      return
    }
    this.robot.updateMatrixWorld(true)

    // 最多回退 8 轮
    for (let round = 0; round < 8; round++) {
      this.collectPoints()
      if (!this.anyHit()) {
        this.lastSafe = arm.joints.map((j) => j.angle)
        return
      }
      // 向上一安全帧回退 25%
      arm.joints.forEach((js, k) => {
        const safe = this.lastSafe[k] ?? js.angle
        const joint = this.robot.joints[js.name]
        joint?.setJointValue(js.angle + (safe - js.angle) * 0.25)
      })
      arm.sync()
    }
  }

  /** 释放所有碰撞盒（清空物件时） */
  clear(): void {
    this.boxes = []
    this.lastSafe = this.armAngles()
  }

  private armAngles(): number[] {
    const out: number[] = []
    for (const name of this.jointNames) out.push(this.robot.joints[name]?.angle ?? 0)
    return out
  }

  /** 收集机械臂采样点（世界坐标） */
  private collectPoints(): void {
    let i = 0
    for (const name of this.jointNames) {
      const j = this.robot.joints[name]
      if (!j) continue
      if (i >= MAX_POINTS) break
      this.points[i++].setFromMatrixPosition(j.matrixWorld)
    }
    // 末端 tool0
    const tool = this.robot.getFrame('tool0')
    if (tool && i < MAX_POINTS) this.points[i++].setFromMatrixPosition(tool.matrixWorld)
    // 夹爪两指尖（tool0 局部：x=±0.026 手指中位, z=0.105 指尖）
    if (tool && i + 1 < MAX_POINTS) {
      this.tmp.set(-0.026, 0, 0.105)
      tool.localToWorld(this.points[i++].copy(this.tmp))
      this.tmp.set(0.026, 0, 0.105)
      tool.localToWorld(this.points[i++].copy(this.tmp))
    }
    this.pointCount = i
  }

  private anyHit(): boolean {
    for (let i = 0; i < this.pointCount; i++) {
      const p = this.points[i]
      for (const box of this.boxes) {
        if (
          p.x >= box.min.x && p.x <= box.max.x &&
          p.y >= box.min.y && p.y <= box.max.y &&
          p.z >= box.min.z && p.z <= box.max.z
        ) {
          return true
        }
      }
    }
    return false
  }
}
