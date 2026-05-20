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

或在 Vite 中 alias：

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
| DOM 更新 | 批量入队 + `requestAnimationFrame` 播放（`jobDomOperatorList`） |
| `nextTick` | 在 DOM 播放完成后触发（pure-vapor 扩展 API） |

## 首版不支持

- SSR（`createVaporSSRApp` 等）
- VDOM 互操作（`vaporInteropPlugin`）
- Devtools
- `Suspense`
- `VaporTransition` / `VaporTransitionGroup`

使用 `<Suspense>` 或 `<transition>` 的模板仍可被编译器生成 import，但本包不导出对应符号，需在应用层避免或等待后续版本。

## 开发

```bash
pnpm i
vp run build pure-vapor
vp run test pure-vapor
```
