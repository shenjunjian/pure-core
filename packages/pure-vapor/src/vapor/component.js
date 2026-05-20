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
} from '@vue/shared'
import { ErrorCodes, callWithErrorHandling } from '../internal/errorHandling.js'
import { expose, nextUid, getComponentName } from '../internal/component.js'
import { getFunctionalFallthrough } from '../internal/functionalFallthrough.js'
import { warnExtraneousAttributes } from '../internal/warning.js'
import { isAsyncWrapper } from '../internal/asyncComponent.js'
import { markAsyncBoundary } from '../internal/useId.js'
import { invalidateMount, queuePostFlushCb } from '../internal/scheduler.js'
import {
  resolveComponent,
  NULL_DYNAMIC_COMPONENT,
} from '../internal/resolveAssets.js'
import { currentInstance, setCurrentInstance } from '../internal/instance.js'
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
} from './componentProps.js'
import { renderEffect } from './renderEffect.js'
import { emit, normalizeEmitsOptions } from './componentEmits.js'
import { setDynamicProps } from './dom/prop.js'
import {
  dynamicSlotsProxyHandlers,
  getScopeOwner,
  getSlot,
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

export let isApplyingFallthroughProps = false

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

  if (
    isSingleRoot &&
    component.inheritAttrs !== false &&
    isVaporComponent(currentInstance) &&
    currentInstance.hasFallthrough
  ) {
    const attrs = currentInstance.attrs
    if (rawProps && rawProps !== EMPTY_OBJ) {
      const dynamic = rawProps.$ || (rawProps.$ = [])
      dynamic.push(() => attrs)
    } else {
      rawProps = { $: [() => attrs] }
    }
  }

  const instance = new VaporComponentInstance(
    component,
    rawProps,
    rawSlots,
    appContext,
    once,
  )

  const prevSlotOwner = setCurrentSlotOwner(null)
  let hasWarningContext = false
  let hasInitMeasure = false
  try {
    if (__DEV__) {
      instance.isSingleRoot = isSingleRoot
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
  setCurrentInstance(...prevInstance)
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

export class VaporComponentInstance {
  constructor(comp, rawProps, rawSlots, appContext, once) {
    this.vapor = true
    this.uid = nextUid()
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

    this.rawProps = rawProps || EMPTY_OBJ
    this.hasFallthrough = hasFallthroughAttrs(comp, rawProps)
    if (rawProps || comp.props) {
      const handlers = getPropsProxyHandlers(comp, once)
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

    this.rawSlots = rawSlots || EMPTY_OBJ
    this.slots = rawSlots
      ? rawSlots.$
        ? new Proxy(rawSlots, dynamicSlotsProxyHandlers)
        : rawSlots
      : EMPTY_OBJ

    this.scopeId = getCurrentScopeId()

    if (comp.ce) {
      comp.ce(this)
    }

    if (__DEV__) {
      if (this.props === this.attrs) {
        this.accessedAttrs = true
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

export function createPlainElement(
  comp,
  rawProps,
  rawSlots,
  isSingleRoot,
  once,
) {
  const _insertionParent = insertionParent
  const _insertionAnchor = insertionAnchor
  resetInsertionState()

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
      const frag = new DynamicFragment(__DEV__ ? 'slot' : undefined)
      renderEffect(() => frag.update(getSlot(rawSlots, 'default')))
      insert(frag, el)
    } else {
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
  if (__DEV__) {
    startMeasure(instance, `mount`)
  }
  if (instance.bm) invokeArrayFns(instance.bm)
  insert(instance.block, parent, anchor)
  setComponentScopeId(instance)
  if (instance.m) queuePostFlushCb(instance.m)
  instance.isMounted = true
  if (__DEV__) {
    endMeasure(instance, `mount`)
  }
}

export function unmountComponent(instance, parentNode) {
  if (instance.isMounted && !instance.isUnmounted) {
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
    pushWarningContext(instance)
  }

  if (__DEV__ && !isBlock(setupResult)) {
    if (isFunction(component)) {
      warn(`Functional vapor component must return a block directly.`)
      instance.block = []
    } else if (!component.render) {
      warn(
        `Vapor component setup() returned non-block value, and has no render function.`,
      )
      instance.block = []
    } else {
      instance.devtoolsRawSetupState = setupResult
      instance.setupState = proxyRefs(setupResult)
      if (__DEV__) {
        instance.setupState = createDevSetupStateProxy(instance)
      }
      devRender(instance)
    }
  } else {
    if (setupResult === EMPTY_OBJ && component.render) {
      instance.block = callRender(component.render, instance, setupResult)
    } else {
      instance.block = setupResult
    }
  }

  if (
    instance.hasFallthrough &&
    component.inheritAttrs !== false &&
    Object.keys(instance.attrs).length
  ) {
    const root = getRootElement(
      instance.block,
      frag => {
        frag.attrs = instance.attrs
      },
      false,
    )
    if (root) {
      renderEffect(() => {
        const attrs = isFunction(component)
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

export function getCurrentScopeId() {
  const scopeOwner = getScopeOwner()
  return scopeOwner ? scopeOwner.type.__scopeId : undefined
}
