# \vapor\componentSlots.js  `currentSlotOwner` 的作用


`currentSlotOwner` 是一个**模块级运行时上下文变量**，用来记录当前正在执行的 slot 内容属于哪个组件实例（slot owner），与 `currentInstance`（当前正在渲染的组件）配合使用。

## 核心作用

在 Vapor 里，slot 相关逻辑需要知道：**应该从哪个组件实例上读 `rawSlots`、继承哪个 `scopeId`**。嵌套 slot、转发 slot 时，执行 `<slot>` 的可能是子组件，但 slot 内容实际定义在父组件（或更外层）上，这时不能只看 `currentInstance`。

`getScopeOwner()` 就是基于它做决策：

```105:107:e:\core\packages\pure-vapor\src\vapor\componentSlots.js
export function getScopeOwner() {
  return currentSlotOwner || currentInstance
}
```

优先用 `currentSlotOwner`，没有则回退到 `currentInstance`。

## 主要用途

### 1. `createSlot` 解析正确的 slot 与 scopeId

`createSlot` 通过 `getScopeOwner()` 取实例，再读 `rawSlots` 和 `__scopeId`：

```126:132:e:\core\packages\pure-vapor\src\vapor\componentSlots.js
  const instance = getScopeOwner()
  const rawSlots = instance.rawSlots
  const slotProps = rawProps
    ? new Proxy(rawProps, rawPropsProxyHandlers)
    : EMPTY_OBJ
  const scopeId = !noSlotted && instance.type.__scopeId
```

### 2. 标记 forwarded slot（转发 slot）

若当前 slot owner 不是正在渲染的组件，说明这是转发 slot：

```136:137:e:\core\packages\pure-vapor\src\vapor\componentSlots.js
  slotFragment.forwarded =
    currentSlotOwner != null && currentSlotOwner !== currentInstance
```

### 3. 在 slot 函数执行时保持上下文

`withVaporCtx` 会把当前 scope owner 绑到 slot 函数上，确保 slot 内容执行时上下文不丢：

```109:118:e:\core\packages\pure-vapor\src\vapor\componentSlots.js
export function withVaporCtx(fn) {
  const owner = getScopeOwner()
  return (...args) => {
    const prevOwner = setCurrentSlotOwner(owner)
    try {
      return fn(...args)
    } finally {
      setCurrentSlotOwner(prevOwner)
    }
  }
}
```

### 4. Fragment / v-for 更新时恢复上下文

`VaporFragment` 创建时会快照 `currentSlotOwner`，后续在 `runWithRenderCtx` 里恢复，避免异步更新或 v-for 重渲染时 slot 归属错乱：

```20:21:e:\core\packages\pure-vapor\src\vapor\fragment.js
    this.renderInstance = currentInstance
    this.slotOwner = currentSlotOwner
```

`createFor` 也会在 `renderEffect` 更新时临时恢复 `slotOwner`。

### 5. 子组件 setup 期间临时清空

创建子组件时，setup 阶段会先把 `currentSlotOwner` 置为 `null`，避免父组件的 slot 上下文污染子组件：

```156:157:e:\core\true\packages\pure-vapor\src\vapor\component.js
  // reset currentSlotOwner to null to avoid affecting the child components
  const prevSlotOwner = setCurrentSlotOwner(null)
```

setupIdk why path got corrupted - let me fix in response - actually the read showed correct path)

## `setCurrentSlotOwner` 的模式

和 `setCurrentInstance` 一样，是**可嵌套的 push/pop**：

```21:25:e:\core\packages\pure-vapor\src\vapor\componentSlots.js
export function setCurrentSlotOwner(owner) {
  const prev = currentSlotOwner
  currentSlotOwner = owner
  return prev
}
```

调用方保存返回值，在 `finally` 里恢复，保证嵌套 slot / 异常路径下上下文正确。

## 简单理解

可以把 `currentSlotOwner` 看成：**“这段 slot 内容是谁定义的”**。  
`currentInstance` 是“现在在渲染谁”，`currentSlotOwner` 是“slot 内容归属谁”。嵌套/转发 slot 时两者可能不同，所以需要单独跟踪。