import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import URDFLoader from 'urdf-loader'
import { ArmModel } from './core/ArmModel'
import { CCDIK } from './core/IK'
import { CollisionGuard } from './core/CollisionGuard'
import { Recorder } from './core/Recorder'
import { SceneProps } from './core/SceneProps'
import { WaypointPlayback } from './core/WaypointPlayback'
import { JointDragControls } from './interaction/JointDragControls'
import { TargetDrag } from './interaction/TargetDrag'
import { Panel, type Mode } from './ui/Panel'

const BASE = import.meta.env.BASE_URL // '/'（本地）或 '/robot-arm-web/'（GitHub Pages）
const URDF_URL = `${BASE}ur_description/urdf/ur5e.urdf`

async function main(): Promise<void> {
  const app = document.getElementById('app')!
  const hint = document.getElementById('hint')!

  // ---------- 渲染器 / 场景 / 相机 ----------
  const renderer = new THREE.WebGLRenderer({ antialias: true })
  renderer.setSize(window.innerWidth, window.innerHeight)
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
  app.appendChild(renderer.domElement)

  const scene = new THREE.Scene()
  scene.background = new THREE.Color(0x14181f)

  const camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.01, 100)
  camera.position.set(1.7, 1.2, 1.7)

  // ---------- 光照 ----------
  scene.add(new THREE.HemisphereLight(0xffffff, 0x3a4150, 1.0))
  const dirLight = new THREE.DirectionalLight(0xffffff, 1.6)
  dirLight.position.set(2.5, 4, 3)
  scene.add(dirLight)
  const rim = new THREE.DirectionalLight(0x88aaff, 0.4)
  rim.position.set(-2, 1, -2)
  scene.add(rim)

  // ---------- 地面网格 ----------
  const grid = new THREE.GridHelper(3, 30, 0x3a4150, 0x262b36)
  scene.add(grid)

  // ---------- 相机控制 ----------
  const controls = new OrbitControls(camera, renderer.domElement)
  controls.target.set(0, 0.6, 0)
  controls.enableDamping = true
  controls.dampingFactor = 0.08
  controls.minDistance = 0.3
  controls.maxDistance = 8
  // 左键拖拽机械臂关节、中键旋转视角、右键平移、滚轮缩放
  controls.mouseButtons = {
    LEFT: THREE.MOUSE.ROTATE, // 实际被下方捕获监听禁用（专用于拖拽关节）
    MIDDLE: THREE.MOUSE.ROTATE,
    RIGHT: THREE.MOUSE.PAN,
  }

  const dom = renderer.domElement
  // 捕获阶段：左键禁用相机控制（留给拖拽关节）
  dom.addEventListener(
    'pointerdown',
    (e: PointerEvent) => {
      if (e.button === 0) {
        controls.enabled = false
      }
    },
    { capture: true },
  )
  dom.addEventListener(
    'pointerup',
    (e: PointerEvent) => {
      if (e.button === 0) controls.enabled = true
    },
    { capture: true },
  )

  // ---------- 加载 URDF ----------
  const loader = new URDFLoader()
  loader.packages = { ur_description: `${BASE}ur_description` }
  loader.parseCollision = false // collision 目录为空，仅渲染 visual
  hint.textContent = '⏳ 正在加载机械臂模型…'

  let robot: Awaited<ReturnType<URDFLoader['loadAsync']>>
  try {
    robot = await loader.loadAsync(URDF_URL)
  } catch (err) {
    hint.textContent = '❌ 模型加载失败，请检查 public/ur_description 资源'
    console.error('URDF load failed:', err)
    return
  }

  scene.add(robot)

  // urdf-loader 不做坐标系转换（ROS z-up 原样映射，见其源码注释）：
  // 绕 X 轴旋转 -90°，把 ROS 的 z 轴向上纠正为 Three.js 的 y 轴向上，使基座垂直于地面
  robot.rotation.x = -Math.PI / 2
  robot.updateMatrixWorld(true)
  hint.textContent = '🖱️ 左键拖拽关节 · 中键旋转视角 · 右键平移 · 滚轮缩放'

  // ---------- 关节模型与运动学 ----------
  const arm = new ArmModel(robot)
  const ik = new CCDIK(robot, arm.joints.map((j) => j.name))
  // 碰撞防护（机械臂与场景物件不穿模）
  const guard = new CollisionGuard(robot, arm.joints.map((j) => j.name))

  // ---------- FK 拖拽（左键拖关节） ----------
  const drag = new JointDragControls(robot, camera, dom, arm, (enabled) => {
    controls.enabled = enabled
  })
  drag.onHover = () => {
    dom.style.cursor = 'grab'
  }
  drag.onUnhover = () => {
    dom.style.cursor = 'default'
  }

  // ---------- IK 目标球（IK 模式下左键拖拽，FK 模式隐藏） ----------
  const target = new TargetDrag(scene, camera, dom, (enabled) => {
    controls.enabled = enabled
  })
  target.onMove = (pos: THREE.Vector3) => {
    // 拖拽目标球时每帧求解 IK 并应用
    ik.solve(pos)
    arm.sync()
  }
  const endPos = new THREE.Vector3()
  ik.getEndEffector(endPos)
  target.setPosition(endPos)

  // ---------- 夹爪（Robotiq 风格，挂 tool0 跟随运动） ----------
  const gripper = new THREE.Group()
  const metalMat = new THREE.MeshStandardMaterial({ color: 0x8a8f9a, metalness: 0.65, roughness: 0.35 })
  const darkMat = new THREE.MeshStandardMaterial({ color: 0x2e313a, metalness: 0.35, roughness: 0.55 })
  const padMat = new THREE.MeshStandardMaterial({ color: 0x1b1c20, roughness: 0.9 })

  // 法兰安装座
  const mount = new THREE.Mesh(new THREE.CylinderGeometry(0.024, 0.03, 0.012, 24), metalMat)
  mount.rotation.x = Math.PI / 2
  gripper.add(mount)
  // 中间壳体
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.052, 0.034, 0.03), darkMat)
  body.position.set(0, 0, 0.02)
  gripper.add(body)

  // 手指：上连杆（水平）+ 指节（前伸）+ 指垫（末端略内收）
  const makeFinger = (side: 1 | -1): THREE.Group => {
    const g = new THREE.Group()
    const link = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.02, 0.032), metalMat)
    link.position.set(0, 0, 0.042)
    g.add(link)
    const knuckle = new THREE.Mesh(new THREE.BoxGeometry(0.009, 0.012, 0.04), darkMat)
    knuckle.position.set(0, 0, 0.075)
    g.add(knuckle)
    const pad = new THREE.Mesh(new THREE.BoxGeometry(0.009, 0.013, 0.014), padMat)
    pad.position.set(side * 0.0045, 0, 0.101)
    g.add(pad)
    return g
  }
  const fingerL = makeFinger(-1)
  const fingerR = makeFinger(1)
  fingerL.position.x = -0.02
  fingerR.position.x = 0.02
  gripper.add(fingerL, fingerR)
  const tool0 = robot.getFrame('tool0')
  tool0.add(gripper)

  // 夹爪开合（平移式，限制最大开度 1.2cm，保持手指在合理边界内）
  const setGripper = (open: number): void => {
    const gap = open * 0.012
    fingerL.position.x = -0.02 - gap
    fingerR.position.x = 0.02 + gap
  }
  setGripper(0.25)

  // ---------- 模式切换 ----------
  const setMode = (mode: Mode): void => {
    if (mode === 'ik') {
      drag.enabled = false
      ik.getEndEffector(endPos)
      target.setPosition(endPos)
      target.setVisible(true)
      hint.textContent = '🎯 IK 模式：左键拖动蓝色目标球，末端自动跟随'
    } else {
      drag.enabled = true
      target.setVisible(false)
      hint.textContent = '🖱️ FK 模式：左键拖拽关节 · 中键旋转视角 · 滚轮缩放'
    }
  }

  // ---------- 坐标输入：末端自动到达 ----------
  const gotoCoord = (x: number, y: number, z: number): void => {
    if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z)) {
      panel.setStatus('⚠️ 请输入有效的数字坐标', '#e8a33d')
      return
    }
    const pos = new THREE.Vector3(x, y, z)
    target.setPosition(pos)
    target.setVisible(true)
    const ok = ik.solve(pos)
    arm.sync()
    panel.setStatus(
      ok
        ? `✅ 末端已到达 (${x.toFixed(2)}, ${y.toFixed(2)}, ${z.toFixed(2)})`
        : '⚠️ 目标超出工作空间，已尽量靠近',
      ok ? '#7fd6a0' : '#e8a33d',
    )
  }

  // ---------- 场景物件 ----------
  const props = new SceneProps(scene)
  const syncColliders = (): void => guard.setBoxes(props.getColliders())

  const panel = new Panel({
    arm,
    onModeChange: setMode,
    onGotoCoord: gotoCoord,
    onGripperChange: setGripper,
    onPropAction: (action) => {
      if (action === 'scene') {
        props.addScene()
        panel.setStatus('✨ 已生成场景：桌子 + 杯子/苹果/球/方块', '#7fd6a0')
      } else if (action === 'clear') {
        props.clear()
        guard.clear()
        panel.setStatus('🗑 已清空场景物件', '#7fd6a0')
      } else {
        props.add(action)
        panel.setStatus(`✅ 已添加物件`, '#7fd6a0')
      }
      syncColliders()
    },
    onHome: () => {
      // 归位：所有关节回到 0°（UR5e 初始姿态）
      arm.joints.forEach((js) => arm.robot.setJointValue(js.name, 0))
      arm.sync()
      ik.getEndEffector(endPos)
      target.setPosition(endPos)
      panel.setStatus('↩ 已归位（所有关节 0°）', '#7fd6a0')
    },
    onWaypointAction: (action) => {
      if (action === 'record') {
        const n = wp.record()
        panel.setStatus(`📌 已记录点位 ${n}`, '#7fd6a0')
      } else if (action === 'clear') {
        wp.clear()
        panel.setStatus('🧹 已清除全部点位', '#7fd6a0')
      } else if (action === 'save') {
        const ok = wp.save()
        panel.setStatus(ok ? `💾 已保存 ${wp.waypoints.length} 个点位（刷新后仍可回放）` : '⚠️ 保存失败', ok ? '#7fd6a0' : '#e8a33d')
      } else if (action === 'play') {
        drag.enabled = false
        target.setVisible(false)
        hint.textContent = '▶ 示教回放中…'
        void wp.play().then((ok) => {
          if (!ok) panel.setStatus('⚠️ 没有点位，先「记录点位」', '#e8a33d')
        })
      } else {
        wp.stop()
        drag.enabled = true
        hint.textContent = '🖱️ 左键拖拽关节 · 中键旋转视角 · 右键平移 · 滚轮缩放'
      }
    },
    onRecorderAction: (action) => {
      if (action === 'record') {
        recorder.startRecording()
      } else if (action === 'play') {
        const ok = recorder.play()
        if (!ok) panel.setStatus('⚠️ 没有可回放的记录，先点「记录」', '#e8a33d')
        else {
          drag.enabled = false
          target.setVisible(false)
        }
      } else {
        recorder.stopAll()
        drag.enabled = true
        hint.textContent = '🖱️ 左键拖拽关节 · 中键旋转视角 · 右键平移 · 滚轮缩放'
      }
    },
  })

  // ---------- 路径记录/回放 ----------
  const recorder = new Recorder(arm, (state, frameCount) => {
    panel.setRecorderState(state)
    if (state === 'idle' && frameCount > 0) {
      panel.setStatus(`✅ 已记录 ${frameCount} 帧轨迹，可点「回放」`, '#7fd6a0')
    }
  })

  // ---------- 点位示教 ----------
  const wp = new WaypointPlayback(arm, (playing, count) => {
    panel.setWaypointState(playing, count)
    if (!playing) {
      drag.enabled = true
      hint.textContent = '🖱️ 左键拖拽关节 · 中键旋转视角 · 右键平移 · 滚轮缩放'
    }
  })
  // 启动时尝试加载上次保存的点位
  if (wp.load()) {
    panel.setStatus(`💾 已加载上次保存的 ${wp.waypoints.length} 个点位`, '#7fd6a0')
  }

  // 坐标输入框初始填入当前末端位置
  panel.setCoord(endPos.x, endPos.y, endPos.z)

  // ---------- 窗口自适应 ----------
  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight
    camera.updateProjectionMatrix()
    renderer.setSize(window.innerWidth, window.innerHeight)
  })

  // ---------- 渲染循环 ----------
  renderer.setAnimationLoop(() => {
    recorder.sample()
    guard.update(arm) // 碰撞检测：穿透则回退关节角
    controls.update()
    renderer.render(scene, camera)
  })
}

void main()
