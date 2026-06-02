这是 **Vue Vapor 在 alpha 阶段持续演进** 导致的正常现象，不是 `<div class='xxx'>` 本身“有时编译错”。同一模板在不同版本、不同上下文下，`_template` 的参数个数和含义都变过。

## `_template` 签名经历了三代

### 1. 早期（无 static 标记，约 #14752 之前）

```js
template(html, root?, ns?)
```

- 只有 **是否根节点** 和 **命名空间（SVG/MathML）**
- 单根静态 `<div class='xxx'>` 大致是：

```js
const t1 = _template("<div class=xxx>", true)
```

- 非根、无 namespace 时省略第二参：

```js
const t1 = _template("<div class=xxx>")
```

### 2. Static Template 优化（#14752，约 2026-04）

新增 **static 标记**，仅用于 hydration 快路径：编译器判定“整段 HTML 之后不会再被 Vapor 修改”时，运行时可直接 clone，不必走 `adoptTemplate`。

此时改为 **布尔参数**：

```js
template(html, root?, isStatic?, ns?)
```

生成代码类似：

```js
// 单根 + 静态
_template("<div class=xxx>", true, true)

// 多根里的某个静态节点（不是 template root）
_template("<div class=xxx>", false, true)

// 有动态绑定，不能标 static
_template("<div>", true)           // 只有 root
_template("<div>")                 // 既非 root 也非 static
```

### 3. Flags 位掩码（#14839，约 2026-05）

为减小体积、统一参数，布尔改 **数字 flags**：

```32:35:packages/shared/src/vaporFlags.ts
export enum TemplateFlags {
  ROOT = 1,
  STATIC = 1 << 1,
}
```

```27:35:packages/compiler-vapor/src/generators/template.ts
    const flags =
      (root ? TemplateFlags.ROOT : 0) | (isStatic ? TemplateFlags.STATIC : 0)
    if (flags || ns) {
      args += `, ${flags}`
    }

    if (ns) {
      args += `, ${ns}`
    }
```

对应关系：

| flags | 含义 |
|-------|------|
| 无第二参 | 非 root、非 static |
| `1` | ROOT |
| `2` | STATIC |
| `3` | ROOT \| STATIC（单根静态） |

所以你看到的三种形式，大致是：

```js
_template("<div class=xxx>", false, true)  // 旧：非 root + static
_template("<div class=xxx>", 2)            // 新：仅 STATIC
_template("<div class=xxx>")               // 无 flags（见下文）
```

## 为什么同一个 `<div class='xxx'>` 参数还不一样？

除了 **版本差异**，还取决于 **编译上下文**。编译器在 `registerTemplate()` 里会算两个维度：

```261:264:packages/compiler-vapor/src/transform.ts
    const id = this.pushTemplate(this.template, {
      root: this.templateRoot,
      static: this.canUseStaticTemplate(),
    })
```

**`root`**：是否是组件 template 的单根（单根可省略闭合标签，如 `"<div class=xxx>"`）。

**`static`**：是否满足 `canUseStaticTemplate()`，例如：

- 不在 `v-for` 里
- 无动态子节点
- 无 effect / operation（无 `:foo`、`@click`、`v-text`、`ref`、自定义指令等）
- 不是 custom element / `<template>` 的 createElement 路径

因此同一标签在不同场景下：

| 场景 | 当前版本大致输出 |
|------|------------------|
| 单根、纯静态 `class` | `_template("...", 3)` |
| 多根之一、纯静态 | `_template("...", 2)` |
| 有 `:class` / `@click` 等 | `_template("...", 1)` 或 `_template("...")` |
| 与动态节点 HTML 相同但不 dedupe | 会同时出现 `_template("<span>", 2)` 和 `_template("<span>")` |

`class='xxx'` 是静态属性，会 **内联进 HTML 字符串**（`"<div class=xxx>"`），不会单独生成 `_setProp`；能否标 static 仍取决于上面那些条件。
 

**编译器与 runtime 必须同版本**。用旧 runtime 跑新 flags 代码，或反过来，都可能 hydration 错位或行为异常。

 