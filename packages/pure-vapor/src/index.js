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
// B. runtime-core subset — stubs (implemented in src/internal/ later)
// ---------------------------------------------------------------------------

export const version = __VERSION__

export function watch() {
  return NOOP_WATCH
}
export function watchEffect() {}
export function watchPostEffect() {}
export function watchSyncEffect() {}

export function onBeforeMount() {}
export function onMounted() {}
export function onBeforeUpdate() {}
export function onUpdated() {}
export function onBeforeUnmount() {}
export function onUnmounted() {}
export function onActivated() {}
export function onDeactivated() {}
export function onRenderTracked() {}
export function onRenderTriggered() {}
export function onErrorCaptured() {}

export function provide() {}
export function inject() {
  return undefined
}
export function hasInjectionContext() {
  return false
}

export function nextTick(cb) {
  if (cb) {
    return Promise.resolve().then(cb)
  }
  return Promise.resolve()
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

export function getCurrentInstance() {
  return null
}

export function resolveComponent() {}
export function resolveDirective() {}
export function resolveDynamicComponent() {}
export const NULL_DYNAMIC_COMPONENT = Symbol.for('v-ndc')

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
