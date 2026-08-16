# 六自由度机械臂网页交互项目 — 项目计划书

> 版本：v0.1（规划草案，待用户确认）
> 状态：规划阶段，未进入代码实现
> 关联文档：[01-research-notes.md](./01-research-notes.md)

---

## 1. 项目概述

### 1.1 目标
开发一个**纯前端网页应用**：在浏览器中用 Three.js 渲染一台六自由度（6DOF）机械臂，用户**直接用鼠标拖拽**控制机械臂的旋转与移动，并支持实时数据显示、逆运动学（IK）与路径记录/回放。架构上预留硬件通信层，便于将来对接真实机械臂。

### 1.2 核心用户故事
1. 打开网页 → 看到一台 3D 机械臂（内置默认模型，或加载真实 URDF）
2. 用鼠标**拖拽某个关节/连杆** → 该关节绕自身轴旋转（正运动学 FK 模式）
3. 切换 **IK 模式** → 拖拽末端执行器/目标球 → 各关节自动解算出合理角度
4. 界面实时显示**各关节角度与末端坐标**
5. 一键**记录操作轨迹**并**循环回放**（示教演示）
6. （预留）通过 WebSocket 将关节角度发送给真实机械臂

### 1.3 非目标（明确不做）
- 不做物理仿真引擎（重力/碰撞动力学）——纯运动学演示
- 不做真实硬件驱动（仅预留通信接口）
- 不做复杂场景编辑器、多机械臂编排

---

## 2. 需求梳理（已与用户对齐）

| 编号 | 需求 | 优先级 | 说明 |
|---|---|---|---|
| R1 | 支持加载真实 URDF 模型（UR5e/Kinova/Aubo 等） | P0 | 内置 1 个默认模型兜底 |
| R2 | FK 模式：鼠标直接拖拽关节旋转 | P0 | 拖住连杆/关节，绕关节轴旋转 |
| R3 | IK 模式：拖拽末端，自动解算关节角度 | P1 | 与 FK 模式可切换 |
| R4 | 实时数据显示（关节角度、末端坐标） | P0 | 侧边面板 |
| R5 | 路径记录与回放 | P1 | 记录关节角轨迹，插值回放 |
| R6 | 关节限位保护 | P0 | 依据 URDF `limit` 标签夹紧角度（防乱转） |
| R7 | 视角控制（旋转/缩放/平移） | P0 | OrbitControls 标配 |
| R8 | 预留硬件通信接口 | P2 | 架构上抽象，不实现具体驱动 |
| R9 | 多模型支持（下拉切换） | P2 | 可后续扩展 |

> 注：R6 原不在用户勾选清单，但它是"拖拽控制"正确性的**必要基础**（否则关节可无限旋转、缠线），已纳入 P0。

---

## 3. 开源调研结论

> 基于多轮检索 + 三个并行调研子智能体（GitHub 项目 / URDF 生态 / 社区实践）的交叉验证，以下结论均已核实（npm registry、GitHub、unpkg 源码）。

### 3.1 最具参考价值的项目

| 项目 | Star/状态 | 亮点 | 对本项目的价值 |
|---|---|---|---|
| [gkjohnson/urdf-loaders](https://github.com/gkjohnson/urdf-loaders) | 810 / 活跃 | Three.js URDF 加载器（NASA JPL，Apache-2.0），npm `urdf-loader@0.13.1`；**0.13+ 内置 PointerURDFDragControls = "拖拽旋转关节"现成实现**，自动处理坐标系/单位/limit | **核心依赖**：渲染 + 关节拖拽一次解决 |
| [jsdf/robot-control](https://github.com/jsdf/robot-control) | 7（老但架构对标） | TransformControls 拖末端目标 + SDLS 雅可比 IK（BussIK-js 移植）+ 关节限位钳制 | **IK 交互架构对标**：代码结构可直接照搬改造 |
| [fan-ziqi/robot_viewer](https://github.com/fan-ziqi/robot_viewer) | 524 / 活跃 | 现代 three.js（r163）+ Vite；自定义 PointerJointDragControls 直接拖关节；按需渲染（dirty 标志） | **现代实现参考**：拖拽控件实现 + 性能实践 |
| [glumb/robot-gui](https://github.com/glumb/robot-gui) | 392 | 运动学模型（Robot.js）与渲染（THREERobot.js）彻底分离；IK/工作空间/限位可视化 | **模块化设计参考**（教科书级） |
| [jsdf/BussIK-js](https://github.com/jsdf/BussIK-js) | 12 | SDLS 阻尼 IK 求解器 JS 移植 | **IK 求解层直接复用**，比手写雅可比稳 |
| [jurmy24/mechaverse](https://github.com/jurmy24/mechaverse) | 237 / 活跃 | 浏览器 URDF/MJCF/USD 查看器（Next.js + urdf-loader + mujoco_wasm） | 应用级整体方案参考 |
| [UniversalRobots/Universal_Robots_ROS2_Description](https://github.com/UniversalRobots/Universal_Robots_ROS2_Description) | 官方 | UR3e/5e/10e URDF + mesh | 内置默认模型素材 |
| [three.js forum: URDF & Xacro Loader](https://discourse.threejs.org/t/urdf-xacro-loader-libraries-for-parsing-and-rendering-robot-kinematic-model-formats/89590) | 论坛 | 社区对 URDF 加载方案的权威讨论 | 选型依据（urdf-loader 公认为最成熟方案） |

**⚠️ 避开的项目（已核实）**：`@iwharris/urdf-viewer`、`react-robot`、`web-robotics` 仓库均已删除/下架；[ivokun/crane](https://github.com/ivokun/crane) 实为旋转立方体 demo（假机械臂，反面案例）；ros3djs 锁定 three r89 已过时（绑定 ROS 通信）；Webviz 2022 已停更；Foxglove 已迁移至 Lichtblick（重型面板应用，非库）。

### 3.2 值得复用的设计
1. **关节层级建模**：每个关节 = `THREE.Object3D` 枢轴 + 子连杆 mesh，旋转枢轴即联动后续（urdf-loader 的 URDFJoint 已实现，`setJointValue` 内部用四元数 `setFromAxisAngle` 规避万向锁）。
2. **urdf-loader 0.13 的 PointerURDFDragControls**：Raycaster 命中后向上找最近非 fixed 关节，拖拽向量投影到"以关节轴为法线的平面"求角度增量 → `setJointValue`——**"拖拽旋转关节"的现成实现，可直接启用**。
3. **拖末端 → IK → 关节角闭环**（robot-control）：TransformControls 拖目标球 → SDLS IK 反解 → 限位钳制 → 应用关节角。
4. **模型/渲染分离**（robot-gui）：运动学参数（轴/偏移/限位）存独立模型层，Three 场景只做映射，便于单元测试与换模型。
5. **拖拽与相机互斥**：dragstart 禁 OrbitControls，dragend 恢复（社区公认标准做法）。
6. **性能**：raycast 只对机械臂组 + pointermove 节流 + 按需渲染（dirty 标志）；单臂场景无需 BVH。

### 3.3 需要避开的坑
| 坑 | 说明 | 对策 |
|---|---|---|
| **坐标系** | URDF 遵循 ROS（x 前 z 上），Three.js y 上；自研加载器须整体变换否则模型横躺 | 直接用 urdf-loader（内部已处理）；自定义模型统一约定 |
| **rpy 旋转顺序** | URDF rpy 是**固定轴 XYZ**，与 Three.js 默认**内旋 XYZ** 语义不同，直接 `Euler(rpy)` 姿态错误 | 一律用 Quaternion / setFromAxisAngle，禁用欧拉角累加 |
| **单位** | URDF 规范米，CAD 导出 STL 常为毫米（模型巨大/微小） | 统一 scale 0.001 校正（urdf-loader 不自动缩放） |
| **mesh 路径** | `package://` 需映射，xacro 需预展开 | `loader.packages` 路径映射 + xacro-parser |
| **版本兼容陷阱** | r150+ API 变更；ros3djs 锁 r89；大量老教程引用的库已删除 | 锁 urdf-loader@0.13.x + three r18x；网上教程引用 urdf-viewer/react-robot 需警惕 |
| **拖拽与相机冲突** | 不互斥会导致拖关节时视角乱转（最高频 bug） | dragstart/dragend 禁用/恢复 OrbitControls |
| **旋转错层级** | 旋转 mesh 而非关节枢轴 Group → 动作错误 | 只旋转关节枢轴 Object3D |
| **IK 奇异点** | 末端接近奇异时雅可比迭代发散/抖动 | SDLS 阻尼（BussIK-js）、步长限制、迭代上限、限位钳制 |
| **回放跳变** | 关键帧回放不平滑 | 帧间插值 + 回放时禁实时操作 |

---

## 4. 技术选型

| 层 | 选型 | 理由 |
|---|---|---|
| 构建工具 | **Vite**（最新稳定版） | 秒级热更新，零配置，官方 TS 模板 |
| 语言 | **TypeScript**（严格模式） | 关节配置、IK、URDF 类型化，减少坐标系/单位错误；若更习惯 JS 可降级 |
| 渲染 | **Three.js r18x + WebGLRenderer** | 生态最成熟；WebGPU 暂不启用（兼容性风险） |
| URDF 加载 | **urdf-loader**（gkjohnson/urdf-loaders，npm `urdf-loader@^0.13.1`） | 社区公认最成熟方案；自带关节层级、limit 夹取、package:// 映射，**0.13+ 内置 PointerURDFDragControls** |
| 相机控制 | **OrbitControls**（Three.js 官方 addon） | 标配视角控制；拖拽时禁用避免冲突 |
| IK 求解 | **优先复用 BussIK-js（SDLS）**，参考 robot-control 闭环；备选自实现 CCD/FABRIK | SDLS 阻尼比手写雅可比稳；6DOF 自实现兜底可控 |
| 交互 | **FK 拖关节**：urdf-loader 内置 PointerURDFDragControls（或参考 robot_viewer 自定义）；**IK 拖末端**：TransformControls 拖目标球 + IK 反解（参考 robot-control） | 最大化复用成熟实现，减少自研风险 |
| UI | 原生 HTML/CSS 面板（不引框架） | 保持轻量；若 UI 复杂化再考虑引入 |
| 状态管理 | 简单的事件总线 / 响应式对象（自实现，不引 Redux 等） | 单页小应用，避免过度设计 |
| 通信（预留） | `IHardwareLink` 接口 + 假实现（console 输出） | 为将来 WebSocket/串口留扩展点 |

---

## 5. 系统架构

```
┌─────────────────────────────────────────────────────────┐
│                       浏览器页面                          │
│  ┌────────────┐   ┌──────────────────────────────────┐  │
│  │  UI 面板层  │   │           3D 视图（Canvas）        │  │
│  │ ┌────────┐ │   │  ┌────────────┐  ┌────────────┐  │  │
│  │ │ 模式切换 │ │   │  │ 渲染层      │  │ 交互层      │  │  │
│  │ │ 数据显示 │ │◄──┤  │ Scene/相机  │  │ Picker     │  │  │
│  │ │ 记录/回放│ │   │  │ 光照/网格   │  │ JointDrag  │  │  │
│  │ │ URDF加载 │ │   │  │ OrbitCtl   │  │ EndDrag    │  │  │
│  │ └────────┘ │   │  └─────┬──────┘  └─────┬──────┘  │  │
│  └────────────┘   └────────┼──────────────┼──────────┘  │
│                            ▼              ▼             │
│                    ┌───────────────────────────┐        │
│                    │      运动学核心层           │        │
│                    │  ArmModel（关节状态/限位）   │        │
│                    │  FK（层级变换）            │        │
│                    │  IK（CCD/FABRIK）         │        │
│                    └───────────┬───────────────┘        │
│                                ▼                        │
│                    ┌───────────────────────────┐        │
│                    │    数据/资源层             │        │
│                    │  URDF 加载（urdf-loader）  │        │
│                    │  路径映射 / 默认模型       │        │
│                    └───────────┬───────────────┘        │
│                                ▼                        │
│                    ┌───────────────────────────┐        │
│                    │  通信层（预留）            │        │
│                    │  IHardwareLink（假实现）   │        │
│                    └───────────────────────────┘        │
└─────────────────────────────────────────────────────────┘
```

**关键数据流**：
- FK 模式：鼠标拖关节 → 计算绕轴增量角 → `clamp(限位)` → 更新关节状态 → 应用到场景 Group → 刷新 UI
- IK 模式：鼠标拖末端目标球 → IK 求解器迭代出关节角 → 校验限位 → 应用并刷新
- 回放：读取记录帧 → 定时器逐帧插值 → 应用关节角（禁止实时拖拽）

---

## 6. MVP 范围与里程碑

### MVP（P0，可交付的第一版）
- [x] Vite + TS + Three.js 工程跑通（网格地面、光照、OrbitControls）
- [x] URDF 加载（内置默认模型，优先 UR5e；含 `package://` 路径映射）
- [x] FK 拖拽交互（拖关节/连杆 → 绕轴旋转 + 限位 clamp）
- [x] 实时数据显示面板（各关节角度、末端坐标）
- [x] 模式切换 UI（FK ↔ IK 开关；IK 先占位）

### 二期（P1）
- [ ] IK 求解器（BussIK-js SDLS）+ TransformControls 末端目标球拖拽
- [ ] 路径记录 / 循环回放（插值平滑）
- [ ] 关节角度导入导出（JSON）

### 三期（P2）
- [ ] 硬件通信抽象层 + WebSocket 假实现演示
- [ ] 多模型下拉切换（UR3e/UR10e/Kinova）
- [ ] 相机预设视角、UI 美化、打包部署（GitHub Pages/静态托管）

---

## 7. 开发顺序（阶段计划）

| 阶段 | 内容 | 验收标准 | 预计工作量 |
|---|---|---|---|
| S1 脚手架 | Vite+TS+Three.js 场景，网格/光照/OrbitControls | 页面渲染 3D 场景可旋转缩放 | 0.5 天 |
| S2 模型加载 | urdf-loader@0.13 集成 + 内置 UR5e + package:// 映射 + 关节状态模型 | 加载出完整机械臂，无 404，关节可 setJointValue 驱动 | 1 天 |
| S3 FK 交互 | **启用 PointerURDFDragControls** 拖关节 + 拖拽时禁用 OrbitControls + 限位 + 数据显示 | 鼠标可拖转各关节，角度实时刷新，超限自动夹紧 | 1 天 |
| S4 模式切换 | FK/IK 模式 UI 与交互切换框架 | 切换流畅，状态一致 | 0.5 天 |
| S5 IK 求解 | TransformControls 拖目标球 + **BussIK-js（SDLS）反解** + 奇异/限位保护 | IK 模式下拖末端，各关节平滑解算 | 1.5 天 |
| S6 记录回放 | 轨迹记录 + 插值回放 + 与实时操作互斥 | 记录→回放动作一致平滑 | 1 天 |
| S7 打磨交付 | 参数化配置、异常处理、性能优化、构建部署 | 构建产物可静态部署 | 1 天 |
| S8（可选）| 硬件通信抽象层 | 接口文档 + 假实现演示 | 0.5 天 |

> 预计 MVP（S1–S4）约 **3 天**；完整版（S1–S7）约 **7 天**（单人估算）。相比初版，因复用 urdf-loader 内置拖拽控件与 BussIK-js，S3/S5 各缩短约 0.5 天。

---

## 8. 风险与对策

| 风险 | 等级 | 对策 |
|---|---|---|
| urdf-loader 与 Three.js r18x 存在兼容问题 | 低 | 已核实 0.13.1 活跃维护且 API 现代；S2 首日做版本组合冒烟验证；备选自写轻量 URDF 解析 |
| IK 在奇异位形抖动/无解 | 中 | BussIK-js 自带 SDLS 阻尼；加步长限制、容差收敛；无解时保持原姿态并提示 |
| UR5e mesh 文件较大（STL 多个 MB） | 低 | 内置模型只带基础 mesh；可提供"简易几何体模式"开关 |
| 拖拽手感不符合预期 | 中 | PointerURDFDragControls 的手感参数（灵敏度/死区）预留调优；对照 robot_viewer 实现微调 |

---

## 9. 交付物清单
1. `robot-arm-web/` 可运行项目（npm install && npm run dev）
2. 内置默认 URDF 机械臂（UR5e）
3. 项目文档：README（使用说明）+ 本计划书 + 架构说明
4. （可选）部署脚本 / GitHub Pages 发布

---

## 10. 项目目录结构（规划）

```
robot-arm-web/
├── index.html                  # 入口页面（Canvas + 控制面板）
├── package.json
├── vite.config.ts
├── tsconfig.json
├── public/
├── src/
│   ├── main.ts                 # 应用入口：初始化场景/UI/事件
│   ├── core/
│   │   ├── ArmModel.ts         # 关节状态模型（{jointName: angle}）+ 限位表
│   │   ├── UrdfLoader.ts       # urdf-loader 封装 + package:// 路径映射
│   │   ├── FK.ts               # 正运动学：关节角 → 场景层级应用
│   │   ├── IK.ts               # CCD/FABRIK 求解器（参考 upf-gti/IK-threejs）
│   │   └── JointDefs.ts        # 关节定义表（轴方向/枢轴/限位，参数化）
│   ├── interaction/
│   │   ├── Picker.ts           # Raycaster 拾取（只扫机械臂组）
│   │   ├── JointDrag.ts        # FK 模式：拖关节绕轴旋转
│   │   └── EndEffectorDrag.ts  # IK 模式：拖目标球，调 IK 求解
│   ├── ui/
│   │   ├── Panel.ts            # 控制面板（模式切换/加载/按钮）
│   │   ├── DataDisplay.ts      # 实时角度/坐标显示
│   │   └── Recorder.ts         # 轨迹记录 + 插值回放
│   ├── comm/
│   │   ├── IHardwareLink.ts    # 通信抽象接口（预留）
│   │   └── DummyLink.ts        # 假实现（console 输出关节角）
│   └── assets/urdf/            # 内置 URDF：ur5e/*.urdf + meshes/
└── docs/                       # 本计划书 + 调研笔记
```

## 11. 依赖版本清单（规划草案）

```jsonc
// package.json dependencies（规划值，落地时以 npm 实际解析为准）
{
  "three": "^0.181.0",          // r18x 稳定版
  "urdf-loader": "^0.12.7",     // gkjohnson/urdf-loaders
  "vite": "^7.x",               // 最新稳定
  "typescript": "^5.x"
}
```
> 注意：`urdf-loader` 的 peerDependencies 需与 three 版本匹配，S2 阶段第一步先做最小版本组合冒烟验证。

## 12. 待办确认事项
- [ ] 确认技术选型（尤其：TypeScript vs JavaScript、IK 自实现 vs 引库）
- [ ] 确认内置默认模型（UR5e 优先，还是其他型号）
- [ ] 确认 MVP 范围（是否接受 IK 放二期）
- [ ] 确认开发顺序与优先级

**请审阅后回复确认或提出修改意见，确认后进入代码实现阶段。**
