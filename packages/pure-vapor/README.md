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
| Transition | 导出 `VaporTransition`、`VaporTransitionGroup`（与 `@vue/runtime-vapor` 对齐；无 SSR hydration appear 路径） |

## 首版不支持

以下能力在完整 `vue` / `index-with-vapor` 链路中存在，但 **pure-vapor 不实现、不导出**：

| 类别 | 不导出示例 |
|------|-----------|
| 运行时编译 | `compile` |
| VDOM | `h`、`createVNode`、`Fragment`、`openBlock`、… |
| VDOM App | `createSSRApp`、`hydrate`（`createApp` 为 `createVaporApp` 的别名） |
| SSR | `createVaporSSRApp`、`useSSRContext`、… |
| VDOM 内置 | `Teleport`、`KeepAlive`、`Suspense`、`Transition`（VDOM 版） |
| Vapor 互操作 | `vaporInteropPlugin` 已导出为空实现（仅返回 app），无 VDOM 互操作能力 |
| Devtools / compat | `devtools`、`compatUtils`、… |

使用 `<Suspense>` 的模板仍可被 `compiler-vapor` 生成对应 import，但本包不导出 `Suspense`，应用层需避免。

`<transition>` / `<TransitionGroup>` 已支持：编译器生成 `VaporTransition` / `VaporTransitionGroup` import，本包已导出对应符号。

## 测试

```bash
pnpm i
vp run build pure-vapor
vp run test pure-vapor
```

`packages/pure-vapor/__tests__/` 覆盖：

- **编译器冒烟**：`compileSmoke.spec.js`（`runtimeModuleName: 'pure-vapor'` 快照 + `new Function` 挂载）
- **导出契约**：`exports.spec.js`（必需符号存在、排除表符号不存在）
- **移植用例**：`block` / `if` / `for` / `apiCreateVaporApp` / `renderEffect` / `internal` / `Transition`（源自 `runtime-vapor`，跳过 Suspense / interop / hydration）

需要等待 scheduler 队列时，使用 `__tests__/_utils.js` 的 `flushAll()`（`await Promise.resolve()`）。

## 开发

与测试命令相同；完整 monorepo 校验见根目录 `AGENTS.md`。
