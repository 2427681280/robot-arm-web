import { ArmModel } from '../src/core/ArmModel.ts'

const joints = {
  j1: { jointType: 'revolute', angle: 0, limit: { lower: -3, upper: 3, effort: 0, velocity: 0 }, setJointValue(v) { this.angle = Math.max(-3, Math.min(3, v)); return true } },
}
// 真实 URDFRobot 的顶层 setJointValue：按名字分发
const robot = {
  joints,
  setJointValue(name, v) { const j = joints[name]; return j ? j.setJointValue(v) : false },
}
const arm = new ArmModel(robot)
console.log('初始:', arm.joints[0].angle, '(expect 0)')
arm.setAngle('j1', 1.5)
console.log('setAngle(1.5) 后快照:', arm.joints[0].angle, '(expect 1.5)')
arm.setAngle('j1', 99)
console.log('setAngle(99) 后快照(夹紧):', arm.joints[0].angle, '(expect 3)')
process.exit(arm.joints[0].angle === 1.5 ? 0 : 1)
