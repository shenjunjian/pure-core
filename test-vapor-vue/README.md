# test-vapor-vue

`pure-vapor` API 目视回归工程：侧边栏切换各区块，验证 `<script setup vapor>` 编译与运行时行为。

## 本地运行

```bash
# 在 monorepo 根目录先构建依赖包（若尚未构建）
vp run build pure-vapor

cd test-vapor-vue
pnpm i
pnpm dev
```

## 页面结构

| 区块 | 覆盖范围 |
|------|----------|
| 总览 | 能力矩阵、不支持清单 |
| 渲染 | 插值、`v-text` / `v-html`、多根、`:is`、`v-once`、`useTemplateRef` |
| 指令 | `v-if` / `v-show` / `v-for` / `v-model` / `v-on`、自定义 Vapor 指令 |
| 样式 | `:class` / `:style`、scoped、`:deep()`、`useCssVars`、`useCssModule` |
| 组件 API | props / emits / expose / slots / model / attrs / 异步组件 |
| 内置组件 | Transition、TransitionGroup、KeepAlive、Teleport |
| 组合式 API | 响应式、watch、provide/inject、`useAttrs` 等 |
| 生命周期 | 挂载/更新/卸载及 KeepAlive 相关钩子 |
| 限制说明 | 只读：不支持 API 与原因（无运行示例，避免报错） |

## 规范：Vapor 不支持的指令与 API

与官方 [Feature Compatibility](https://github.com/vuejs/core/releases) / [vue-vapor#197](https://github.com/vuejs/vue-vapor/issues/197) 对齐。应用内「总览」「限制说明」页为可点击清单；此处为文档摘要。

### `v-memo`（不支持，勿写示例）

- **官方**：明确 unsupported / on hold。
- **编译**：`compiler-vapor` 无 `transformMemo`。`memo` 仅出现在 `isBuiltInDirective` 名单中（避免被当成自定义指令），模板里的 `v-memo` **静默丢弃**，不生成 `withMemo` / `isMemoSame`。
- **为何多余**：VDOM 的 `v-memo` 用来在依赖不变时跳过整棵 VNode 子树 patch。Vapor 每个绑定由独立 `_renderEffect` 做细粒度依赖追踪——effect 未读取的依赖变化不会触发更新，原先 `v-memo` 要解决的主场景已被架构覆盖。
- **注意**：不是「每个 block 整块天然 memo」，而是「按读取依赖更新」；与带依赖数组的整树 memo 语义不同，但对常见用法已足够。需要一次性静态快照用 `v-once`。

### 其他常见不支持项

| API | 说明 |
|-----|------|
| Options API | 仅 Composition API + `<script setup vapor>` |
| `getCurrentInstance()` | Vapor 组件中返回 `null` |
| `Suspense` | pure-vapor 未导出 |
| VDOM `h` / VNode | 本工程为 Block 语义 |
| SSR / `vaporInteropPlugin` 真互操作 | 未实现或为空 stub |
| vue-router | 依赖 VDOM 渲染 |

`isBuiltInDirective` 名单含 `memo` **不等于**已实现；实现与否以编译器 transform 与官方兼容性列表为准。

## 相关文档

- [`packages/pure-vapor/README.md`](../packages/pure-vapor/README.md) — 运行时包说明与排除表
- 应用内「限制说明」页 — 与上表同步的可浏览清单
