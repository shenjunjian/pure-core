---
name: pure-vapor 生命周期事件设计
overview: 为 pure-vapor 的应用与组件关键生命周期节点设计一组可观测事件，并将其统一纳入 cbMap 键集合，在对应流程中调用 lifeDispatch(type, context)。
todos:
  - id: design-cbmap-keys
    content: 重构 lifeEvent/cbMap 事件键与注释，定义上下文类型
    status: completed
  - id: wire-app-events
    content: 在 apiCreateApp 的 mount/unmount 节点接入应用级事件
    status: completed
  - id: wire-component-events
    content: 在 component 的 create/mount/unmount 节点接入组件级事件
    status: completed
  - id: wire-update-events
    content: 在 renderEffect 更新分支接入 before/after update 事件
    status: completed
  - id: validate-types-flow
    content: 检查事件类型推导和关键流程触发顺序
    status: in_progress
isProject: false
---

# pure-vapor 生命周期事件接入计划

## 目标

在不改变现有渲染行为的前提下，为应用创建/挂载/卸载与组件创建/挂载/更新/卸载流程补齐统一的生命周期事件，并把事件名集中定义在 `cbMap` 的键上（带注释说明触发时机和参数）。

## 现状结论

- 目前仅在 [`e:\core\packages\pure-vapor\src\apiCreateApp.ts`](e:\core\packages\pure-vapor\src\apiCreateApp.ts) 触发了 `beforeCreateApp` 与 `createdApp`。
- [`e:\core\packages\pure-vapor\src\lifeEvent\index.ts`](e:\core\packages\pure-vapor\src\lifeEvent\index.ts) 中 `cbMap` 仍是 fake 结构，注释时机也不准确。
- 组件真实流程位于 [`e:\core\packages\pure-vapor\src\component.ts`](e:\core\packages\pure-vapor\src\component.ts)（`createComponent` / `setupComponent` / `mountComponent` / `unmountComponent`）与 [`e:\core\packages\pure-vapor\src\renderEffect.ts`](e:\core\packages\pure-vapor\src\renderEffect.ts)（更新触发）。

## 事件名设计（按流程）

### 应用级

- `beforeCreateApp`：进入 `createVaporApp` 后、构造 `appContext` 前。
- `createdApp`：`app` 对象构建完成后。
- `beforeMountApp`：`app.mount()` 内部，解析 container 且准备创建根组件前。
- `mountedApp`：根组件 `mountComponent` 完成且 `isMounted=true` 后。
- `beforeUnmountApp`：`app.unmount()` 内部，执行清理和 `unmountComponent` 前。
- `unmountedApp`：`unmountComponent` 完成且 `app._instance` 置空后。

### 组件级

- `beforeCreateComponent`：`createComponent()` 刚创建实例前。
- `createdComponent`：实例构造完成并完成 `setupComponent` 后。
- `beforeMountComponent`：`mountComponent()` 内部执行 `insert` 前。
- `mountedComponent`：`insert` 后、`instance.isMounted=true` 后。
- `beforeUpdateComponent`：`RenderEffect.fn()` 命中更新分支，执行 `instance.bu` 前。
- `updatedComponent`：更新分支 render 完成并执行 `instance.u` 后。
- `beforeUnmountComponent`：`unmountComponent()` 首次有效卸载分支中，`scope.stop()` 前。
- `unmountedComponent`：卸载逻辑完成（含 DOM remove 结束）后。

## 上下文参数规范（lifeDispatch 第二参数）

统一传单个对象，减少回调签名碎片化：

- App 事件：`{ app, appContext, container, isMounted, component, props }`（按节点可用性裁剪）。
- Component 事件：`{ instance, parentNode, anchor, parent, appContext, isMounted, isUnmounted }`（按节点可用性裁剪）。
- Update 事件额外带：`{ effect, isUpdating }`（来自 `RenderEffect`）。

## 改动文件与实施顺序

1. 更新 [`e:\core\packages\pure-vapor\src\lifeEvent\index.ts`](e:\core\packages\pure-vapor\src\lifeEvent\index.ts)
   - 重写 `cbMap` 键为上述事件全集。
   - 每个键后追加中文注释：触发时机 + 上下文对象关键字段。
   - 补充基础类型（App/Component 回调上下文类型），避免 `Function[]`。
2. 更新 [`e:\core\packages\pure-vapor\src\apiCreateApp.ts`](e:\core\packages\pure-vapor\src\apiCreateApp.ts)
   - 在 `mount/unmount` 关键位置补 `beforeMountApp` / `mountedApp` / `beforeUnmountApp` / `unmountedApp`。
   - 统一 `lifeDispatch(type, contextObj)` 传参风格。
3. 更新 [`e:\core\packages\pure-vapor\src\component.ts`](e:\core\packages\pure-vapor\src\component.ts)
   - 在 `createComponent`、`mountComponent`、`unmountComponent` 按节点补组件级事件。
   - 确保仅在“首次有效卸载”触发卸载事件，避免重复派发。
4. 更新 [`e:\core\packages\pure-vapor\src\renderEffect.ts`](e:\core\packages\pure-vapor\src\renderEffect.ts)
   - 在更新分支补 `beforeUpdateComponent` / `updatedComponent`。

## 验证

- 类型检查：确认新增事件名在 `lifeListen` 的 `keyof cbMap` 下可推导。
- 行为检查：根组件 mount、响应式触发 update、app.unmount 三段流程均能触发对应事件；重复 unmount 不重复触发组件卸载事件。
