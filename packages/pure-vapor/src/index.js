/**
 * pure-vapor public entry.
 * Export surface aligned with vue/index-with-vapor (minus exclusion table).
 * See .cursor/plans/pure-vapor_纯运行时_8015eb3b.plan.md — 导出契约
 */

// ---------------------------------------------------------------------------
// A. @vue/reactivity — re-export (runtime-core parity)
// ---------------------------------------------------------------------------

export {
  reactive,
  ref,
  readonly,
  unref,
  proxyRefs,
  isRef,
  toRef,
  toValue,
  toRefs,
  isProxy,
  isReactive,
  isReadonly,
  isShallow,
  customRef,
  triggerRef,
  shallowRef,
  shallowReactive,
  shallowReadonly,
  markRaw,
  toRaw,
  effect,
  stop,
  getCurrentWatcher,
  onWatcherCleanup,
  ReactiveEffect,
  effectScope,
  EffectScope,
  getCurrentScope,
  onScopeDispose,
  computed,
} from '@vue/reactivity'

// ---------------------------------------------------------------------------
// @vue/shared — re-export (runtime-core / compiler subset)
// ---------------------------------------------------------------------------

export {
  camelize,
  capitalize,
  hyphenate,
  toHandlerKey,
  toDisplayString,
  normalizeProps,
  normalizeClass,
  normalizeStyle,
} from '@vue/shared'

// ---------------------------------------------------------------------------
// B. runtime-core subset — internal/
// ---------------------------------------------------------------------------

export const version = __VERSION__

export {
  nextTick,
  queueJob,
  queuePostFlushCb,
  flushOnAppMount,
  SchedulerJobFlags,
} from './internal/scheduler.js'

export {
  getCurrentInstance,
  currentInstance,
  setCurrentInstance,
} from './internal/instance.js'

export {
  onBeforeMount,
  onMounted,
  onBeforeUpdate,
  onUpdated,
  onBeforeUnmount,
  onUnmounted,
  onActivated,
  onDeactivated,
  onRenderTracked,
  onRenderTriggered,
  onErrorCaptured,
} from './internal/lifecycle.js'

export {
  resolveComponent,
  resolveDirective,
  resolveDynamicComponent,
  NULL_DYNAMIC_COMPONENT,
} from './internal/resolveAssets.js'

export {
  createAppAPI,
  createAppContext,
  normalizeContainer,
} from './internal/app.js'

export { initFeatureFlags } from './internal/featureFlags.js'

export {
  callWithErrorHandling,
  callWithAsyncErrorHandling,
  handleError,
  ErrorCodes,
} from './internal/errorHandling.js'

export {
  baseNormalizePropsOptions,
  resolvePropValue,
  validateProps,
  baseResolveDefault,
} from './internal/props.js'

export { baseEmit, defaultPropGetter, isEmitListener } from './internal/emit.js'

export { getInheritedScopeIds } from './internal/scopeId.js'

export {
  getComponentName,
  formatComponentName,
  nextUid,
  expose,
  getComponentPublicInstance,
} from './internal/component.js'

export {
  warn,
  pushWarningContext,
  popWarningContext,
} from './internal/warning.js'

export { startMeasure, endMeasure } from './internal/profiling.js'

// watch / inject — stubs until apiWatch / apiInject are wired
export function watch() {
  return NOOP_WATCH
}
export function watchEffect() {}
export function watchPostEffect() {}
export function watchSyncEffect() {}

export function provide() {}
export function inject() {
  return undefined
}
export function hasInjectionContext() {
  return false
}

export function useAttrs() {
  return {}
}
export function useSlots() {
  return {}
}
export function useModel() {
  return []
}
export function useTemplateRef() {
  return { value: null }
}
export function useId() {
  return ''
}
export function useCssModule() {
  return {}
}

export function defineProps() {
  return {}
}
export function defineEmits() {
  return () => {}
}
export function defineExpose() {}
export function defineOptions() {}
export function defineSlots() {
  return {}
}
export function defineModel() {
  return { value: undefined }
}
export function withDefaults(props, _defaults) {
  return props
}

export function toHandlers() {
  return {}
}
export function withModifiers() {
  return () => {}
}
export function withKeys() {
  return () => {}
}

const NOOP_WATCH = () => {}

// ---------------------------------------------------------------------------
// C. @vue/runtime-vapor — stubs (implemented in src/vapor/ later)
// ---------------------------------------------------------------------------

export function createVaporApp() {
  return {
    mount() {},
    unmount() {},
    use() {
      return this
    },
    component() {
      return this
    },
    directive() {
      return this
    },
  }
}
export function defineVaporComponent(options) {
  return options
}
export function defineVaporAsyncComponent(source) {
  return source
}
export function defineVaporCustomElement() {}
export const VaporElement = function VaporElement() {}

export const VaporTeleport = {}
export const VaporKeepAlive = {}

export function insert() {}
export function prepend() {}
export function remove() {}
export function setInsertionState() {}

export function createComponent() {}
export function createComponentWithFallback() {}
export function createAssetComponent() {}
export function createPlainElement() {}
export function isVaporComponent() {
  return false
}

export function renderEffect() {}

export function createSlot() {}
export function withVaporCtx(fn) {
  return fn()
}

export function template() {
  return document.createDocumentFragment()
}
export function createTextNode() {
  return document.createTextNode('')
}
export function child() {}
export function nthChild() {}
export function next() {}
export function txt() {}

export function setText() {}
export function setBlockText() {}
export function setHtml() {}
export function setBlockHtml() {}
export function setClass() {}
export function setClassName() {}
export function setStyle() {}
export function setAttr() {}
export function setValue() {}
export function setProp() {}
export function setDOMProp() {}
export function setDynamicProps() {}
export function setElementText() {}

export function on() {}
export function onBinding() {}
export function delegate() {}
export function delegateEvents() {}
export function setDynamicEvents() {}
export function createInvoker(fn) {
  return fn
}
export function withVaporModifiers() {
  return () => {}
}
export function withVaporKeys() {
  return () => {}
}

export function createIf() {}
export function createKeyedFragment() {}
export function createFor() {}
export function createForSlots() {}
export function createSelector() {}
export function getRestElement() {}
export function getDefaultValue() {}

export function createTemplateRefSetter() {
  return () => {}
}
export function useVaporCssVars() {}
export function setBlockKey() {}
export function createDynamicComponent() {}
export function withAsyncContext(fn) {
  return fn()
}

export function applyVShow() {}
export function applyTextModel() {}
export function applyRadioModel() {}
export function applyCheckboxModel() {}
export function applySelectModel() {}
export function applyDynamicModel() {}
export function withVaporDirectives() {}

export function isFragment() {
  return false
}
export class VaporFragment {}
export class DynamicFragment {}

// ---------------------------------------------------------------------------
// Migration aliases (vue → pure-vapor)
// ---------------------------------------------------------------------------

export {
  createVaporApp as createApp,
  defineVaporComponent as defineComponent,
  defineVaporAsyncComponent as defineAsyncComponent,
  useVaporCssVars as useCssVars,
}
