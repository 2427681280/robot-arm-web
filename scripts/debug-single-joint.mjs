// 单关节 debug：验证 CCD 角度计算
import * as THREE from 'three'

const root = new THREE.Object3D()
const joint = new THREE.Object3D()
joint.isURDFJoint = true
joint.jointType = 'revolute'
joint.axis = new THREE.Vector3(0, 0, 1)
joint.angle = 0
joint.limit = { lower: -Math.PI * 2, upper: Math.PI * 2 }
joint.setJointValue = function (v) {
  this.angle = v
  this.quaternion.setFromAxisAngle(this.axis, v)
  return true
}
root.add(joint)
const link = new THREE.Object3D()
link.position.set(0, 1, 0)
joint.add(link)
const tool = new THREE.Object3D()
link.add(tool)
root.updateMatrixWorld(true)

const end = new THREE.Vector3().setFromMatrixPosition(tool.matrixWorld)
console.log('end:', end.x.toFixed(3), end.y.toFixed(3), '(expect 0,1)')
const target = new THREE.Vector3(1, 0, 0)
const pivot = new THREE.Vector3().setFromMatrixPosition(joint.matrixWorld)
const toEnd = new THREE.Vector3().subVectors(end, pivot)
const toTarget = new THREE.Vector3().subVectors(target, pivot)
const axis = joint.axis.clone().transformDirection(joint.matrixWorld).normalize()
console.log('toEnd:', toEnd.x.toFixed(3), toEnd.y.toFixed(3), 'toTarget:', toTarget.x.toFixed(3), toTarget.y.toFixed(3), 'axis:', axis.x, axis.y, axis.z)
const cross = new THREE.Vector3().crossVectors(toEnd, toTarget)
const sin = cross.dot(axis)
const cos = toEnd.dot(toTarget) / (toEnd.length() * toTarget.length())
const angle = Math.atan2(sin, cos)
console.log('computed angle:', angle.toFixed(3), 'rad =', (angle * 180 / Math.PI).toFixed(1), 'deg (expect -90)')

// 应用并验证
joint.setJointValue(joint.angle + angle)
root.updateMatrixWorld(true)
const end2 = new THREE.Vector3().setFromMatrixPosition(tool.matrixWorld)
console.log('after apply end:', end2.x.toFixed(3), end2.y.toFixed(3), '(expect ~1,0)')
