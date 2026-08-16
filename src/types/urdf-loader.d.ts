/**
 * urdf-loader 类型补全声明
 * 该包发布时未附带完整的 .d.ts（仅 URDFLoader.d.ts 与 URDFClasses.d.ts），
 * 此处补齐缺失的拖拽控件类型，与源码（src/URDFDragControls.js）保持一致。
 */
declare module 'urdf-loader' {
  import type { LoadingManager, Material, Object3D, Vector3 } from 'three'

  export class URDFBase extends Object3D {
    urdfNode: Element | null
    urdfName: string
  }

  export class URDFLink extends URDFBase {
    isURDFLink: true
    inertial: {
      mass: number
      origin: { xyz: number[]; rpy: number[] }
      inertia: { ixx: number; ixy: number; ixz: number; iyy: number; iyz: number; izz: number }
    }
  }

  export type URDFJointType = 'fixed' | 'continuous' | 'revolute' | 'planar' | 'prismatic' | 'floating'

  export class URDFJoint extends URDFBase {
    isURDFJoint: true
    axis: Vector3
    jointType: URDFJointType
    angle: number
    jointValue: number[]
    limit: { lower: number; upper: number; effort: number; velocity: number }
    ignoreLimits: boolean
    setJointValue(...values: (number | null)[]): boolean
  }

  export class URDFRobot extends URDFLink {
    isURDFRobot: true
    robotName: string
    links: Record<string, URDFLink>
    joints: Record<string, URDFJoint>
    colliders: Record<string, URDFBase>
    visual: Record<string, URDFBase>
    frames: Record<string, Object3D>
    setJointValue(jointName: string, ...values: number[]): boolean
    setJointValues(values: Record<string, number | number[]>): boolean
    getFrame(name: string): Object3D
  }

  export default class URDFLoader {
    manager: LoadingManager
    defaultMeshLoader: (url: string, manager: LoadingManager, material: Material, onLoad: (mesh: Object3D, err?: Error) => void) => void
    fetchOptions: RequestInit
    workingPath: string
    parseVisual: boolean
    parseCollision: boolean
    packages: string | Record<string, string> | ((targetPkg: string) => string)
    loadMeshCb: (url: string, manager: LoadingManager, material: Material, onLoad: (mesh: Object3D, err?: Error) => void) => void
    constructor(manager?: LoadingManager)
    loadAsync(urdf: string): Promise<URDFRobot>
    load(url: string, onLoad: (robot: URDFRobot) => void, onProgress?: (progress?: unknown) => void, onError?: (err?: unknown) => void): void
    parse(content: string | Element | Document): URDFRobot
  }
}

declare module 'urdf-loader/src/URDFDragControls.js' {
  import type { Object3D, Camera } from 'three'
  import type { URDFJoint } from 'urdf-loader'

  export class URDFDragControls {
    enabled: boolean
    constructor(scene: Object3D)
    update(): void
    moveRay(toRay: import('three').Ray): void
    setGrabbed(grabbed: boolean): void
    onDragStart(joint: URDFJoint): void
    onDragEnd(joint: URDFJoint): void
    onHover(joint: URDFJoint): void
    onUnhover(joint: URDFJoint): void
    dispose(): void
  }

  export class PointerURDFDragControls extends URDFDragControls {
    /** 内部事件处理器（子类可重写以扩展按键过滤等行为） */
    _mouseDown: (e: MouseEvent) => void
    _mouseMove: (e: MouseEvent) => void
    _mouseUp: (e: MouseEvent) => void
    constructor(scene: Object3D, camera: Camera, domElement: HTMLElement)
  }
}
