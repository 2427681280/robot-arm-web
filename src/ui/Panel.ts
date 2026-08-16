import type { ArmModel } from '../core/ArmModel'

export type Mode = 'fk' | 'ik'

export interface PanelOptions {
  arm: ArmModel
  /** 模式切换回调 */
  onModeChange?: (mode: Mode) => void
  /** 记录/回放操作回调 */
  onRecorderAction?: (action: 'record' | 'play' | 'stop') => void
  /** 坐标输入回调：请求末端到达指定世界坐标 */
  onGotoCoord?: (x: number, y: number, z: number) => void
  /** 归位回调 */
  onHome?: () => void
  /** 点位示教操作回调 */
  onWaypointAction?: (action: 'record' | 'clear' | 'save' | 'play' | 'stop') => void
  /** 夹爪开合回调（0 = 闭合，1 = 全开） */
  onGripperChange?: (open: number) => void
  /** 场景物件操作回调 */
  onPropAction?: (action: 'table' | 'cup' | 'apple' | 'ball' | 'cube' | 'scene' | 'clear') => void
}

const deg = (rad: number): string => ((rad * 180) / Math.PI).toFixed(1) + '°'

/**
 * 控制面板（原生 DOM，轻量）
 * 职责：模式切换按钮、关节角度实时显示、状态提示
 */
export class Panel {
  readonly mode: Mode = 'fk'
  private arm: ArmModel
  private onModeChange?: (mode: Mode) => void
  private onRecorderAction?: (action: 'record' | 'play' | 'stop') => void
  private onGotoCoord?: (x: number, y: number, z: number) => void
  private onHome?: () => void
  private onWaypointAction?: (action: 'record' | 'clear' | 'save' | 'play' | 'stop') => void
  private onGripperChange?: (open: number) => void
  private onPropAction?: (action: 'table' | 'cup' | 'apple' | 'ball' | 'cube' | 'scene' | 'clear') => void
  private root: HTMLDivElement
  private jointRows = new Map<string, { slider: HTMLInputElement; val: HTMLSpanElement }>()
  private statusBox!: HTMLDivElement
  private modeBtns!: Record<Mode, HTMLButtonElement>
  private recordBtn!: HTMLButtonElement
  private playBtn!: HTMLButtonElement
  private stopBtn!: HTMLButtonElement
  private coordInputs!: HTMLInputElement[]
  private wpCountBox!: HTMLDivElement
  private wpButtons!: Record<string, HTMLButtonElement>
  private disposeFn: () => void

  constructor(opts: PanelOptions) {
    this.arm = opts.arm
    this.onModeChange = opts.onModeChange
    this.onRecorderAction = opts.onRecorderAction
    this.onGotoCoord = opts.onGotoCoord
    this.onHome = opts.onHome
    this.onWaypointAction = opts.onWaypointAction
    this.onGripperChange = opts.onGripperChange
    this.onPropAction = opts.onPropAction
    this.root = this.build()
    document.body.appendChild(this.root)
    this.disposeFn = this.arm.subscribe(() => this.renderJoints())
    this.renderJoints()
  }

  /** 状态提示（如 IK 未启用） */
  setStatus(text: string, color = '#7fd6a0'): void {
    this.statusBox.textContent = text
    this.statusBox.style.color = color
  }

  setMode(mode: Mode): void {
    this.modeBtns.fk.classList.toggle('active', mode === 'fk')
    this.modeBtns.ik.classList.toggle('active', mode === 'ik')
  }

  dispose(): void {
    this.disposeFn()
    this.root.remove()
  }

  // ---------- 私有 ----------

  private build(): HTMLDivElement {
    const root = document.createElement('div')
    root.id = 'panel'

    const h2 = document.createElement('h2')
    h2.textContent = '🤖 UR5e 机械臂控制'
    root.appendChild(h2)

    // 模式切换
    const sw = document.createElement('div')
    sw.className = 'mode-switch'
    const btnFk = document.createElement('button')
    btnFk.textContent = 'FK 拖拽'
    btnFk.className = 'active'
    btnFk.onclick = () => this.switchMode('fk')
    const btnIk = document.createElement('button')
    btnIk.textContent = 'IK 模式'
    btnIk.onclick = () => this.switchMode('ik')
    sw.appendChild(btnFk)
    sw.appendChild(btnIk)
    root.appendChild(sw)
    this.modeBtns = { fk: btnFk, ik: btnIk }

    // 归位按钮
    const homeRow = document.createElement('div')
    homeRow.className = 'mode-switch'
    const btnHome = document.createElement('button')
    btnHome.textContent = '↩ 归位'
    btnHome.onclick = () => this.onHome?.()
    homeRow.appendChild(btnHome)
    root.appendChild(homeRow)

    // 坐标输入：末端自动到达
    const coord = document.createElement('div')
    const coordLabel = document.createElement('div')
    coordLabel.className = 'coord-label'
    coordLabel.textContent = '目标坐标（米）'
    coord.appendChild(coordLabel)
    const coordRow = document.createElement('div')
    coordRow.className = 'coord-row'
    const mkInput = (ph: string): HTMLInputElement => {
      const inp = document.createElement('input')
      inp.type = 'number'
      inp.step = '0.01'
      inp.placeholder = ph
      return inp
    }
    const inpX = mkInput('X')
    const inpY = mkInput('Y')
    const inpZ = mkInput('Z')
    const btnGo = document.createElement('button')
    btnGo.textContent = '到达'
    btnGo.onclick = () => {
      this.onGotoCoord?.(parseFloat(inpX.value), parseFloat(inpY.value), parseFloat(inpZ.value))
    }
    coordRow.appendChild(inpX)
    coordRow.appendChild(inpY)
    coordRow.appendChild(inpZ)
    coordRow.appendChild(btnGo)
    coord.appendChild(coordRow)
    root.appendChild(coord)
    this.coordInputs = [inpX, inpY, inpZ]

    // 场景物件区
    const propsBox = document.createElement('div')
    const propsLabel = document.createElement('div')
    propsLabel.className = 'coord-label'
    propsLabel.textContent = '场景物件'
    propsBox.appendChild(propsLabel)
    const mkPropBtn = (txt: string, act: 'table' | 'cup' | 'apple' | 'ball' | 'cube' | 'scene' | 'clear'): void => {
      const b = document.createElement('button')
      b.textContent = txt
      b.onclick = () => this.onPropAction?.(act)
      propsRow.appendChild(b)
    }
    const propsRow = document.createElement('div')
    propsRow.className = 'wp-row'
    mkPropBtn('🪑 桌子', 'table')
    mkPropBtn('☕ 杯子', 'cup')
    mkPropBtn('🍎 苹果', 'apple')
    mkPropBtn('⚪ 球', 'ball')
    mkPropBtn('🧊 方块', 'cube')
    propsBox.appendChild(propsRow)
    const propsRow2 = document.createElement('div')
    propsRow2.className = 'wp-row'
    const btnScene = document.createElement('button')
    btnScene.textContent = '✨ 一键场景'
    btnScene.onclick = () => this.onPropAction?.('scene')
    const btnClear = document.createElement('button')
    btnClear.textContent = '🗑 清空'
    btnClear.onclick = () => this.onPropAction?.('clear')
    propsRow2.appendChild(btnScene)
    propsRow2.appendChild(btnClear)
    propsBox.appendChild(propsRow2)
    root.appendChild(propsBox)

    // 记录/回放控制
    const rec = document.createElement('div')
    rec.className = 'mode-switch'
    const btnRec = document.createElement('button')
    btnRec.textContent = '▶ 记录'
    btnRec.onclick = () => this.onRecorderAction?.('record')
    const btnPlay = document.createElement('button')
    btnPlay.textContent = '⏯ 回放'
    btnPlay.onclick = () => this.onRecorderAction?.('play')
    const btnStop = document.createElement('button')
    btnStop.textContent = '⏹ 停止'
    btnStop.onclick = () => this.onRecorderAction?.('stop')
    rec.appendChild(btnRec)
    rec.appendChild(btnPlay)
    rec.appendChild(btnStop)
    root.appendChild(rec)
    this.recordBtn = btnRec
    this.playBtn = btnPlay
    this.stopBtn = btnStop

    // 点位示教区
    const wp = document.createElement('div')
    const wpLabel = document.createElement('div')
    wpLabel.className = 'coord-label'
    wpLabel.textContent = '示教点位（已记录 0 个）'
    wp.appendChild(wpLabel)
    this.wpCountBox = wpLabel
    const wpRow = document.createElement('div')
    wpRow.className = 'wp-row'
    const mkWpBtn = (txt: string, act: 'record' | 'clear' | 'save' | 'play' | 'stop'): HTMLButtonElement => {
      const b = document.createElement('button')
      b.textContent = txt
      b.onclick = () => this.onWaypointAction?.(act)
      wpRow.appendChild(b)
      return b
    }
    const wpRec = mkWpBtn('📌 记录点位', 'record')
    const wpClear = mkWpBtn('🧹 清除', 'clear')
    const wpSave = mkWpBtn('💾 保存', 'save')
    const wpPlay = mkWpBtn('▶ 回放', 'play')
    const wpStop = mkWpBtn('⏹ 停止', 'stop')
    this.wpButtons = { record: wpRec, clear: wpClear, save: wpSave, play: wpPlay, stop: wpStop }
    wp.appendChild(wpRow)
    root.appendChild(wp)

    // 关节滑块列表（每关节一个滑块独立控制）
    const joints = document.createElement('div')
    joints.id = 'joints'
    const RAD2DEG = 180 / Math.PI
    for (const js of this.arm.joints) {
      const row = document.createElement('div')
      row.className = 'joint-row'
      const name = document.createElement('span')
      name.className = 'name'
      name.title = js.name
      name.textContent = shortName(js.name)
      const slider = document.createElement('input')
      slider.type = 'range'
      slider.className = 'joint-slider'
      // 范围：URDF 限位（度）；无限位用 ±180°
      const lo = Number.isFinite(js.lower) ? js.lower * RAD2DEG : -180
      const hi = Number.isFinite(js.upper) ? js.upper * RAD2DEG : 180
      slider.min = String(Math.round(lo))
      slider.max = String(Math.round(hi))
      slider.step = '0.5'
      slider.value = String((js.angle * RAD2DEG).toFixed(1))
      slider.oninput = () => {
        this.arm.setAngle(js.name, parseFloat(slider.value) / RAD2DEG)
      }
      const val = document.createElement('span')
      val.className = 'val'
      val.textContent = deg(js.angle)
      row.appendChild(name)
      row.appendChild(slider)
      row.appendChild(val)
      joints.appendChild(row)
      this.jointRows.set(js.name, { slider, val })
    }

    // 夹爪滑块（与关节滑块对齐，同一控制区）
    const gripRow = document.createElement('div')
    gripRow.className = 'joint-row'
    const gripName = document.createElement('span')
    gripName.className = 'name'
    gripName.textContent = '🤏 gripper'
    const gripSlider = document.createElement('input')
    gripSlider.type = 'range'
    gripSlider.className = 'joint-slider'
    gripSlider.min = '0'
    gripSlider.max = '100'
    gripSlider.step = '1'
    gripSlider.value = '25'
    const gripVal = document.createElement('span')
    gripVal.className = 'val'
    gripVal.textContent = '25%'
    gripSlider.oninput = () => {
      const v = parseFloat(gripSlider.value)
      gripVal.textContent = `${v}%`
      this.onGripperChange?.(v / 100)
    }
    gripRow.appendChild(gripName)
    gripRow.appendChild(gripSlider)
    gripRow.appendChild(gripVal)
    joints.appendChild(gripRow)

    root.appendChild(joints)

    // 状态提示
    const status = document.createElement('div')
    status.id = 'status'
    root.appendChild(status)
    this.statusBox = status

    return root
  }

  /** 记录/回放按钮状态（recording/playing 时禁用对应按钮） */
  setRecorderState(state: 'idle' | 'recording' | 'playing'): void {
    this.recordBtn.disabled = state === 'recording'
    this.playBtn.disabled = state === 'playing'
    this.stopBtn.disabled = state === 'idle'
    if (state === 'recording') {
      this.setStatus('🔴 记录中… 操作机械臂，完成后点「停止」', '#e8a33d')
    } else if (state === 'playing') {
      this.setStatus('▶ 回放中… 点「停止」结束', '#7fd6a0')
    }
  }

  /** 点位示教状态：更新计数与按钮 */
  setWaypointState(playing: boolean, count: number): void {
    this.wpCountBox.textContent = `示教点位（已记录 ${count} 个）`
    this.wpButtons.record.disabled = playing
    this.wpButtons.clear.disabled = playing || count === 0
    this.wpButtons.save.disabled = playing || count === 0
    this.wpButtons.play.disabled = playing || count === 0
    this.wpButtons.stop.disabled = !playing
    if (playing) this.setStatus('▶ 示教回放中… 点「停止」结束', '#7fd6a0')
  }

  /** 把坐标填入输入框（如当前末端位置） */
  setCoord(x: number, y: number, z: number): void {
    this.coordInputs[0].value = x.toFixed(2)
    this.coordInputs[1].value = y.toFixed(2)
    this.coordInputs[2].value = z.toFixed(2)
  }

  private switchMode(mode: Mode): void {
    this.setMode(mode)
    if (mode === 'ik') {
      this.setStatus('IK 模式：拖动蓝色目标球，末端自动跟随')
    } else {
      this.setStatus('FK 模式：拖动任意关节/连杆旋转')
    }
    this.onModeChange?.(mode)
  }

  /** 关节订阅回调：仅更新数值显示与滑块位置（不重建 DOM，保持滑块焦点） */
  private renderJoints(): void {
    const RAD2DEG = 180 / Math.PI
    for (const js of this.arm.joints) {
      const row = this.jointRows.get(js.name)
      if (!row) continue
      row.val.textContent = deg(js.angle)
      row.slider.value = String((js.angle * RAD2DEG).toFixed(1))
    }
  }
}

/** 关节名缩写：去掉 _joint 后缀，如 shoulder_pan_joint → shoulder_pan */
function shortName(full: string): string {
  return full.replace(/_joint$/, '')
}
