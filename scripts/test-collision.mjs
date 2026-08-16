// CollisionGuard 单元测试：验证"机械臂拖入碰撞盒 → 回退到安全姿态"
// 运行：node scripts/test-collision.mjs
import * as THREE from 'three'
import { CollisionGuard } from '../src/core/CollisionGuard.ts'

// ---- mock 6 关节链（沿 x 延伸，与 test-ik 相同构型） ----
function makeChain() {
  const root = new THREE.Object3D()
  const joints = {}
  const names = ['j1', 'j2', 'j3', 'j4', 'j5', 'j6']
  const axes = [
    new THREE.Vector3(0, 0, 1), new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, 1, 0),
    new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, 1, 0),
  ]
  const lengths = [0.1, 0.425, 0.392, 0.094, 0.09, 0.08]
  let parent = root
  for (let i = 0; i < 6; i++) {
    const joint = new THREE.Object3D()
    joint.isURDFJoint = true
    joint.jointType = 'revolute'
    joint.axis = axes[i]
    joint.angle = 0
    joint.limit = { lower: -Math.PI * 2, upper: Math.PI * 2, effort: 0, velocity: 0 }
    joint.setJointValue = function (v) {
      const clamped = Math.min(this.limit.upper, Math.max(this.limit.lower, v))
      this.angle = clamped
      this.quaternion.setFromAxisAngle(this.axis, clamped)
      return true
    }
    parent.add(joint)
    const link = new THREE.Object3D()
    link.position.set(lengths[i], 0, 0)
    joint.add(link)
    joints[names[i]] = joint
    parent = link
  }
  const tool = new THREE.Object3D()
  tool.position.set(0.05, 0, 0)
  parent.add(tool)
  root.updateMatrixWorld(true)
  return {
    robot: { joints, updateMatrixWorld: (f) => root.updateMatrixWorld(f), getFrame: () => tool },
    names,
  }
}

// ArmModel 兼容 mock（仅需 joints 数组与 robot.setJointValue/sync）
function makeArm(robot, names) {
  return {
    robot,
    joints: names.map((n) => ({
      name: n,
      get angle() { return robot.joints[n].angle },
    })),
    sync() { robot.updateMatrixWorld(true) },
  }
}

// ---- 测试 ----
const { robot, names } = makeChain()
const arm = makeArm(robot, names)
const guard = new CollisionGuard(robot, names)

// 碰撞盒：末端（x≈1.231）附近下方的"桌面"
const box = {
  min: new THREE.Vector3(0.9, -0.02, -0.25),
  max: new THREE.Vector3(1.25, 0.08, 0.25),
}
guard.setBoxes([box])

// 姿态 1（安全）：全 0，末端 y=0 在盒内？y 范围 -0.02..0.08，末端 y=0 → 穿！
// 先调整初始姿态为安全：j2 转 0.5 rad，让末端抬高离开盒子
robot.joints.j2.setJointValue(0.5)
robot.updateMatrixWorld(true)

// 记录安全帧
guard.update(arm)
const safeAngles = names.map((n) => robot.joints[n].angle)
console.log('安全姿态: j2 =', safeAngles[1].toFixed(3), '(末端已抬高)')

// 姿态 2（穿入）：j2 归 0，末端降到 y=0 进入盒子
robot.joints.j2.setJointValue(0)
robot.updateMatrixWorld(true)
const tool = robot.getFrame('tool0')
const endBefore = new THREE.Vector3().setFromMatrixPosition(tool.matrixWorld)
console.log(`拖入姿态: 末端 (${endBefore.x.toFixed(3)}, ${endBefore.y.toFixed(3)}, ${endBefore.z.toFixed(3)}) -> 在盒内?`, 
  endBefore.x >= box.min.x && endBefore.x <= box.max.x && endBefore.y >= box.min.y && endBefore.y <= box.max.y && endBefore.z >= box.min.z && endBefore.z <= box.max.z)

// 碰撞回退
guard.update(arm)

const endAfter = new THREE.Vector3().setFromMatrixPosition(tool.matrixWorld)
const inside = endAfter.x >= box.min.x && endAfter.x <= box.max.x && endAfter.y >= box.min.y && endAfter.y <= box.max.y && endAfter.z >= box.min.z && endAfter.z <= box.max.z
console.log(`回退后: 末端 (${endAfter.x.toFixed(3)}, ${endAfter.y.toFixed(3)}, ${endAfter.z.toFixed(3)}) -> 仍在盒内?`, inside)
console.log(inside ? 'FAIL: 仍穿模' : 'PASS: 已回退，不再穿模')
process.exit(inside ? 1 : 0)
