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

const NOOP_WATCH = () => {}

// ---------------------------------------------------------------------------
// C. @vue/runtime-vapor — DOM / block / control flow (vapor-component todo: rest)
// ---------------------------------------------------------------------------

export {
  insert,
  prepend,
  remove,
  isBlock,
  isValidBlock,
} from './vapor/block.js'
export {
  setInsertionState,
  resetInsertionState,
} from './vapor/insertionState.js'
export { renderEffect, RenderEffect } from './vapor/renderEffect.js'

export { template } from './vapor/dom/template.js'
export {
  createElement,
  createTextNode,
  createComment,
  querySelector,
  parentNode,
  child,
  nthChild,
  next,
  txt,
} from './vapor/dom/node.js'

export {
  setProp,
  setAttr,
  setDOMProp,
  setClass,
  setClassName,
  setStyle,
  setValue,
  setText,
  setElementText,
  setBlockText,
  setHtml,
  setBlockHtml,
  setDynamicProps,
  setDynamicProp,
  optimizePropertyLookup,
} from './vapor/dom/prop.js'

export {
  on,
  onBinding,
  delegate,
  delegateEvents,
  setDynamicEvents,
  createInvoker,
  withVaporModifiers,
  withVaporKeys,
} from './vapor/dom/event.js'

export { runWithDomOps, runWithDomOpsSync } from './vapor/dom/domOps.js'

export { createIf } from './vapor/apiCreateIf.js'
export {
  createFor,
  createForSlots,
  createSelector,
  getRestElement,
  getDefaultValue,
  isForBlock,
} from './vapor/apiCreateFor.js'
export { createKeyedFragment } from './vapor/apiCreateFragment.js'
export { setBlockKey } from './vapor/helpers/setKey.js'

export {
  VaporFragment,
  DynamicFragment,
  ForFragment,
  ForBlock,
  isFragment,
  isDynamicFragment,
} from './vapor/fragment.js'

export { isVaporComponent } from './vapor/component.js'

// Stubs until vapor-component / vapor-builtin todos
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

export function createComponent() {}
export function createComponentWithFallback() {}
export function createAssetComponent() {}
export function createPlainElement() {}

export function createSlot() {}
export function withVaporCtx(fn) {
  return fn()
}

export function createTemplateRefSetter() {
  return () => {}
}
export function useVaporCssVars() {}
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

export { withModifiers, withKeys } from './internal/eventModifiers.js'

export { flushDomJobs, getPendingDomOpCount } from './internal/domJobQueue.js'

// ---------------------------------------------------------------------------
// Migration aliases (vue → pure-vapor)
// ---------------------------------------------------------------------------

export {
  createVaporApp as createApp,
  defineVaporComponent as defineComponent,
  defineVaporAsyncComponent as defineAsyncComponent,
  useVaporCssVars as useCssVars,
}
