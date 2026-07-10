# Vapor 核心数据结构：Block

在 Vue Vapor 里，**Block 是渲染结果的统一抽象**。组件 `setup` / `render` 返回的不是 VNode 树，而是 Block；`insert` / `remove` / `move` 等 DOM 操作都以 Block 为入口；Fragment、Slot、`v-if` / `v-for` 也都建立在 Block 之上。

可以把它理解成：

> **「一段已经（或即将）存在于 DOM 中的内容」的句柄。**

本文面向新手，介绍 Block 的形态、运行原理，以及常见用法。

---

## 1. 为什么需要 Block？

传统 VDOM 路径大致是：

```
模板 → VNode 树 → patch → 真实 DOM
```

Vapor 走的是另一条路：编译器直接生成操作 DOM 的代码，运行时不再维护完整的虚拟节点树。但「渲染结果」仍然需要一个统一类型，用来：

- 挂载到父节点（`insert`）
- 从父节点卸载（`remove`）
- 在列表重排时移动（`move`）
- 判断内容是否「有效」（slot fallback、`v-if` 等）

这个统一类型就是 **Block**。

对比记忆：

| | VDOM | Vapor |
|---|---|---|
| 渲染产物 | `VNode` | `Block` |
| 更新方式 | `patch(oldVNode, newVNode)` | 细粒度 effect 直接改 DOM / 换 branch |
| 多根 | Fragment VNode | `Block[]` 或带 `anchor` 的 Fragment |
| 组件实例 | 持有 `subTree: VNode` | 持有 `block: Block` |

`h()` 在 Vapor 里也返回 Block，而不是 VNode：

```js
// Vapor-native h：返回可挂载的 Block
h('div', { class: 'box' }, 'hello')  // → Element (Node)
h(Child, { label: () => x.value })   // → VaporComponentInstance
h(Fragment, [a, b])                  // → Block[] 或 DynamicFragment
```

---

## 2. Block 是什么？—— 四种形态的联合类型

源码里的判定非常直接（`packages/pure-vapor/src/vapor/block.js`）：

```js
export function isBlock(val) {
  return (
    val instanceof Node ||
    isArray(val) ||
    isVaporComponent(val) ||
    isFragment(val)
  )
}
```

对应 TypeScript 定义（`runtime-vapor`）：

```ts
type Block =
  | Node                    // 单个 DOM 节点
  | VaporFragment           // Fragment（含 DynamicFragment / SlotFragment / ForBlock …）
  | DynamicFragment         // 动态分支（v-if、keyed fragment 等）
  | VaporComponentInstance  // 子组件实例
  | Block[]                 // 多根 / 子节点列表
```

### 2.1 `Node` —— 最简单的 Block

一个真实 DOM 节点本身就是 Block：

```js
const el = document.createElement('div')
el.textContent = 'hi'
// el 就是一个合法 Block，可以直接 insert / remove
```

编译产物里常见的 `_template(...)()` 返回值，就是克隆出来的 `Element` / `Text`。

### 2.2 `Block[]` —— 多根列表

数组表示「多个并列的 Block」：

```js
// 多根组件 / Fragment 子节点
;[n0, n1, n2]
```

`insert` / `remove` 会对数组逐项递归处理。嵌套数组也会被摊平理解（见 `normalizeBlock`）。

### 2.3 `VaporComponentInstance` —— 组件也是 Block

子组件实例本身可作为 Block 插入父树。挂载时：

- 若尚未 mount → 调用 `mountComponent`，最终 `insert(instance.block, …)`
- 若已 mount → 直接操作其内部的 `instance.block`

因此组件在 Block 树里是一层「包装」：对外是组件实例，对内仍是另一个 Block。

### 2.4 `VaporFragment` —— 带元数据的内容容器

Fragment 不是 DOM 的 `DocumentFragment`，而是运行时对象，核心字段：

```js
class VaporFragment {
  nodes        // 实际内容：又是一个 Block
  anchor?      // 定位锚点（Text / Comment），用于动态更新时找插入位置
  scope?       // 该分支的 EffectScope（卸载时 stop）
  // 以及 renderInstance / slotOwner / slotBoundary 等渲染上下文快照
}
```

常见子类：

| 类型 | 用途 |
|---|---|
| `VaporFragment` | 基础片段 |
| `DynamicFragment` | `v-if`、keyed fragment 等可切换分支 |
| `SlotFragment` | `<slot>`，带 fallback / boundary |
| `ForFragment` / `ForBlock` | `v-for` 列表与单项 |

**关键点：** Fragment 的 `nodes` 仍然是 Block，于是 Block 可以递归嵌套成一棵树。

---

## 3. 一张图看清关系

```
组件 instance.block
        │
        ▼
   ┌─ Block ─┐
   │         │
   ├─ Node ─────────────────────────── 真实 DOM
   ├─ Block[] ──► Block, Block, …     多根
   ├─ Component ──► .block ──► Block  子组件
   └─ Fragment
         ├─ .nodes ──► Block          实际内容
         └─ .anchor ──► Node?         插入锚点
              │
              ├─ DynamicFragment      v-if / keyed
              ├─ SlotFragment         slot
              └─ ForBlock             v-for item
```

Fragment、Slot、`v-if` / `v-for` **不另起一套挂载协议**，而是实现「长得像 Fragment 的 Block」，复用同一套 `insert` / `remove` / `move`。

---

## 4. 核心操作：insert / remove / move

`block.js` 的精髓是：**按形态分发，再递归**。

### 4.1 `insert(block, parent, anchor)`

把 Block 挂到 `parent` 下，插在 `anchor` 之前（`anchor === 0` 表示 prepend）。

伪逻辑：

```
insert(block):
  if Node        → domInsert(parent, block, anchor)   // 可走 transition enter
  if Component   → mount 或 insert(component.block)
  if Array       → 对每一项 insert
  if Fragment    → 先插 anchor（若有），再 insert(nodes) 或自定义 block.insert
```

Fragment 的特殊之处：

1. 若有 `block.anchor`，先把锚点插到目标位置，再以锚点为新的 `anchor` 插入内容（内容始终在锚点之前）。
2. 若定义了自定义 `block.insert`（如 `SlotFragment.insertSlot`），走自定义路径。

### 4.2 `remove(block, parent)`

对称卸载：

```
remove(block):
  if Node        → domRemove（可走 transition leave）
  if Component   → unmountComponent
  if Array       → 逐项 remove
  if Fragment    → 自定义 remove 或 remove(nodes)；再删 anchor；stop scope
```

卸载 Fragment 时会 `scope.stop()`，清掉该分支上的响应式 effect——这是动态分支切换不泄漏的关键。

### 4.3 `move(block, parent, anchor, moveType)`

用于列表重排、Transition 等场景，语义接近「先离开再插入」，但尽量复用已有 DOM，而不是销毁重建。

### 4.4 `isValidBlock` / `isValidSlot`

判断 Block 是否算「有有效内容」：

- `Comment` 节点 → 无效
- 空数组 / 全无效子项 → 无效
- 组件：默认看内部 `block`；`isValidSlot` 时组件本身算有效（对齐 VDOM slot 语义：有组件就算提供了内容）
- Fragment：看 `nodes`（或自定义 `isBlockValid` / `getEffectiveOutput`）

Slot 的 fallback 切换就依赖这套判定。

---

## 5. 运行原理：从组件到 DOM

### 5.1 组件产出 Block

Vapor 组件最终要把渲染结果写到 `instance.block`：

```js
// 生产环境常见路径：setup 直接返回 Block
instance.block = setupResult  // Node | Block[] | Fragment | …

// 挂载
mountComponent(instance, parent, anchor)
  → insert(instance.block, parent, anchor)
```

开发模式下若 `setup` 返回 bindings 对象，会再走 `render` 得到 Block。

### 5.2 静态模板 → Node Block

```js
const t0 = template('<div class="box">hello</div>', /* ROOT */ 1)
const n0 = t0()  // clone 出的 Element，本身就是 Block
```

### 5.3 动态分支 → DynamicFragment

`createIf` 不会每次返回全新 DOM 树根，而是创建一个 `DynamicFragment`，在 `renderEffect` 里 `frag.update(branchFn)`：

```
createIf(cond, b1, b2)
  → DynamicFragment (带 anchor)
  → renderEffect:
       cond 变化 → remove 旧 nodes + stop scope
                 → 跑新 branch → nodes = 新 Block
                 → insert(nodes, parent, anchor)
```

锚点（dev 下常是 `<!--if-->` 注释，prod 下是空文本节点）固定在 DOM 里，用来定位「这段动态内容该插在哪」。

### 5.4 列表 → ForFragment + ForBlock

`v-for` 维护一组 `ForBlock`（每项一个 Fragment + scope + key）。diff 之后对单项做 `insert` / `remove` / `move`，操作的仍是 Block API。

### 5.5 Slot → SlotFragment

`<slot>` 对应 `SlotFragment`：继承 `DynamicFragment`，额外管理 content / fallback、slot boundary。对外仍是 Fragment 形态的 Block，因此父级 `insert(slotFrag)` 无需特殊分支——自定义逻辑藏在 `insert` / `remove` 方法里。

---

## 6. 使用示例

下面示例贴近 `pure-vapor` 运行时 API，便于理解「Block 长什么样、怎么挂」。

### 6.1 最简单：Node 作为 Block

```js
import { insert, remove } from './block.js'

const parent = document.querySelector('#app')
const el = document.createElement('p')
el.textContent = 'Hello Block'

insert(el, parent)          // 挂载
remove(el, parent)          // 卸载
```

### 6.2 多根：数组 Block

```js
const a = document.createTextNode('A')
const b = document.createElement('span')
b.textContent = 'B'

const block = [a, b]
insert(block, parent)       // 依次插入 A、B
remove(block, parent)       // 依次移除
```

### 6.3 Fragment：带锚点的动态区域

```js
import { VaporFragment } from './fragment.js'
import { insert, remove } from './block.js'

const anchor = document.createTextNode('')
const content = document.createElement('div')
content.textContent = 'dynamic'

const frag = new VaporFragment(content)
frag.anchor = anchor

insert(frag, parent)
// DOM 顺序大致为：…, content, anchor, …

remove(frag, parent)
// 先按 frag.remove / remove(nodes)，再删 anchor；若有 scope 会 stop
```

`DynamicFragment` 会在构造时自动创建 `anchor`，并由 `update()` 负责换 branch。

### 6.4 用 `h()` 得到 Block

```js
import { h, Fragment } from 'vue'  // vapor 构建下

const block1 = h('div', { class: 'box' }, 'static')
// → Element

const block2 = h(Fragment, [
  h('p', null, 'one'),
  h('p', null, 'two'),
])
// → 多根 Block（数组或 fragment）

const block3 = h('div', { class: () => cls.value }, () => msg.value)
// props / children 用 getter，内部用 effect 更新 DOM；
// 返回值仍是可 insert 的 Block
```

### 6.5 组件返回 Block

```js
import { defineVaporComponent, h } from 'vue'

const Hello = defineVaporComponent({
  setup() {
    // 必须返回 Block（Node / 数组 / Fragment / 子组件实例）
    return h('div', null, 'hello vapor')
  },
})

// 父级
const child = h(Hello)  // → VaporComponentInstance（也是 Block）
insert(child, parent)   // 内部 mountComponent → insert(child.block, …)
```

### 6.6 嵌套结构示意

编译后的多根 + 子组件，概念上类似：

```js
// 某组件 render / setup 的返回值
const n0 = t0()                         // <div> 静态根
const c0 = createComponent(Child, …)    // 子组件实例
const frag = createIf(() => ok.value,   // DynamicFragment
  () => t1(),
  () => t2(),
)

return [n0, c0, frag]                   // 整个返回值是一个 Block[]
```

挂载根组件时：`insert([n0, c0, frag], appContainer)`，递归完成整棵树的挂载。

### 6.7 测试里的直观用法

仓库测试（`block.spec.js`）展示了同一套 API：

```js
const container = document.createElement('div')
insert([anchor], container)
insert([node1], container)
insert([node2], container, anchor)
// childNodes ≈ [node2, anchor, node1]

prepend(container, new VaporFragment(node3))
// 在最前插入 fragment 的 nodes

remove([node1], container)
remove(frag, container)
```

---

## 7. 设计要点（读源码时抓住这些）

1. **Block 是联合类型，不是单一 class**  
   用 `instanceof` / `isArray` / `isVaporComponent` / `isFragment` 分发，避免为每个节点包一层对象（省内存、贴 DOM）。

2. **一切操作递归**  
   `insert` / `remove` / `move` / `isValidBlock` / `findBlockBoundary` 都是同一套递归协议。新结构只要能被识别为上述形态（或提供 Fragment 的 `insert`/`remove`/`nodes`），就能接入。

3. **Fragment = Block + 元数据**  
   `nodes` 仍是 Block；`anchor` 解决动态更新定位；`scope` 管理分支 effect；上下文快照（`renderInstance` / `slotOwner`）保证异步更新时 slot 归属正确。

4. **组件是 Block 的一层间接**  
   `instance.block` 才是真实内容；对组件做 insert/remove，等于对包装层做生命周期，再落到内部 Block。

5. **自定义扩展点在 Fragment 上**  
   `SlotFragment` 的 `insert` / `remove`、`isBlockValid`、`getEffectiveOutput` 等，让 slot / interop 在不改动 `block.js` 主路径的前提下扩展行为。

---

## 8. 和周边概念的对照

| 概念 | 与 Block 的关系 |
|---|---|
| **Fragment** | Block 的一种形态；`nodes` 仍是 Block |
| **Slot** | `SlotFragment` ⊆ DynamicFragment ⊆ Fragment ⊆ Block |
| **v-if** | `DynamicFragment`，`update` 时替换 `nodes` |
| **v-for** | `ForFragment` 持有 `ForBlock[]`，每项是 Fragment |
| **Component** | 实例是 Block；内部 `instance.block` 又是 Block |
| **h()** | 工厂函数，返回 Block |
| **template()** | 工厂函数，调用后得到 Node（Block） |

更细的 slot 上下文见：[slot相关逻辑.md](./slot相关逻辑.md)。

---

## 9. 一句话总结

**Block 是 Vapor 对「可挂载渲染结果」的统一称呼**：可以是 DOM 节点、节点数组、组件实例，或带锚点/作用域的 Fragment。运行时用同一套递归的 `insert` / `remove` / `move` 操作这棵树；Fragment、Slot、动态指令都是在这套协议上叠加状态与更新策略，而不是另起炉灶。

读 Vapor 源码时，先问「这里返回的 Block 是四种形态里的哪一种？」，再顺着 `insert` 的分发往下看，整条渲染链路会清晰很多。
