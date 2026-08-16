# 六自由度机械臂网页项目 — 调研笔记（进行中）

> 状态：待补充三个调研子智能体的开源调研报告后汇入最终计划书。
> 最后更新：2026-08（规划阶段）

## 1. 需求对齐结果（已与用户确认）

| 决策点 | 结论 |
|---|---|
| 模型来源 | 支持加载真实 URDF（UR5e / Kinova / Aubo 等） |
| 交互方式 | 两种模式可切换：① 直接拖拽关节（正运动学 FK）② 拖拽末端（逆运动学 IK） |
| 技术栈 | 原生 Three.js + Vite |
| 附加功能 | 实时数据显示 + 逆运动学（IK）+ 路径记录/回放 |
| 后续对接 | 预留硬件接口（架构上留通信层，如 WebSocket） |
| 附加建议（我方补充） | 关节限位保护（URDF limit 标签）作为基础能力进 MVP；OrbitControls 视角控制为标配 |

## 2. 本地环境基线（已实测）

- Node.js **v24.16.0**
- npm **11.13.0**
- git **2.54.0**（工作区当前非 git 仓库，项目落地后建议 `git init`）
- 工作区现状：`C:\Users\DELL\Desktop\workplace`，含 FPGA/嵌入式教程文件与 `.workbuddy` 记忆，无冲突
- 计划：项目放独立子目录 `robot-arm-web/`，不动现有文件

## 3. 真实 URDF 资源来源（已确认）

- 官方仓库：[UniversalRobots/Universal_Robots_ROS2_Description](https://github.com/UniversalRobots/Universal_Robots_ROS2_Description)
  - 含 UR3e / UR5e / UR10e 的 URDF 定义 + STL/DAE mesh 文件
- ROS 文档：[ur_description (Iron)](https://docs.ros.org/en/iron/p/ur_description/standard_docs/original/)
- 注意：UR 的 mesh 文件许可适用于教学/非商业用途，商用前需核对；也可改用 Kinova（MIT/BSD）等许可更宽松的模型
- 备选：Aubo / Panda（Franka）等开源 URDF 亦可

## 4. Three.js 版本基线（已确认）

- 最新稳定版已到 **r181**（r170 起 WebGPU 模块移入 addons，渲染性能大幅提升）
- 计划锁定：r18x 稳定版 + **WebGLRenderer**（WebGPU 作为可选实验项，避免兼容性风险）

## 5. IK 库候选（初步，待子智能体确认）

- [upf-gti/IK-threejs](https://github.com/upf-gti/IK-threejs)：CCD / FABRIK / 混合算法，专为 Three.js
- jsantell/three-ik（npm）：老牌，基于 CCD 迭代
- @coconut-xr/ik：较新，纯 Three.js 实现
- 兜底方案：6DOF 机械臂结构简单，自实现 CCD/FABRIK 求解器（约 100-200 行）风险可控

## 6. 自主补充调研成果（2026-08，第二轮）

### 6.1 URDF 加载核心库（已确认）
- **[gkjohnson/urdf-loaders](https://github.com/gkjohnson/urdf-loaders)**：Three.js + Unity 双版本 URDF 加载器，源自 NASA JPL ATHLETE；npm 包 `urdf-loader` 最新 **0.12.7**，维护活跃（Garrett Johnson，three-mesh-bvh 作者）
- 社区评价：three.js forum 讨论帖 [URDF & Xacro Loader](https://discourse.threejs.org/t/urdf-xacro-loader-libraries-for-parsing-and-rendering-robot-kinematic-model-formats/89590) 公认 urdf-loaders 为最成熟方案
- 附带 `setJointValue(jointName, angle)` 接口，直接支持按关节名驱动旋转

### 6.2 机械臂 Web 演示项目候选
- [twhelgeson/robot-gui](https://github.com/twhelgeson/robot-gui)：three.js 3D 机器人控制界面
- [ivokun/crane](https://github.com/ivokun/crane)：SST + Astro + ThreeJS 的 serverless 机械臂仿真
- [tinkerator/saxis](https://github.com/tinkerator/saxis)：6 旋转轴机器人
- [IacopomC/robot_arm_three_js](https://repos.ecosyste.ms/hosts/GitHub/repositories/IacopomC%2Frobot_arm_three_js)：Three.js 机械臂示例
- [gautamkmahato/Robotic-Arm-Simulation](https://github.com/gautamkmahato/Robotic-Arm-Simulation)：Python+HTML/CSS/JS 机械臂仿真

### 6.3 IK 库（已确认）
- [upf-gti/IK-threejs](https://github.com/upf-gti/IK-threejs)：CCD / FABRIK / 混合，专为 Three.js
- jsantell/three-ik（npm，CCD 迭代，老牌）
- @coconut-xr/ik（较新）
- 兜底：6DOF 结构简单，自实现 CCD/FABRIK（~150 行）风险可控

## 7. 三个开源调研子智能体的简报（已全部回收，2026-08-15）

> 三个子智能体（GitHub 项目 / URDF 生态 / 社区实践）运行 4 轮后中断收尾，简报均已返回，核心结论已整合进项目计划书第 3、4 章。

### 7.1 子智能体 A：GitHub 机械臂项目（核心结论）
- **jsdf/robot-control**：TransformControls 拖末端 + SDLS 雅可比 IK（BussIK-js 移植）→ **IK 交互架构对标**
- **fan-ziqi/robot_viewer**（524⭐ 活跃）：自定义 PointerJointDragControls 直接拖关节 + 按需渲染 → **现代实现参考**
- **glumb/robot-gui**（392⭐）：运动学模型与渲染彻底分离 → **模块化设计参考**
- **jsdf/BussIK-js**：SDLS 阻尼 IK 求解器 JS 移植 → **IK 层直接复用**
- **ivokun/crane = 反面案例**（旋转立方体假机械臂）；fbzyx/6dof-robot-simulator（最简教学示例）
- 推荐路径：滑杆+FK → 拖关节 → 拖末端+IK 三步渐进

### 7.2 子智能体 B：URDF 生态（核心结论）
- **urdf-loader 最新 0.13.1**（2026-07 更新，Apache-2.0，810⭐），**0.13+ 内置 PointerURDFDragControls**——拖拽旋转关节的现成实现（Raycaster 命中→找最近非 fixed 关节→拖拽向量投影到关节轴法平面求角度）
- **已删除/下架**：@iwharris/urdf-viewer、react-robot、web-robotics（网上教程引用需警惕）
- **过时**：ros3djs（锁 three r89）、Webviz（2022 停更）；Foxglove → Lichtblick（重型应用非库）
- URDF rpy 是固定轴 XYZ（与 Three.js 内旋不同）→ 用四元数；单位注意 mm/m；材质需外部映射
- 一句话结论：urdf-loader@0.13+ 渲染 + 内置 PointerURDFDragControls 拖关节 + OrbitControls 相机即可完成核心需求

### 7.3 子智能体 C：社区实践（核心结论）
- 交互库：官方 DragControls + TransformControls(mode='rotate') 最稳；X/HN 索引受限，讨论集中在 three.js 官方论坛
- 最高频误区：OrbitControls 与拖拽抢事件（需 pointerdown 禁 orbit）、NDC 坐标换算错误、旋转错层级（应旋转关节枢轴 Group）、每帧全场景 raycast、不夹紧 limit
- 性能：raycast 只对交互对象 + pointermove 节流；场景大再上 three-mesh-bvh/InstancedMesh
- 10 条实操建议（关节嵌套 Group、拖拽结束再提交状态、一次只显示一个选中关节 gizmo 等）已消化进计划书

### 7.4 子智能体 C 补充：教程与演示资源清单（真实 URL）
- 课程：[Three.js Journey](https://threejs-journey.com)（Bruno Simon）、[Wawa Sensei R3F 课程（Controls 章节）](https://wawasensei.dev/courses/react-three-fiber)
- 实战复盘：[grgv.xyz 博客：three.js + rapier.js 浏览器机器人模拟器](https://web.archive.org/web/20240223042600/https://grgv.xyz/blog/simulator/)
- 演示项目：[vrtnis/robot-web-viewer](https://github.com/vrtnis/robot-web-viewer)（R3F+URDF）、[moeru-ai/lerobot-visualize](https://github.com/moeru-ai/lerobot-visualize)、[Seeed reBot Arm Web Simulator 开发指南](https://wiki.seeedstudio.com/rebot_arm_b601_rs_web_simulator_developer_guide/)、[6-axis FK/IK Devpost](https://devpost.com/software/6-axis-robotic-arm-forward-and-inverse-kinematics)
- 社区 Showcase：[浏览器内真实机器人策略 SO-101（three.js+R3F）](https://discourse.threejs.org/t/a-real-robot-policy-neural-net-physics-running-100-in-the-browser-so-101-arm-three-js-r3f/92415)、[手工运动学机械臂展示](https://discourse.threejs.org/t/handmade-kinematic-robot-arm-simulation-i-made-a-while-ago/78433/7)
- 中文社区：[CSDN：urdf-loaders 为 Web 端 URDF 仿真最成熟方案](https://blog.csdn.net/HiWangWenBing/article/details/160471191)、[掘金：three 模拟机械臂](https://juejin.cn/post/7621986262140649491)
- 性能：[three-mesh-bvh](https://github.com/agargaro/three-mesh-bvh)、[InstancedMesh picking 2024](https://discourse.threejs.org/t/best-way-to-do-instanced-mesh-picking-in-2024/59917/8)、[Mouse Event Optimisation](https://discourse.threejs.org/t/mouse-event-optimisation/83429/3)
- 实操要点（增量）：TransformControls `mode='rotate'` + `attach()` 到关节 Group 是社区验证的 FK 模式；pointermove 拾取节流 30-60ms；拖拽结束（pointerup）再提交状态避免每帧渲染；gizmo 一次只显示选中关节并 `setSize` 缩放
