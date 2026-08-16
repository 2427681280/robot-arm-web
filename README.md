# 六自由度机械臂网页交互控制（robot-arm-web）

浏览器内渲染 UR5e 机械臂，**鼠标直接拖拽控制**：FK 拖拽关节旋转、IK 拖末端跟随、路径记录/回放。原生 Three.js + TypeScript + Vite。

## 快速开始

```bash
npm install
npm run dev      # 开发模式 → http://localhost:5173
npm run build    # 生产构建 → dist/
```

## 功能

| 功能 | 说明 |
|---|---|
| 🦾 URDF 加载 | urdf-loader 渲染真实 UR5e 模型（`public/ur_description/`） |
| 🖱️ FK 拖拽 | 左键直接拖拽任意关节/连杆绕轴旋转，URDF 限位自动夹紧 |
| 🎯 IK 模式 | 切换后拖动蓝色目标球，CCD 逆运动学自动解算 6 关节角 |
| 📊 实时显示 | 面板实时显示 6 关节角度 |
| 🎬 记录/回放 | 记录操作轨迹并循环回放（示教演示） |
| 📐 视角控制 | 右键/中键调整视角，滚轮缩放（与拖拽互斥防冲突） |

## 技术栈

- **Three.js** r185（WebGLRenderer）
- **urdf-loader** 0.13.1（URDF 解析渲染 + 内置 PointerURDFDragControls 拖拽算法）
- **Vite** 8 + **TypeScript** 7

## 目录结构

```
src/
├── main.ts                 # 入口：场景/相机/光照/加载/交互组装
├── core/
│   ├── ArmModel.ts         # 关节状态模型 + 变更订阅
│   ├── IK.ts               # CCD 逆运动学求解器（自实现）
│   └── Recorder.ts         # 路径记录/回放
├── interaction/
│   ├── JointDragControls.ts # FK 拖拽（左键过滤 + OrbitControls 互斥）
│   └── TargetDrag.ts       # IK 目标球拖拽
├── ui/Panel.ts             # 控制面板（模式切换/角度显示/记录回放）
└── types/urdf-loader.d.ts  # urdf-loader 类型补全
public/ur_description/      # UR5e URDF + mesh（由官方 xacro 展开生成）
```

## 验证

- `tsc` 类型检查 0 错误；`vite build` 构建成功
- CCD IK 单元测试：4/4 通过（`node scripts/test-ik.mjs`）
- headless Edge 渲染验证通过

## 备注

- 模型来源：[UniversalRobots/Universal_Robots_ROS2_Description](https://github.com/UniversalRobots/Universal_Robots_ROS2_Description)（ros2 分支，教学用途）
- 预留硬件接口：架构上 `IHardwareLink` 通信层可后续对接真实机械臂（WebSocket/串口）
