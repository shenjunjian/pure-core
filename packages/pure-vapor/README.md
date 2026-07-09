# pure-vapor

纯 JavaScript 的 Vapor 运行时，仅依赖 `@vue/shared` 与 `@vue/reactivity`。用于在构建时通过 `compiler-vapor` 的 `runtimeModuleName: 'pure-vapor'` 替代 `@vue/runtime-vapor` + `@vue/runtime-dom`。

## 构建产物

本包仅发布 `esm-bundler` 格式（与 `@vue/runtime-vapor` 相同），面向浏览器 + 打包器环境。

## 使用方式

在编译选项中指定运行时模块名：

```js
// vite / vue compiler options
compileTemplate: {
  vapor: true,
  vaporOptions: {
    runtimeModuleName: 'pure-vapor',
  },
}
```

或在 Vite 中 alias（需同时保证模板编译也指向 `pure-vapor` 的 helper import）：

```js
resolve: {
  alias: {
    vue: 'pure-vapor',
  },
},
```

## 与 @vue/runtime-vapor 的差异

| 项 | 说明 |
|----|------|
| 依赖 | 仅 `shared` + `reactivity`，无 `runtime-dom` / `runtime-core` |
| 语言 | 纯 `.js`，无 `.d.ts` |
| DOM 更新 | 与 `runtime-vapor` 一致，同步直接写入 DOM |
| `nextTick` | 与 `runtime-core` 一致，在 scheduler microtask flush 之后 |
| Transition | 导出 `VaporTransition`、`VaporTransitionGroup`（CSR；无 SSR hydration appear） |
| Template ref | 导出 `setStaticTemplateRef`、`setTemplateRefBinding`（compiler-vapor 生成） |
| Hydration / SSR / interop | 不实现（见 [UPSTREAM-SYNC.md](./UPSTREAM-SYNC.md)） |

## 程序化渲染：`h` / `Fragment`

本包导出 **Vapor 原生** `h` 与 `Fragment`（见 `src/vapor/h.js`）：

- 返回值是 **Block**（DOM / 组件实例 / Fragment），**不是** VNode
- 内部委托 `createPlainElement` / `createComponent` / `createDynamicComponent`
- 响应式与编译器产物一致：props / children 使用 **getter 或 ref** 才会随数据更新

```js
import { h, Fragment, ref, defineVaporComponent } from 'pure-vapor'

const msg = ref('hi')
const Comp = defineVaporComponent({
  setup() {
    return h('div', { class: () => msg.value }, () => msg.value)
  },
})
```

| 用法 | 说明 |
|------|------|
| `h('div', props, children)` | 原生标签 → Block（Element） |
| `h(VaporComp, props, slots)` | Vapor 组件（需 `__vapor`） |
| `h(Fragment, null, [a, b])` | 多根 Block |
| `h(tagRef, …)` | 动态 type（`createDynamicComponent`） |

**不是** VDOM 的 `h`：不能用于依赖 `createVNode` / patch 的库（如官方 vue-router 的 `RouterView`）。具名插槽需显式传 `null` props：`h(Comp, null, { header: () => … })`。

## 首版不支持

以下能力在完整 `vue` / `index-with-vapor` 链路中存在，但 **pure-vapor 不实现、不导出**：

| 类别 | 不导出示例 |
|------|-----------|
| 运行时编译 | `compile` |
| VDOM | `createVNode`、`openBlock`、VDOM 版 `Fragment` / `Text` / `Comment`、…（本包 `h` / `Fragment` 为 Block 语义，见上节） |
| VDOM App | `createSSRApp`、`hydrate`（`createApp` 为 `createVaporApp` 的别名） |
| SSR | `createVaporSSRApp`、`useSSRContext`、… |
| VDOM 内置 | `Teleport`、`KeepAlive`、`Suspense`、`Transition`（VDOM 版） |
| Vapor 互操作 | `vaporInteropPlugin` 已导出为空实现（仅返回 app），无 VDOM 互操作能力 |
| Devtools / compat | `devtools`、`compatUtils`、… |

使用 `<Suspense>` 的模板仍可被 `compiler-vapor` 生成对应 import，但本包不导出 `Suspense`，应用层需避免。

`<transition>` / `<TransitionGroup>` / `<KeepAlive>` / `<Teleport>` 已支持：编译器生成对应 Vapor 内置 import，本包已导出。

## vue-router 限制

官方 **vue-router 不能直接在 pure-vapor 上使用**。`resolve.alias: { vue: 'pure-vapor' }` 时，`<router-view>` / `<router-link>` 无法正常工作。

### 原因

| 依赖 | pure-vapor | vue-router 的用法 | 结果 |
|------|------------|-------------------|------|
| `h()` | 导出 **Block 版** `h`，不返回 VNode、无 patch | `RouterView` / `RouterLink` 内部用 VDOM `h()` 创建 VNode 并渲染 | 不兼容 |
| `setup(props, { attrs, slots })` | 支持该 API | `setup` 返回 `() => VNode` 渲染函数；scoped slot 传递 `{ Component: VNode, route }` | 语义属于 VDOM，与 Vapor block 模型不一致 |

pure-vapor 中 Vapor 组件的 `setup` 通常直接返回 **block**（DOM 节点树，由 `compiler-vapor` 的 `inlineTemplate` 生成，或手写 `h()`），`slots.default()` 返回的也是 block 而非 `VNode[]`。vue-router 的 `RouterView` 则用 VDOM `h(ViewComponent, props)` 构造 VNode，并通过 slot 把 **VNode** 传给外层。本包无 VNode 运行时与 patch 流程，也没有 VDOM 互操作（`vaporInteropPlugin` 仅为空 stub）。

### 仍可能可用的部分

不依赖 VDOM 渲染的路由**逻辑层** API（如 `createRouter`、`router.push`、`useRouter`、`useRoute`）在 API 层面与 pure-vapor 导出的 `inject` / `computed` / `ref` 等兼容，但**不能替代** `<router-view>` / `<router-link>` 的渲染能力。

### 应用层建议

- 不要指望将官方 vue-router 与 `vue → pure-vapor` alias 组合后开箱即用。
- 需要 **Vapor 原生** 的 `RouterView` / `RouterLink`（或等价实现）：slot 传递组件定义或 block，动态出口使用 `createDynamicComponent` / Block 版 `h()`，而非 VDOM `h()` + VNode。
- 用户模板中的 `<router-view v-slot="{ Component }">` 虽可由编译器生成 Vapor 代码，但瓶颈在 **vue-router 组件本身仍是 VDOM 实现**，而非用户侧是否手写 `setup(props, { slots })`。

## 测试

```bash
pnpm i
vp run build pure-vapor
vp run test pure-vapor
```

`packages/pure-vapor/__tests__/` 覆盖：

- **编译器冒烟**：`compileSmoke.spec.js`（`runtimeModuleName: 'pure-vapor'` 快照 + `new Function` 挂载）
- **导出契约**：`exports.spec.js`（必需符号存在、排除表符号不存在）
- **控制流 / 组件核心**：`block` / `if` / `for` / `componentSlots` / `templateRef` / `renderEffect`
- **程序化渲染**：`h.spec.js`（标签 / 组件 / 响应式 props&children / Fragment）
- **内置组件**：`components/Transition` / `TransitionGroup` / `KeepAlive` / `Teleport`
- **DOM 层**：`dom/prop` / `scopeId` / `componentProps`
- **App / internal**：`apiCreateVaporApp` / `internal` / `multi-app` / `hmr`

需要等待 scheduler 队列时，使用 `__tests__/_utils.js` 的 `flushAll()`（`await Promise.resolve()`）。

## upstream 同步

与 `@vue/runtime-vapor` 的模块对照、测试移植范围及后续 minor 合并流程见 [UPSTREAM-SYNC.md](./UPSTREAM-SYNC.md)。

## 开发

与测试命令相同；完整 monorepo 校验见根目录 `AGENTS.md`。
