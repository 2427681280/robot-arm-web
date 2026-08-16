import * as THREE from 'three'
import { CCDIK } from '../src/core/IK.ts'

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
    link.position.set(0, lengths[i], 0)
    joint.add(link)
    joints[names[i]] = joint
    parent = link
  }
  const tool = new THREE.Object3D()
  tool.position.set(0, 0.05, 0)
  parent.add(tool)
  root.updateMatrixWorld(true)
  return { robot: { joints, updateMatrixWorld: (f) => root.updateMatrixWorld(f), getFrame: () => tool }, names }
}

const { robot, names } = makeChain()
const ik = new CCDIK(robot, names)
const target = new THREE.Vector3(0.8, 0.6, 0.2)
const end = new THREE.Vector3()
const tmp = new THREE.Vector3()

for (let iter = 0; iter < 3; iter++) {
  robot.updateMatrixWorld(true)
  ik.getEndEffector(end)
  console.log(`\niter ${iter}: err=${(end.distanceTo(target)*100).toFixed(1)}cm end=(${end.x.toFixed(2)},${end.y.toFixed(2)},${end.z.toFixed(2)})`)
  for (let i = names.length - 1; i >= 0; i--) {
    const joint = robot.joints[names[i]]
    joint.updateMatrixWorld(true)
    const axis = joint.axis.clone().transformDirection(joint.matrixWorld).normalize()
    console.log(`  ${names[i]}: angle=${joint.angle.toFixed(2)} worldAxis=(${axis.x.toFixed(2)},${axis.y.toFixed(2)},${axis.z.toFixed(2)})`)
    ik.getEndEffector(end)
    const pivot = new THREE.Vector3().setFromMatrixPosition(joint.matrixWorld)
    const toEnd = new THREE.Vector3().subVectors(end, pivot)
    const toTarget = new THREE.Vector3().subVectors(target, pivot)
    const cross = new THREE.Vector3().crossVectors(toEnd, toTarget)
    const angle = Math.atan2(cross.dot(axis), toEnd.dot(toTarget) / (toEnd.length() * toTarget.length()))
    if (Math.abs(angle) > 1e-4) joint.setJointValue(joint.angle + Math.min(0.35, Math.max(-0.35, angle)))
  }
}
