# 创建组件实例
 * @param {any} `component` 组件定义或渲染函数
 * @param {any} `rawProps` 原始属性
 * @param {any} `rawSlots` 原始插槽
 * @param {boolean} `isSingleRoot` 组件是否是父模板 block 的唯一根级子节点
 * @param {boolean} `once` 是否只执行一次
 * @param {any} `appContext` 应用上下文
 * @param {boolean} `managedMount` 是否由调用方负责挂载。只有 hydration / vdomInterop 才用到这个参数


# createComponent 调用分类
createComponent 有两条入口：编译生成的 render()（占绝大多数）和 运行时手写调用（少数）。

编译器 genCreateComponent
  ├─ createAssetComponent(name, …)     ← 静态 import 组件
  ├─ createComponentWithFallback(…)    ← 需 resolve 的组件
  ├─ createComponent(tag, …)           ← _ctx.Comp 等
  ├─ createPlainElement(tag, …)        ← 自定义元素标签
  └─ createDynamicComponent(…)         ← <component :is>
运行时（pure-vapor 源码内）
  ├─ apiCreateApp.mount              
           ←  createComponent(app._component,app._props,null, `false`, false, app._context)
  ├─ apiDefineCustomElement._createComponent
           ←  createComponent( this._def, this._props, undefined, `undefined`, undefined, this._app._context)
  ├─ apiDefineAsyncComponent（error/loading/inner）
           ←  createComponent(errorComponent, { error: () => error.value })
           ←  createComponent(loadingComponent)
           ←  createComponent( comp, rawProps, rawSlots, `undefined`, undefined, parent.appContext, )
  ├─ createComponentWithFallback → createComponent
           ←  createComponent( comp, rawProps, rawSlots, `isSingleRoot`, once, appContext, )
  └─ hmrReload
          ←   createComponent( newComp, instance.rawProps, instance.rawSlots, `instance.isSingleRoot`, undefined, instance.appContext, )


# 逻辑分析

1. appContext 可以传入（初始化root时）， 不传入则从 currentInstance.appContext 获取。 这样就能不断继承下去

2. rawProps
   当前组件的绑定的原始属性。 

   如果是唯一父组件的子组件时，而且需要自己需要inheritAttrs，且父组件有多余的attr, 自己的rawProps 会混入一个 $ 属性:   
   场景： currentInstace =<Middle some-other-attr="1" /> 且 Middle组件只有一个 <Helloworld />, 
          则 currentInstace.hasFallthrough=true   currentInstace.rawProps= {'some-other-attr': ()=>'1'}, 且props. attrs 都是new Proxy(this)
   正在`创建Helloworld组件`时, 才会进入这段逻辑.  helloworld自己的 rawProps=null,  但发现自己要背负父组件的attrs,
        则最终自己的rawProps被改造成 `{$: [ () => currentInstance.attrs]}`

3. instance.attrs

```js
      const handlers = getPropsProxyHandlers(comp, once)
      const attrsHandlers = handlers[1]
      this.attrs = new Proxy(this, attrsHandlers)
```

attrs 不是普通对象，而是 new Proxy(this, attrsHandlers)——Proxy 的 target（目标对象）就是 this（VaporComponentInstance 本身）。

所以在 Chrome / VS Code 调试器里看 currentInstance.attrs，经常会看到：

+ 类型显示成 VaporComponentInstance
+ 展开后像整个实例
+ 或者在 Variables 里和 currentInstance 长得很像

这是因为调试器展示的是 Proxy 的 target，而不是「{ class: '...', 'data-x': '...' } 这种纯 attrs 对象」。


attrs['some-other-attr'] 或 Object.keys(attrs)  就能看到真实的透传的attr有哪些。

4. const instance = new VaporComponentInstance

+ instance是一个类， 通过 currentInstance 是否存在，判断是root还是子组件。  
+ instance的四个属性： `root appContext    provides  ids  parent` ,是用于组件树的继承用的
+ type 是comp组件定义对象，  uid++, vapor=true
+ 运行时上下文变量：  
     `block  scope scopeId emit expose refs       emmited exposed  exposeProxy propsDefaults`
     `isMounted isUnmounted  isUpdating isDeactivated ==== undefined`
     `rawProps  hasFallthrough`
     如果有rawProps 或 组件自己有props, 则生成 `attrs  props = new Proxy(this...)`, 否则这`attrs  props` = EMPTY_OBJ
     `rawSlots  slots`  rawSlots.$ 也具有透传父组件$的某种机制，类似于 attrs

5.  保存slotOwner, 执行 setupComponent , 还原slotOwner, 这期间测试性能 startMeasure
 
6.  作用域释放时，主动 unmount组件 。 
 onScopeDispose(() => unmountComponent(instance), true)

 为什么呢？












# 附录  

##  rawProps.$=[] 的设计感觉怪异

这个设计初看确实「怪」，但在 Vapor 的运行模型里，它是在解决几个硬约束，而不是为了炫技。

## 先分清两件事

| 机制 | 解决什么问题 |
|------|-------------|
| `rawProps.$ = [...]` | **props 从哪来、怎么合并、怎么保持响应式** |
| `new Proxy(this, attrsHandlers)` | **同一份 rawProps 如何拆成 props / attrs 两个 API** |

它们服务于不同层，但配合在一起工作。

---

## 为什么要有 `rawProps.$`

编译器会把模板里的 props 生成类似这样的结构（来自 `transformElement.spec.ts`）：

```js
// <Foo id="foo" v-bind="obj" class="bar" />
{
  id: "foo",
  $: [
    () => (_ctx.obj),
    { class: "bar" }
  ]
}
```

这不是随便起的字段，而是 Vapor **编译期 + 运行期统一的 props 协议**（`runtime-vapor` 里类型就叫 `DynamicPropsSource[]`）。

### 1. 合并顺序必须可控

`v-bind="obj"` 和静态 prop 谁先谁后，结果不同。用数组可以精确表达：

- 静态写在对象上：`id: "foo"`
- 动态块按顺序进 `$`：`[() => obj, { class: "bar" }]`
- 解析时**从后往前**扫（`while (i--)`），后面的覆盖前面 —— 和模板语义一致

如果一开始就 merge 成一个普通对象，要么丢顺序，要么每次改 prop 都要全量重算。

### 2. 懒求值 + 响应式

`$` 里的 `() => _ctx.obj` 不是创建时就算好，而是**访问时才 resolve**：

```37:58:e:\core\packages\pure-vapor\src\vapor\componentProps.js
export function resolveFunctionSource(source) {
  if (source._cache) {
    return source._cache.value
  }
  const parent = currentInstance && currentInstance.parent
  if (parent) {
    source._cache = computed(oldValue => {
      const prev = setCurrentInstance(parent)
      try {
        return stabilizeDynamicSourceValue(oldValue, source())
      } finally {
        setCurrentInstance(...prev)
      }
    })
    ...
  }
  return source()
}
```

好处：

- 父组件 `obj` 变了，子组件 props/attrs 自动跟着变
- 函数在**父组件上下文**里执行（`setCurrentInstance(parent)`）
- 用 `computed` 缓存，避免每次访问都重新 merge

### 3. fallthrough 可以「挂引用」而不是拷贝

第 111 行把 `() => parent.attrs` 推进子的 `rawProps.$`，本质是：

> 别拷贝一份 attrs 快照，而是让子组件在读 props 时**去父的 attrs 上查**。

这样 `App → Middle → HelloWorld` 多层透传不用每层手动 merge 一遍，也不会丢响应式。

### 4. 和 VDOM 的根本差异

VDOM 模式大致是：每次 render 重新生成 vnode，`updateProps` 把 props/attrs **写进 plain object**。

Vapor 是：**`createComponent`  largely 只跑一次**，后续靠 `renderEffect` 和 lazy source 更新。  
没有「每帧重建 props 对象」这一步，就必须有一个**持久的、可延迟解析的 props 容器** —— 这就是 `rawProps` + `$`。

---

## 为什么 `attrs` 是 `Proxy(实例)` 而不是普通对象

构造函数里：

```336:337:e:\core\packages\pure-vapor\src\vapor\component.js
      this.attrs = new Proxy(this, attrsHandlers)
      this.props = comp.props ? new Proxy(this, propsHandlers) : ...
```

### 1. 同一份 rawProps，两个视图

props 和 attrs 来自**同一套** `rawProps` + `$`，只是过滤规则不同：

- `props`：只暴露声明过的 prop
- `attrs`：非 prop、非 emit 的 remainder

用两个 Proxy 做**懒过滤**，不必维护两份要同步的对象。

### 2. 符合 Vue 3 使用方式

用户代码是：

```js
setup(props, { attrs }) {
  attrs.class   // 按 key 读
  'class' in attrs
  Object.keys(attrs)
}
```

Proxy 的 `get` / `has` / `ownKeys` trap 正好提供这套 API，还能保持 readonly（dev 下 set/delete 会 warn）。

### 3. fallthrough 链需要 attrs 当「动态 source」

`rawProps.$` 里存的是 `() => parent.attrs`。  
子组件解析时会对 source 做 `source[key]`、`for (key in source)`、`hasOwn(source, key)`。

parent.attrs 作为 Proxy，这些操作会走 trap，最终回到 `getAttrFromRawProps(parent.rawProps, key)` —— **天然就是正确的 attrs 视图**，不需要再包一层 plain object。

### 4. 调试器里「attrs 像 Instance」的原因

Proxy 的 target 就是 `this`，DevTools 展示 target 时会像实例 —— 这是 Proxy 的调试体验问题，不是语义错了。  
真正用法是 `attrs['some-attr']`，不是把 attrs 当 POJO 展开。

---

## 能不能改成更「普通」的实现？

可以，但通常是用复杂度换可读性，且要接受行为/性能 trade-off。

### 方案 A：创建时 merge 成 plain `{ class, style, ... }`

```js
this.attrs = { class: '...', 'data-x': 1 }
```

问题：

- fallthrough 多层要每层拷贝 + 监听父 attrs 变化
- `v-bind="obj"` 要额外 watch `obj` 再 merge
- `class` / `style` 跨层合并逻辑要单独写
- 和编译器生成的 `rawProps.$` 协议脱节，编译器/runtime 要一起改

### 方案 B：`Proxy(rawProps)` 而不是 `Proxy(instance)`

代码里其实已有 `rawPropsProxyHandlers`，理论上 attrs 可以包 rawProps：

```401:414:e:\core\packages\pure-vapor\src\vapor\componentProps.js
export const rawPropsProxyHandlers = {
  get: getAttrFromRawProps,
  has: hasAttrFromRawProps,
  ownKeys: getKeysFromRawProps,
  ...
}
```

但 props 解析还要 instance（default 工厂、`resolvePropValue` 等），最终 props/attrs 仍要共享一套 resolve 逻辑；改成两个 plain 对象反而要 duplicate 更多代码。  
`Proxy(instance)` 是让 props/attrs handler 都能拿到 `instance.rawProps` + `instance` 上下文的最短路径。

### 方案 C：去掉 `$`，全部用 getter 函数 props 对象

例如每个 key 都是 `() => value`。  
对 `v-bind="obj"`、fallthrough、静态/动态混排、emit 过滤都会更别扭，编译器 codegen 也要大改。

---

## 总结：是不是「非要这么设计」

在 **Vapor 当前架构**下，可以认为是的：

1. **编译器已经约定了 `rawProps.$`** —— 这是 Vapor props 的 IR/运行时协议，不是 runtime 随手写的
2. **组件不是每帧重建** —— 需要 lazy、可响应的 props 源，不能靠 VDOM 那套「每次 render 重写 attrs 对象」
3. **fallthrough / v-bind / class-style 合并 / 顺序覆盖** —— 都自然落在 `$` + Proxy resolve 这一条链上
4. **和 Vue 3 对外 API 兼容** —— `props.xxx`、`attrs.xxx`、`Object.keys(attrs)` 都要能用

如果目标是「调试时别像 Instance」，可以做的只是 **dev 工具层** 的改进（例如自定义 `inspect`、调试注释），不必动核心模型。

如果目标是「整体换成 plain object 模型」，那就是 **Vapor props 子系统 + 编译器 codegen 的架构级重写**，不是小 refactor；要重新解决响应式、fallthrough、合并顺序、性能（lazy vs eager merge）这一整套问题。

---

**一句话**：`rawProps.$` 是 Vapor 的「延迟、有序、可响应的 props 管道」；`Proxy(instance)` 是同一份管道上的 props/attrs 只读视图。怪主要来自 Proxy 的调试体验，以及和 VDOM「每帧 materialize props」的习惯不同 —— 但在 compile-once + effect-driven 的 Vapor 里，这套设计是有明确收益的。