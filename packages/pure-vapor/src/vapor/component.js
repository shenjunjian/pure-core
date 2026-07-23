import {
  EffectScope,
  markRaw,
  onScopeDispose,
  proxyRefs,
  setActiveSub,
  toRaw,
  unref,
} from '@vue/reactivity'
import {
  EMPTY_OBJ,
  hasOwn,
  invokeArrayFns,
  isArray,
  isFunction,
  isPromise,
  isString,
  ShapeFlags,
} from '@vue/shared'
import { ErrorCodes, callWithErrorHandling } from '../internal/errorHandling.js'
import { expose } from '../internal/component.js'
import { getFunctionalFallthrough } from '../internal/functionalFallthrough.js'
import { warnExtraneousAttributes } from '../internal/warning.js'
import { isAsyncWrapper } from '../internal/asyncComponent.js'
import { isKeepAlive } from '../internal/keepAlive.js'
import { getKeepAliveContext, isKeepAliveEnabled } from './keepAlive.js'
import { isTeleportEnabled, isVaporTeleport } from './teleport.js'
import { markAsyncBoundary } from '../internal/useId.js'
import { invalidateMount, queuePostFlushCb } from '../internal/scheduler.js'
import {
  resolveComponent,
  NULL_DYNAMIC_COMPONENT,
} from '../internal/resolveAssets.js'
import {
  currentInstance,
  restoreCurrentInstance,
  setCurrentInstance,
} from '../internal/instance.js'
import { isTransitionEnabled, isVaporTransition } from './transition.js'
import { setCurrentRenderingInstance } from '../internal/componentRenderContext.js'
import {
  pushWarningContext,
  popWarningContext,
  warn,
} from '../internal/warning.js'
import { startMeasure, endMeasure } from '../internal/profiling.js'
import { insert, isBlock, remove } from './block.js'
import {
  getKeysFromRawProps,
  getPropsProxyHandlers,
  hasFallthroughAttrs,
  normalizePropsOptions,
  resolveDynamicProps,
  setupPropsValidation,
  snapshotRawProps,
} from './componentProps.js'
import { renderEffect } from './renderEffect.js'
import { emit, normalizeEmitsOptions } from './componentEmits.js'
import { setDynamicProps } from './dom/prop.js'
import {
  dynamicSlotsProxyHandlers,
  getScopeOwner,
  getSlot,
  normalizeRawSlots,
  setCurrentSlotOwner,
} from './componentSlots.js'
import { createComment, createElement, createTextNode } from './dom/node.js'
import { DynamicFragment, isFragment } from './fragment.js'
import {
  insertionAnchor,
  insertionParent,
  resetInsertionState,
} from './insertionState.js'
import { setComponentScopeId, setScopeId } from './scopeId.js'
import { registerHMR, unregisterHMR } from '../internal/hmr.js'
import { hmrReload, hmrRerender } from './hmr.js'

export let isApplyingFallthroughProps = false

/** 创建组件实例
 * @param {any} component 组件定义或渲染函数
 * @param {any} rawProps 原始属性
 * @param {any} rawSlots 原始插槽
 * @param {boolean} isSingleRoot 组件是否是父模板 block 的唯一根级子节点， 用于把父级 fallthrough attrs 并入子组件 rawProps.$
 * @param {boolean} once 对应模板上的 v-once &&  v-if 也有 once
 * @param {any} appContext 应用上下文
 * @param {boolean} managedMount 是否由调用方负责挂载,为 true 时,不会在末尾自动 mountComponent——但 save/reset 模式不变，避免 setup 期间子节点误用外层 insertion 状态
 */
export function createComponent(
  component,
  rawProps,
  rawSlots,
  isSingleRoot,
  once,
  appContext,
  managedMount,
) {
  const _insertionParent = insertionParent
  const _insertionAnchor = insertionAnchor
  resetInsertionState()

  if (appContext == null) {
    appContext = (currentInstance && currentInstance.appContext) || emptyContext
  }

  // 单根结点的组件时，需要继承父级 fallthrough attrs.
  if (
    isSingleRoot &&
    component.inheritAttrs !== false &&
    isVaporComponent(currentInstance) &&
    currentInstance.hasFallthrough // 是否存在未声明为 prop 的属性, 需要我传递给子组件的attrs
  ) {
    // 故意把 父组件的 attrs Proxy 放进子组件的 rawProps.$
    // 子组件后续通过 getAttrFromRawProps / resolveFunctionSource 解析 $ 时，会拿到这个 Proxy，再通过 Proxy 的 get / ownKeys / has trap 读出真正的 attr 值
    const attrs = currentInstance.attrs
    if (rawProps && rawProps !== EMPTY_OBJ) {
      const dynamic = rawProps.$ || (rawProps.$ = [])
      dynamic.push(() => attrs)
    } else {
      rawProps = { $: [() => attrs] }
    }
  }

  // TODO: 待分析
  if (
    isKeepAliveEnabled &&
    currentInstance &&
    currentInstance.vapor &&
    isKeepAlive(currentInstance)
  ) {
    const cached = currentInstance.ctx.getCachedComponent(component)
    if (cached) return cached
  }
  // TODO: 待分析
  if (isTeleportEnabled && isVaporTeleport(component)) {
    const frag = component.process(rawProps, normalizeRawSlots(rawSlots))
    if (_insertionParent) {
      onScopeDispose(() => frag.dispose(), true)
    }
    if (_insertionParent) insert(frag, _insertionParent, _insertionAnchor)
    return frag
  }

  const instance = new VaporComponentInstance(
    component,
    rawProps,
    rawSlots,
    appContext,
    once,
  )

  // TODO: 待分析
  if (isKeepAliveEnabled) {
    const keepAliveCtx = getKeepAliveContext(currentInstance)
    if (keepAliveCtx && !isAsyncWrapper(instance)) {
      keepAliveCtx.processShapeFlag(instance)
    }
  }

  // reset currentSlotOwner to null to avoid affecting the child components
  const prevSlotOwner = setCurrentSlotOwner(null)
  let hasWarningContext = false
  let hasInitMeasure = false
  try {
    if (__DEV__) {
      registerHMR(instance)
      instance.isSingleRoot = isSingleRoot
      instance.hmrRerender = hmrRerender.bind(null, instance)
      instance.hmrReload = hmrReload.bind(null, instance)
      pushWarningContext(instance)
      hasWarningContext = true
      startMeasure(instance, `init`)
      hasInitMeasure = true
      instance.propsOptions = normalizePropsOptions(component)
      instance.emitsOptions = normalizeEmitsOptions(component)
    }

    setupComponent(instance, component)
  } finally {
    if (__DEV__) {
      if (hasWarningContext) {
        popWarningContext()
      }
      if (hasInitMeasure) {
        endMeasure(instance, 'init')
      }
    }
    setCurrentSlotOwner(prevSlotOwner)
  }
  onScopeDispose(() => unmountComponent(instance), true)

  if (!managedMount && _insertionParent) {
    mountComponent(instance, _insertionParent, _insertionAnchor)
  }

  return instance
}
/** 组件的setup周期  setupPropsValidation -> 执行setup函数 -> handleSetupResult */
export function setupComponent(instance, component) {
  const prevInstance = setCurrentInstance(instance)
  const prevSub = setActiveSub()

  if (__DEV__) {
    setupPropsValidation(instance)
  }

  const setupFn = isFunction(component) ? component : component.setup
  const setupResult = setupFn
    ? callWithErrorHandling(setupFn, instance, ErrorCodes.SETUP_FUNCTION, [
        instance.props,
        instance,
      ]) || EMPTY_OBJ
    : EMPTY_OBJ

  const isAsyncSetup = isPromise(setupResult)

  if ((isAsyncSetup || instance.sp) && !isAsyncWrapper(instance)) {
    markAsyncBoundary(instance)
  }

  // TODO: 暂不支持异步setup
  if (isAsyncSetup) {
    if (__DEV__) {
      warn(
        `setup() returned a Promise, but the version of Vue you are using ` +
          `does not support it yet.`,
      )
    }
  } else {
    handleSetupResult(setupResult, component, instance)
  }

  setActiveSub(prevSub)
  restoreCurrentInstance(prevInstance)
}

export function shouldUseFunctionalFallthrough(component) {
  return (
    isFunction(component) &&
    !(isTransitionEnabled && isVaporTransition(component))
  )
}

export function applyFallthroughProps(el, attrs) {
  isApplyingFallthroughProps = true
  try {
    setDynamicProps(el, [attrs])
  } finally {
    isApplyingFallthroughProps = false
  }
}

function createDevSetupStateProxy(instance) {
  const setupState = instance.setupState
  return new Proxy(setupState, {
    get(target, key, receiver) {
      if (
        isString(key) &&
        !key.startsWith('__v') &&
        !hasOwn(toRaw(setupState), key)
      ) {
        warn(
          `Property ${JSON.stringify(key)} was accessed during render ` +
            `but is not defined on instance.`,
        )
      }

      return Reflect.get(target, key, receiver)
    },
  })
}

function callRender(render, instance, setupState) {
  return callWithErrorHandling(render, instance, ErrorCodes.RENDER_FUNCTION, [
    setupState,
    instance.props,
    instance.emit,
    instance.attrs,
    instance.slots,
  ])
}

/** 开发时，渲染组件
 * 1. 设置当前渲染实例
 * 2. 调用 render 函数， 如果 render 函数存在，则调用 callRender 函数，否则调用 callWithErrorHandling 函数。
 * 3. 设置当前渲染实例
 * 4. 返回 block
 */
export function devRender(instance) {
  const prev = setCurrentRenderingInstance(instance)
  try {
    instance.block =
      (instance.type.render
        ? callRender(instance.type.render, instance, instance.setupState)
        : callWithErrorHandling(
            isFunction(instance.type) ? instance.type : instance.type.setup,
            instance,
            ErrorCodes.SETUP_FUNCTION,
            [
              instance.props,
              {
                slots: instance.slots,
                attrs: instance.attrs,
                emit: instance.emit,
                expose: instance.expose,
              },
            ],
          )) || []
  } finally {
    setCurrentRenderingInstance(prev)
  }
}

export const emptyContext = {
  app: null,
  config: {},
  provides: /*@__PURE__*/ Object.create(null),
}

let uid = 0
/** 组件实例类， 通过 currentInstance 是否存在，判断是root还是子组件 */
export class VaporComponentInstance {
  constructor(comp, rawProps, rawSlots, appContext, once) {
    this.vapor = true
    this.uid = uid++
    this.type = comp
    this.parent = currentInstance

    if (currentInstance) {
      this.root = currentInstance.root
      this.appContext = currentInstance.appContext
      this.provides = currentInstance.provides
      this.ids = currentInstance.ids
    } else {
      this.root = this
      this.appContext = appContext || emptyContext
      this.provides = Object.create(this.appContext.provides)
      this.ids = ['', 0, 0]
    }

    this.block = null
    this.scope = new EffectScope(true)

    this.emit = emit.bind(null, this)
    this.expose = expose.bind(null, this)
    this.refs = EMPTY_OBJ
    this.emitted = this.exposed = this.exposeProxy = this.propsDefaults = null

    this.isMounted =
      this.isUnmounted =
      this.isUpdating =
      this.isDeactivated =
        false
    this.effectCount = 0
    this.isOnce = !!once

    this.rawProps =
      this.isOnce && rawProps
        ? snapshotRawProps(rawProps)
        : rawProps || EMPTY_OBJ
    this.hasFallthrough = hasFallthroughAttrs(comp, this.rawProps)
    if (rawProps || comp.props) {
      const handlers = getPropsProxyHandlers(comp)
      const propsHandlers = handlers[0]
      const attrsHandlers = handlers[1]
      this.attrs = new Proxy(this, attrsHandlers)
      this.props = comp.props
        ? new Proxy(this, propsHandlers)
        : isFunction(comp)
          ? this.attrs
          : EMPTY_OBJ
    } else {
      this.props = this.attrs = EMPTY_OBJ
    }

    const normalizedRawSlots = normalizeRawSlots(rawSlots)
    this.rawSlots = normalizedRawSlots || EMPTY_OBJ
    this.slots = normalizedRawSlots
      ? normalizedRawSlots.$
        ? new Proxy(normalizedRawSlots, dynamicSlotsProxyHandlers)
        : normalizedRawSlots
      : EMPTY_OBJ

    // root 组件时为undefined.
    // Middle, hellowrold组件都有scopeId, 但创建时，middle的scopeId为undefined，hellowrold的scopeId为parent的scopeId
    this.scopeId = getCurrentScopeId()

    if (comp.ce) {
      comp.ce(this)
    }

    if (__DEV__) {
      if (this.props === this.attrs) {
        this.accessedAttrs = true // root 组件时为true
      } else {
        const attrs = this.attrs
        const instance = this
        this.attrs = new Proxy(attrs, {
          get(target, key, receiver) {
            instance.accessedAttrs = true
            return Reflect.get(target, key, receiver)
          },
        })
      }
    }
  }

  rawKeys() {
    return getKeysFromRawProps(this.rawProps)
  }
}

export function isVaporComponent(value) {
  return value instanceof VaporComponentInstance
}

/**
 * 按组件名解析资产组件，再交给 createComponentWithFallback 分发。
 * 编译器在「根 block 内仅使用一次」的静态组件标签上会生成此调用（内联字符串名）；
 * 若直接把字符串传给 createComponentWithFallback，会被当作原生/自定义元素标签而非组件名。
 * @param {string} name 模板中的组件名（如 "MyComp"）
 * @param {boolean} [maybeSelfReference] 为 true 时允许解析为当前组件自身（Foo__self）
 */
export function createAssetComponent(
  name,
  rawProps,
  rawSlots,
  isSingleRoot,
  once,
  maybeSelfReference,
  appContext,
) {
  return createComponentWithFallback(
    resolveComponent(name, maybeSelfReference),
    rawProps,
    rawSlots,
    isSingleRoot,
    once,
    appContext,
  )
}

/**
 * 根据已解析的 comp 创建组件或退化为普通元素。
 * comp 来自 resolveComponent / resolveDynamicComponent 或编译期 hoist 的 _component_X。
 * - NULL_DYNAMIC_COMPONENT：动态组件解析为空，渲染占位节点
 * - 非 string：已解析为组件定义，走 createComponent
 * - string：注册表未命中（resolveComponent 回退为原名），按标签名创建 DOM（原生标签或 custom element）
 */
export function createComponentWithFallback(
  comp,
  rawProps,
  rawSlots,
  isSingleRoot,
  once,
  appContext,
) {
  if (comp === NULL_DYNAMIC_COMPONENT) {
    return __DEV__ ? createComment('ndc') : createTextNode('')
  }

  if (!isString(comp)) {
    return createComponent(
      comp,
      rawProps,
      rawSlots,
      isSingleRoot,
      once,
      appContext,
    )
  }

  return createPlainElement(comp, rawProps, rawSlots, isSingleRoot, once)
}

/**
 * 用 document.createElement 创建真实 DOM 元素（非 Vapor 组件实例）。
 * 编译器在 isCustomElement、原生 <template>，或 createComponentWithFallback 解析失败时生成。
 * @param {string} comp 标签名（如 "my-el"、"template"）
 * @param {boolean} [isSingleRoot] 是否为父 block 唯一根（$root，供 fallthrough 等使用）
 * @param {boolean} [once] 为 true 时 props 只应用一次（v-once）
 * @returns {HTMLElement}
 */
export function createPlainElement(
  comp,
  rawProps,
  rawSlots,
  isSingleRoot,
  once,
) {
  // 与 createComponent 相同：保存外层 insertion，清空后创建子内容，最后挂回
  const _insertionParent = insertionParent
  const _insertionAnchor = insertionAnchor
  resetInsertionState()

  rawSlots = normalizeRawSlots(rawSlots)
  const defaultSlot = rawSlots && getSlot(rawSlots, 'default')
  const hasDynamicSlots = !!(rawSlots && rawSlots.$)
  const el = createElement(comp)

  el.$root = isSingleRoot

  const scopeId = getCurrentScopeId()
  if (scopeId) setScopeId(el, [scopeId])

  if (rawProps) {
    const setFn = () => setDynamicProps(el, [resolveDynamicProps(rawProps)])
    if (once) setFn()
    else renderEffect(setFn)
  }

  if (rawSlots) {
    if (rawSlots.$) {
      // 动态 default 插槽（v-if / v-for 等）：子树随 slot 函数变化
      const frag = new DynamicFragment(__DEV__ ? 'slot' : undefined)
      renderEffect(() => frag.update(getSlot(rawSlots, 'default')))
      insert(frag, el)
    } else {
      // 静态 default 插槽：编译期固定的 slot 函数，执行一次得到 block
      const slot = getSlot(rawSlots, 'default')
      if (slot) {
        const block = slot()
        insert(block, el)
      }
    }
  }

  if (_insertionParent) insert(el, _insertionParent, _insertionAnchor)

  return el
}

export function mountComponent(instance, parent, anchor) {
  if (
    isKeepAliveEnabled &&
    instance.shapeFlag & ShapeFlags.COMPONENT_KEPT_ALIVE
  ) {
    instance.parent.ctx.activate(instance, parent, anchor)
    return
  }

  if (__DEV__) {
    startMeasure(instance, `mount`)
  }
  if (instance.bm) invokeArrayFns(instance.bm)
  insert(instance.block, parent, anchor)

  setComponentScopeId(instance)
  if (instance.m) queuePostFlushCb(instance.m)
  if (
    isKeepAliveEnabled &&
    instance.shapeFlag & ShapeFlags.COMPONENT_SHOULD_KEEP_ALIVE &&
    instance.a
  ) {
    queuePostFlushCb(instance.a)
  }
  instance.isMounted = true
  if (__DEV__) {
    endMeasure(instance, `mount`)
  }
}

export function unmountComponent(instance, parentNode) {
  if (!instance) {
    return
  }
  if (
    isKeepAliveEnabled &&
    instance.shapeFlag & ShapeFlags.COMPONENT_SHOULD_KEEP_ALIVE &&
    instance.parent &&
    instance.parent.vapor &&
    instance.parent.ctx
  ) {
    if (parentNode) {
      instance.parent.ctx.deactivate(instance)
    }
    return
  }

  if (instance.isMounted && !instance.isUnmounted) {
    if (__DEV__) {
      unregisterHMR(instance)
    }
    invalidateMount(instance.m)
    invalidateMount(instance.a)
    if (instance.bum) {
      invokeArrayFns(instance.bum)
    }

    instance.scope.stop()

    if (instance.um) {
      queuePostFlushCb(instance.um)
    }
    instance.isUnmounted = true
  }

  if (parentNode) {
    remove(instance.block, parentNode)
  }
}

export function getExposed(instance) {
  if (instance.exposed) {
    return (
      instance.exposeProxy ||
      (instance.exposeProxy = new Proxy(markRaw(instance.exposed), {
        get: (target, key) => unref(target[key]),
      }))
    )
  }
}

export function getRootElement(block, onDynamicFragment, recurse) {
  if (recurse == null) recurse = true

  if (block instanceof Element) {
    return block
  }

  if (recurse && isVaporComponent(block)) {
    return getRootElement(block.block, onDynamicFragment, recurse)
  }

  if (isFragment(block)) {
    if (block instanceof DynamicFragment && onDynamicFragment) {
      onDynamicFragment(block)
    }
    const nodes = block.nodes
    if (nodes instanceof Element && nodes.$root) {
      return nodes
    }
    return getRootElement(nodes, onDynamicFragment, recurse)
  }

  if (isArray(block)) {
    let singleRoot
    let hasComment = false
    for (let i = 0; i < block.length; i++) {
      const b = block[i]
      if (b instanceof Comment) {
        hasComment = true
        continue
      }
      const thisRoot = getRootElement(b, onDynamicFragment, recurse)
      if (!thisRoot || singleRoot) {
        return
      }
      singleRoot = thisRoot
    }
    return hasComment ? singleRoot : undefined
  }
}

function handleSetupResult(setupResult, component, instance) {
  if (__DEV__) {
    // Suspense 异步路径， setup resovle之后会再单独调用 handleSetupResult， 所以这里push一次。
    // 无异步功能的话，这里多余的。
    pushWarningContext(instance)
  }

  if (!isBlock(setupResult)) {
    if (isFunction(component)) {
      if (__DEV__) {
        warn(`Functional vapor component must return a block directly.`)
      }
      instance.block = []
    } else if (!component.render) {
      if (__DEV__) {
        warn(
          `Vapor component setup() returned non-block value, and has no render function.`,
        )
      }
      // setup either threw or returned a non-block value: fall back to an
      // empty block so mount / unmount can proceed and the error can
      // propagate to parent error boundaries
      instance.block = []
    } else {
      if (__DEV__ || __FEATURE_PROD_DEVTOOLS__) {
        instance.devtoolsRawSetupState = setupResult
      }
      if (__DEV__) {
        instance.setupState = proxyRefs(setupResult)
        instance.setupState = createDevSetupStateProxy(instance)
        devRender(instance)
      } else {
        // component has a render function but no setup function
        // (typically components with only a template and no state)
        instance.block =
          callRender(component.render, instance, setupResult) || []
      }
    }
  } else {
    instance.block = setupResult
  }

  // 如果有额外的属性，则需要应用到根元素上。
  if (
    instance.hasFallthrough &&
    component.inheritAttrs !== false &&
    Object.keys(instance.attrs).length
  ) {
    // helloworld组件，这里返回的undefined
    const root = getRootElement(
      instance.block,
      frag => {
        frag.attrs = instance.attrs
      },
      false,
    )
    if (root) {
      renderEffect(() => {
        const attrs = shouldUseFunctionalFallthrough(component)
          ? getFunctionalFallthrough(instance.attrs)
          : instance.attrs
        if (attrs) applyFallthroughProps(root, attrs)
      })
    } else if (
      __DEV__ &&
      !instance.accessedAttrs &&
      isArray(instance.block) &&
      instance.block.length
    ) {
      warnExtraneousAttributes(instance.attrs)
    }
  }

  if (__DEV__) {
    popWarningContext()
  }
}

/** 创建该实例时外层的 scope 快照
 * 外层是：slotOwner或currentInstance
 */
export function getCurrentScopeId() {
  const scopeOwner = getScopeOwner()
  return scopeOwner ? scopeOwner.type.__scopeId : undefined
}
