import { Raycaster, Vector2 } from 'three'
import type { Object3D, Camera } from 'three'
import { PointerURDFDragControls } from 'urdf-loader/src/URDFDragControls.js'
import type { ArmModel } from '../core/ArmModel'

/**
 * 关节拖拽控件（FK 模式核心）
 *
 * 在 urdf-loader 的 PointerURDFDragControls 基础上做两处增强：
 * 1. 仅响应左键（避免右键/中键调整视角时误触拖拽）；
 * 2. 拖拽期间禁用 OrbitControls（社区公认最高频的冲突点），松手恢复。
 */
export class JointDragControls extends PointerURDFDragControls {
  constructor(robot: Object3D, camera: Camera, domElement: HTMLElement, arm: ArmModel, onOrbitToggle: (enabled: boolean) => void) {
    super(robot, camera, domElement)
    // 移除父类注册的原始监听（无按键过滤）
    this.dispose()

    const raycaster = new Raycaster()
    const mouse = new Vector2()

    const toNDC = (e: MouseEvent): void => {
      const rect = domElement.getBoundingClientRect()
      mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1
      mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1
    }

    this._mouseDown = (e: MouseEvent): void => {
      if (e.button !== 0) return // 左键拖拽关节
      toNDC(e)
      raycaster.setFromCamera(mouse, camera)
      this.moveRay(raycaster.ray)
      this.setGrabbed(true)
    }

    this._mouseMove = (e: MouseEvent): void => {
      if (e.buttons === 0) return // 非按下状态不处理
      toNDC(e)
      raycaster.setFromCamera(mouse, camera)
      this.moveRay(raycaster.ray)
    }

    this._mouseUp = (e: MouseEvent): void => {
      if (e.button !== 0) return // 左键拖拽关节
      toNDC(e)
      raycaster.setFromCamera(mouse, camera)
      this.moveRay(raycaster.ray)
      this.setGrabbed(false)
    }

    domElement.addEventListener('mousedown', this._mouseDown)
    domElement.addEventListener('mousemove', this._mouseMove)
    domElement.addEventListener('mouseup', this._mouseUp)

    // 拖拽期间禁用相机控制；结束时同步关节状态到模型
    this.onDragStart = () => {
      onOrbitToggle(false)
    }
    this.onDragEnd = () => {
      onOrbitToggle(true)
      arm.sync()
    }
  }
}
