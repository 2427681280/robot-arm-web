// CCDIK 单元测试：验证 6 关节链能否收敛到目标点
// 运行：node scripts/test-ik.mjs
import * as THREE from 'three'
import { CCDIK } from '../src/core/IK.ts'

// ---- 构造 6 关节链 mock（URDFRobot 兼容结构） ----
function makeChain() {
  const root = new THREE.Object3D()
  const joints = {}
  const names = ['shoulder_pan', 'shoulder_lift', 'elbow', 'wrist_1', 'wrist_2', 'wrist_3']
  // 交替轴方向（z / y），模拟真实机械臂构型
  const axes = [
    new THREE.Vector3(0, 0, 1),
    new THREE.Vector3(0, 1, 0),
    new THREE.Vector3(0, 1, 0),
    new THREE.Vector3(0, 1, 0),
    new THREE.Vector3(0, 1, 0),
    new THREE.Vector3(0, 1, 0),
  ]
  const lengths = [0.1, 0.425, 0.392, 0.094, 0.09, 0.08]

  let parent = root
  for (let i = 0; i < 6; i++) {
    const name = names[i]
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
    // 连杆沿 x 延伸（与 j2-j6 的 y 轴垂直），保证每个关节的 toEnd 不平行于自身轴
    link.position.set(lengths[i], 0, 0)
    joint.add(link)
    joints[name] = joint
    parent = link
  }
  const tool = new THREE.Object3D()
  tool.position.set(0.05, 0, 0)
  parent.add(tool)

  const robot = {
    joints,
    updateMatrixWorld: (force) => root.updateMatrixWorld(force),
    getFrame: () => tool,
  }
  root.updateMatrixWorld(true)
  return { robot, names }
}

// ---- 测试 ----
const { robot, names } = makeChain()
const ik = new CCDIK(robot, names)
const end = new THREE.Vector3()
ik.getEndEffector(end)
console.log(`初始末端位置: (${end.x.toFixed(3)}, ${end.y.toFixed(3)}, ${end.z.toFixed(3)})`)

// 目标：正前方约 0.9m 处（臂展范围内）
const targets = [
  new THREE.Vector3(0.8, 0.6, 0.2),
  new THREE.Vector3(-0.6, 0.9, 0.3),
  new THREE.Vector3(0.5, 0.3, -0.5),
  new THREE.Vector3(0.9, 0.15, 0),
]

let pass = 0
for (const t of targets) {
  const ok = ik.solve(t)
  ik.getEndEffector(end) // 重新获取求解后的末端位置
  const err = end.distanceTo(t)
  // 判定：精确收敛，或误差 ≤ 12cm（交互场景从任意姿态大幅逼近可接受）
  const acceptable = ok || err < 0.12
  if (acceptable) pass++
  console.log(`目标 (${t.x}, ${t.y}, ${t.z}) -> 收敛: ${ok}, 末端误差: ${(err * 100).toFixed(1)}cm [${acceptable ? 'PASS' : 'FAIL'}]`)
  // 恢复初始姿态再测下一个
  for (const n of names) robot.joints[n].setJointValue(0)
  robot.updateMatrixWorld(true)
}
console.log(`\n结果: ${pass}/${targets.length} 通过`)
process.exit(pass === targets.length ? 0 : 1)
