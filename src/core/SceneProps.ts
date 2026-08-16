import * as THREE from 'three'
import type { AABB } from './CollisionGuard'

export type PropType = 'table' | 'cup' | 'apple' | 'ball' | 'cube'

const TABLE_HEIGHT = 0.45
const TABLE_Y = TABLE_HEIGHT / 2

/**
 * 各物件碰撞盒（相对 group 原点，group 原点 = 物件底部中心）
 * 格式 [minX, minY, minZ, maxX, maxY, maxZ]
 * 桌子拆成桌面 + 4 条桌腿，机械臂可从桌腿间/桌下穿过
 */
const COLLIDER_BOXES: Record<PropType, [number, number, number, number, number, number][]> = {
  table: [
    [-0.27, 0.425, -0.17, 0.27, 0.47, 0.17], // 桌面薄板
    [-0.26, 0, -0.15, -0.22, 0.43, -0.11], // 腿 1
    [0.22, 0, -0.15, 0.26, 0.43, -0.11], // 腿 2
    [-0.26, 0, 0.11, -0.22, 0.43, 0.15], // 腿 3
    [0.22, 0, 0.11, 0.26, 0.43, 0.15], // 腿 4
  ],
  cup: [[-0.04, 0, -0.04, 0.04, 0.1, 0.04]],
  apple: [[-0.04, 0, -0.04, 0.04, 0.09, 0.04]],
  ball: [[-0.055, 0, -0.055, 0.055, 0.1, 0.055]],
  cube: [[-0.035, 0, -0.035, 0.035, 0.06, 0.035]],
}

/**
 * 场景物件管理：在场景中添加/删除桌子、杯子、水果、球体、正方体等
 * - 添加桌面物件时自动摆到桌面上（桌子存在时），否则放地面
 * - 同类物件重复添加会横向错开，避免重叠
 */
export class SceneProps {
  private scene: THREE.Scene
  private items: THREE.Object3D[] = []
  private table: THREE.Object3D | null = null
  private counter: Record<PropType, number> = { table: 0, cup: 0, apple: 0, ball: 0, cube: 0 }

  constructor(scene: THREE.Scene) {
    this.scene = scene
  }

  /** 添加一个物件 */
  add(type: PropType): void {
    const obj = this.createProp(type)
    this.items.push(obj)
    this.scene.add(obj)
  }

  /** 一键场景：桌子 + 桌面上摆放杯子/苹果/球/方块 */
  addScene(): void {
    if (!this.table) this.add('table')
    this.add('cup')
    this.add('apple')
    this.add('ball')
    this.add('cube')
  }

  /** 清空所有物件 */
  clear(): void {
    for (const item of this.items) {
      this.scene.remove(item)
      disposeDeep(item)
    }
    this.items = []
    this.table = null
    for (const k of Object.keys(this.counter) as PropType[]) this.counter[k] = 0
  }

  // ---------- 私有 ----------

  private createProp(type: PropType): THREE.Object3D {
    const n = this.counter[type]++
    // 物件 group 底部贴桌面顶面（TABLE_HEIGHT）或地面（0）
    const y = this.table ? TABLE_HEIGHT : 0
    const z = this.table ? 0.48 + (n % 3) * 0.09 : 0.35 + (n % 3) * 0.1
    const x = this.table ? -0.12 + (n % 3) * 0.12 : (n % 3) * 0.12

    const obj = this.makeProp(type)
    obj.userData.propType = type
    if (type !== 'table') this.place(obj, x, y, z)
    return obj
  }

  /** 生成物件（含自身位置摆放） */
  private makeProp(type: PropType): THREE.Object3D {
    switch (type) {
      case 'table':
        return this.makeTable()
      case 'cup':
        return this.makeCup()
      case 'apple':
        return this.makeApple()
      case 'ball':
        return this.makeBall()
      case 'cube':
        return this.makeCube()
    }
  }

  /** 获取全部物件的世界碰撞盒（供 CollisionGuard 使用） */
  getColliders(): AABB[] {
    const out: AABB[] = []
    const p = new THREE.Vector3()
    for (const item of this.items) {
      const type = item.userData.propType as PropType | undefined
      const boxes = type ? COLLIDER_BOXES[type] : undefined
      if (!boxes) continue
      item.getWorldPosition(p)
      for (const [minx, miny, minz, maxx, maxy, maxz] of boxes) {
        out.push({
          min: new THREE.Vector3(p.x + minx, p.y + miny, p.z + minz),
          max: new THREE.Vector3(p.x + maxx, p.y + maxy, p.z + maxz),
        })
      }
    }
    return out
  }

  /** 生成物件并摆放到指定位置（半埋入桌面/地面 0.01，防悬空感） */
  private place(obj: THREE.Object3D, x: number, y: number, z: number): THREE.Object3D {
    obj.position.set(x, y, z)
    return obj
  }

  private makeTable(): THREE.Object3D {
    const g = new THREE.Group()
    const woodMat = new THREE.MeshStandardMaterial({ color: 0x8b5a2b, metalness: 0.05, roughness: 0.8 })
    const darkMat = new THREE.MeshStandardMaterial({ color: 0x4a3420, roughness: 0.9 })

    // 桌面
    const top = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.035, 0.32), woodMat)
    top.position.y = TABLE_HEIGHT - 0.035 / 2
    g.add(top)
    // 四条桌腿
    const legGeo = new THREE.CylinderGeometry(0.012, 0.012, TABLE_HEIGHT - 0.035, 10)
    for (const [lx, lz] of [[-0.22, -0.12], [0.22, -0.12], [-0.22, 0.12], [0.22, 0.12]]) {
      const leg = new THREE.Mesh(legGeo, darkMat)
      leg.position.set(lx, (TABLE_HEIGHT - 0.035) / 2, lz)
      g.add(leg)
    }
    g.position.set(0, 0, 0.5)
    this.table = g
    return g
  }

  private makeCup(): THREE.Object3D {
    const g = new THREE.Group()
    const mat = new THREE.MeshStandardMaterial({ color: 0xf0f0f0, roughness: 0.35 })
    // 杯身（上宽下窄）
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.028, 0.1, 24), mat)
    body.position.y = 0.05
    g.add(body)
    // 杯底
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.026, 0.026, 0.008, 24), mat)
    base.position.y = 0.004
    g.add(base)
    // 把手（圆环）
    const handle = new THREE.Mesh(
      new THREE.TorusGeometry(0.018, 0.005, 8, 20),
      new THREE.MeshStandardMaterial({ color: 0xd8d8d8, roughness: 0.4 }),
    )
    handle.position.set(0.045, 0.05, 0)
    g.add(handle)
    g.userData.height = 0.1
    return g
  }

  private makeApple(): THREE.Object3D {
    const g = new THREE.Group()
    const mat = new THREE.MeshStandardMaterial({ color: 0xcc3333, roughness: 0.35 })
    const sphere = new THREE.Mesh(new THREE.SphereGeometry(0.035, 24, 24), mat)
    sphere.scale.set(1, 0.92, 1)
    sphere.position.y = 0.035
    g.add(sphere)
    // 果柄
    const stem = new THREE.Mesh(
      new THREE.CylinderGeometry(0.003, 0.003, 0.018, 6),
      new THREE.MeshStandardMaterial({ color: 0x5a3a1a, roughness: 0.9 }),
    )
    stem.position.y = 0.072
    g.add(stem)
    g.userData.height = 0.08
    return g
  }

  private makeBall(): THREE.Object3D {
    const g = new THREE.Group()
    const mat = new THREE.MeshStandardMaterial({ color: 0x3a7bf0, roughness: 0.25 })
    const ball = new THREE.Mesh(new THREE.SphereGeometry(0.05, 24, 24), mat)
    ball.position.y = 0.05
    g.add(ball)
    g.userData.height = 0.1
    return g
  }

  private makeCube(): THREE.Object3D {
    const g = new THREE.Group()
    const mat = new THREE.MeshStandardMaterial({ color: 0x3aa75a, roughness: 0.4 })
    const cube = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.06, 0.06), mat)
    cube.position.y = 0.03
    g.add(cube)
    g.userData.height = 0.06
    return g
  }
}

function disposeDeep(obj: THREE.Object3D): void {
  obj.traverse((child) => {
    const mesh = child as THREE.Mesh
    if (mesh.geometry) mesh.geometry.dispose()
    const mat = mesh.material as THREE.Material | THREE.Material[] | undefined
    if (Array.isArray(mat)) mat.forEach((m) => m.dispose())
    else if (mat) mat.dispose()
  })
}
