import * as THREE from 'three'

/**
 * IK 目标球控制器
 * 显示一个可拖拽的目标球（球 + 圆环），拖拽时在水平面上移动。
 * 用于 IK 模式：拖到哪里，机械臂末端就跟到哪里。
 */
export class TargetDrag {
  readonly group: THREE.Group
  private camera: THREE.PerspectiveCamera
  private dom: HTMLElement
  private orbitToggle: (enabled: boolean) => void

  private dragging = false
  private raycaster = new THREE.Raycaster()
  private plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0)
  private intersect = new THREE.Vector3()
  private mouse = new THREE.Vector2()

  private onMouseDown = (e: MouseEvent): void => {
    if (e.button !== 0) return // 左键拖拽目标球（仅 IK 模式可见可拖）
    this.toNDC(e)
    this.raycaster.setFromCamera(this.mouse, this.camera)
    const hits = this.raycaster.intersectObject(this.group, true)
    if (hits.length > 0) {
      this.dragging = true
      this.orbitToggle(false)
      this.dom.style.cursor = 'grabbing'
    }
  }

  private onMouseMove = (e: MouseEvent): void => {
    if (!this.dragging) return
    this.toNDC(e)
    this.raycaster.setFromCamera(this.mouse, this.camera)
    // 在「过目标球、法线=相机朝向」的平面上移动（屏幕平面）——自由 3D 拖动，
    // 不限制在水平面，避免"末端贴地移动"
    const camDir = new THREE.Vector3()
    this.camera.getWorldDirection(camDir)
    this.plane.setFromNormalAndCoplanarPoint(camDir, this.group.position)
    if (this.raycaster.ray.intersectPlane(this.plane, this.intersect)) {
      this.group.position.copy(this.intersect)
      this.onMove?.(this.intersect.clone())
    }
  }

  private onMouseUp = (e: MouseEvent): void => {
    if (e.button !== 0) return // 左键拖拽目标球（仅 IK 模式可见可拖）
    if (this.dragging) {
      this.dragging = false
      this.orbitToggle(true)
      this.dom.style.cursor = 'default'
      this.onDragEnd?.()
    }
  }

  /** 目标球移动回调（每帧拖拽时触发，参数为目标点世界坐标） */
  onMove: ((pos: THREE.Vector3) => void) | null = null
  /** 拖拽结束回调 */
  onDragEnd: (() => void) | null = null

  constructor(scene: THREE.Scene, camera: THREE.PerspectiveCamera, dom: HTMLElement, orbitToggle: (enabled: boolean) => void) {
    this.camera = camera
    this.dom = dom
    this.orbitToggle = orbitToggle

    // 目标球视觉：半透明球 + 指示环
    this.group = new THREE.Group()
    const ball = new THREE.Mesh(
      new THREE.SphereGeometry(0.035, 24, 24),
      new THREE.MeshStandardMaterial({ color: 0x4da3ff, transparent: true, opacity: 0.55, emissive: 0x1a4d8a }),
    )
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(0.07, 0.006, 12, 40),
      new THREE.MeshStandardMaterial({ color: 0x4da3ff, emissive: 0x2a6ad0 }),
    )
    ring.rotation.x = Math.PI / 2
    this.group.add(ball, ring)
    this.group.visible = false
    scene.add(this.group)

    dom.addEventListener('mousedown', this.onMouseDown)
    dom.addEventListener('mousemove', this.onMouseMove)
    dom.addEventListener('mouseup', this.onMouseUp)
  }

  /** 禁用拖拽（仅保留目标球显示，坐标输入控制位置） */
  disableDrag(): void {
    this.dom.removeEventListener('mousedown', this.onMouseDown)
    this.dom.removeEventListener('mousemove', this.onMouseMove)
    this.dom.removeEventListener('mouseup', this.onMouseUp)
  }

  /** 显示/隐藏目标球 */
  setVisible(v: boolean): void {
    this.group.visible = v
  }

  /** 设置目标球位置 */
  setPosition(p: THREE.Vector3): void {
    this.group.position.copy(p)
  }

  /** 获取目标球当前位置 */
  getPosition(): THREE.Vector3 {
    return this.group.position.clone()
  }

  dispose(): void {
    this.dom.removeEventListener('mousedown', this.onMouseDown)
    this.dom.removeEventListener('mousemove', this.onMouseMove)
    this.dom.removeEventListener('mouseup', this.onMouseUp)
  }

  private toNDC(e: MouseEvent): void {
    const rect = this.dom.getBoundingClientRect()
    this.mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1
    this.mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1
  }
}
