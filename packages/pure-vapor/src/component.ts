import { EffectScope, onScopeDispose, proxyRefs } from '@vue/reactivity'
import {
  EMPTY_OBJ,
  invokeArrayFns,
  isBuiltInTag,
  isFunction,
  isPromise,
} from '@vue/shared'
import type {
  AppConfig,
  AppContext,
  Block,
  LifecycleHook,
  VaporComponent,
} from './types'
import { insert, isBlock, remove } from './block'
import { currentInstance, setCurrentInstance } from './renderEffect'
import { warn } from './warning'

// @internal
let uid = 0

/**
 * @internal
 */
export function expose(
  instance: VaporComponentInstance,
  exposed: Record<string, any>,
): void {
  instance.exposed = exposed || {}
}
export const emptyContext: AppContext = {
  app: null as any,
  config: {},
  provides: /*@__PURE__*/ Object.create(null),
}

export function createComponent(
  component: VaporComponent,
  rawProps?: any,
  rawSlots?: any,
  appContext?: emptyContext,
): VaporComponentInstance {
  const instance = new VaporComponentInstance(
    component,
    rawProps,
    rawSlots,
    appContext,
  )

  setupComponent(instance, component)

  return instance
}

// 执行setup
export function setupComponent(
  instance: VaporComponentInstance,
  component: VaporComponent,
): void {
  const prevInstance = setCurrentInstance(instance)

  const setupFn = component.setup
  const setupResult = setupFn
    ? setupFn(instance.props, {
        slots: instance.slots,
        attrs: instance.attrs,
        emit: instance.emit,
        expose: instance.expose,
      }) || EMPTY_OBJ
    : EMPTY_OBJ

  // const isAsyncSetup = isPromise(setupResult)

  // if (isAsyncSetup) {
  //   // For simplicity, we'll skip async setup handling for now
  //   instance.block = []
  // } else {
  handleSetupResult(setupResult, component, instance)
  // }

  setCurrentInstance(prevInstance)
  onScopeDispose(() => unmountComponent(instance), true)
}

// 把setup的结果 保存到 setupState属性, 并调用 render 函数，保存到block属性
function handleSetupResult(
  setupResult: any,
  component: VaporComponent,
  instance: VaporComponentInstance,
) {
  if (isBlock(setupResult)) {
    instance.block = setupResult
  } else if (component.render) {
    instance.setupState = proxyRefs(setupResult)
    instance.block =
      component.render(
        instance.setupState,
        instance.props,
        instance.emit,
        instance.attrs,
        instance.slots,
      ) || []
  } else {
    instance.block = []
  }
}
export function mountComponent(
  instance: VaporComponentInstance,
  parent: ParentNode,
  anchor?: Node | null,
): void {
  if (instance.bm) invokeArrayFns(instance.bm)
  insert(instance.block, parent, anchor)
  if (instance.m) queuePostFlushCb(instance.m)
  instance.isMounted = true
}

export function unmountComponent(
  instance: VaporComponentInstance,
  parentNode?: ParentNode,
): void {
  if (instance.isMounted && !instance.isUnmounted) {
    if (instance.bum) invokeArrayFns(instance.bum)
    instance.scope.stop()
    if (instance.um) invokeArrayFns(instance.um)
    instance.isUnmounted = true
  }

  if (parentNode) {
    remove(instance.block, parentNode)
  }
}

export function getExposed(
  instance: VaporComponentInstance,
): Record<string, any> | undefined {
  if (instance.exposed) {
    return (
      instance.exposeProxy ||
      (instance.exposeProxy = new Proxy(instance.exposed, {
        get: (target, key) => target[key],
      }))
    )
  }
}

/**
 * @internal
 */
export function validateComponentName(
  name: string,
  { isNativeTag }: AppConfig,
): void {
  if (isBuiltInTag(name) || isNativeTag(name)) {
    warn(
      'Do not use built-in or reserved HTML elements as component id: ' + name,
    )
  }
}

// Vapor Component Instance
export class VaporComponentInstance {
  vapor = true
  uid: number
  type: VaporComponent
  root: VaporComponentInstance | null
  parent: VaporComponentInstance | null
  appContext: AppContext

  block: Block
  scope: EffectScope

  rawProps: RawProps
  rawSlots: RawSlots

  props: Readonly<any>
  attrs: Record<string, any>
  propsDefaults: Record<string, any> | null

  slots: StaticSlots

  scopeId?: string | null

  // to hold vnode props / slots in vdom interop mode
  rawPropsRef?: ShallowRef<any>
  rawSlotsRef?: ShallowRef<any>

  emit: EmitFn<Emits>
  emitted: Record<string, boolean> | null

  expose: (<T extends Record<string, any>>(exposed: T) => void) & string[]
  exposed: Record<string, any> | null
  exposeProxy: any | null

  // for useTemplateRef()
  refs: TypeRefs
  // for provide / inject
  provides: Record<string, any>
  // for useId
  ids: [string, number, number]
  // for suspense
  suspense: SuspenseBoundary | null
  suspenseId: number
  asyncDep: Promise<any> | null
  asyncResolved: boolean

  // for vapor custom element
  renderEffects?: RenderEffect[]

  hasFallthrough: boolean

  // for keep-alive
  shapeFlag?: number
  $key?: any

  // for v-once: caches props/attrs values to ensure they remain frozen
  // even when the component re-renders due to local state changes
  oncePropsCache?: Record<string | symbol, any>

  // lifecycle hooks
  isMounted: boolean
  isUnmounted: boolean
  isDeactivated: boolean
  isUpdating: boolean

  bc?: LifecycleHook // LifecycleHooks.BEFORE_CREATE
  c?: LifecycleHook // LifecycleHooks.CREATED
  bm?: LifecycleHook // LifecycleHooks.BEFORE_MOUNT
  m?: LifecycleHook // LifecycleHooks.MOUNTED
  bu?: LifecycleHook // LifecycleHooks.BEFORE_UPDATE
  u?: LifecycleHook // LifecycleHooks.UPDATED
  um?: LifecycleHook // LifecycleHooks.BEFORE_UNMOUNT
  bum?: LifecycleHook // LifecycleHooks.UNMOUNTED
  da?: LifecycleHook // LifecycleHooks.DEACTIVATED
  a?: LifecycleHook // LifecycleHooks.ACTIVATED
  rtg?: LifecycleHook // LifecycleHooks.RENDER_TRACKED
  rtc?: LifecycleHook // LifecycleHooks.RENDER_TRIGGERED
  ec?: LifecycleHook // LifecycleHooks.ERROR_CAPTURED
  sp?: LifecycleHook<() => Promise<unknown>> // LifecycleHooks.SERVER_PREFETCH

  // dev only
  setupState?: Exposed extends Block ? undefined : ShallowUnwrapRef<Exposed>
  devtoolsRawSetupState?: any
  hmrRerender?: () => void
  hmrReload?: (newComp: VaporComponent) => void
  parentTeleport?: TeleportFragment | null
  propsOptions?: NormalizedPropsOptions
  emitsOptions?: ObjectEmitsOptions | null
  isSingleRoot?: boolean

  /**
   * dev only flag to track whether $attrs was used during render.
   * If $attrs was used during render then the warning for failed attrs
   * fallthrough can be suppressed.
   */
  accessedAttrs: boolean = false

  // type only
  /**
   * @deprecated only used for JSX to detect props types.
   */
  // @ts-expect-error
  $props: Props

  constructor(
    comp: VaporComponent,
    rawProps?: RawProps | null,
    rawSlots?: RawSlots | null,
    appContext?: AppContext,
  ) {
    this.expose = expose.bind(null, this)
    this.uid = uid++
    this.type = comp
    this.parent = currentInstance

    if (currentInstance) {
      // 其它任意组件的加载
      this.root = currentInstance.root
      this.appContext = currentInstance.appContext
      this.provides = currentInstance.provides
      // this.ids = currentInstance.ids
    } else {
      // 证明是在app加载
      this.root = this
      this.appContext = appContext || emptyContext
      this.provides = Object.create(this.appContext.provides)
      // this.ids = ['', 0, 0]
    }

    this.block = null! // to be set
    this.scope = new EffectScope(true)

    // this.emit = emit.bind(null, this) as EmitFn<Emits>
    this.expose = expose.bind(null, this) as any
    this.refs = EMPTY_OBJ as TypeRefs
    this.emitted = this.exposed = this.exposeProxy = this.propsDefaults = null

    // suspense related
    // this.suspense = parentSuspense
    // this.suspenseId = parentSuspense ? parentSuspense.pendingId : 0
    // this.asyncDep = null
    // this.asyncResolved = false

    this.isMounted =
      this.isUnmounted =
      this.isUpdating =
      this.isDeactivated =
        false

    // init props
    // this.rawProps = rawProps || EMPTY_OBJ
    // // this.hasFallthrough = hasFallthroughAttrs(comp, rawProps)
    // if (rawProps || comp.props) {
    //   const [propsHandlers, attrsHandlers] = getPropsProxyHandlers(comp, once)
    //   this.attrs = new Proxy(this, attrsHandlers)
    //   this.props = (
    //     comp.props
    //       ? new Proxy(this, propsHandlers!)
    //       : isFunction(comp)
    //         ? this.attrs
    //         : EMPTY_OBJ
    //   ) as Props
    // } else {
    //   this.props = this.attrs = EMPTY_OBJ as Props
    // }

    // init slots
    // this.rawSlots = rawSlots || EMPTY_OBJ
    // this.slots = (
    //   rawSlots
    //     ? rawSlots.$
    //       ? new Proxy(rawSlots, dynamicSlotsProxyHandlers)
    //       : rawSlots
    //     : EMPTY_OBJ
    // ) as Slots

    // this.scopeId = getCurrentScopeId()
  }
}
