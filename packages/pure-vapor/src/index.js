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
export { useId } from './internal/useId.js'
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

export {
  isVaporComponent,
  createComponent,
  createComponentWithFallback,
  createAssetComponent,
  createPlainElement,
  mountComponent,
  unmountComponent,
  getExposed,
  getRootElement,
  applyFallthroughProps,
  getCurrentScopeId,
  isApplyingFallthroughProps,
} from './vapor/component.js'

export { createVaporApp } from './vapor/apiCreateApp.js'
export { defineVaporComponent } from './vapor/apiDefineComponent.js'
export { defineVaporAsyncComponent } from './vapor/apiDefineAsyncComponent.js'
export { createDynamicComponent } from './vapor/apiCreateDynamicComponent.js'
export { createTemplateRefSetter } from './vapor/apiTemplateRef.js'
export { withAsyncContext } from './vapor/apiSetupHelpers.js'
export { createSlot, withVaporCtx } from './vapor/componentSlots.js'

// Stubs until vapor-builtin todos
export function defineVaporCustomElement() {}
export const VaporElement = function VaporElement() {}

export const VaporTeleport = {}
export const VaporKeepAlive = {}

export function useVaporCssVars() {}

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

export { createVaporApp as createApp } from './vapor/apiCreateApp.js'
export { defineVaporComponent as defineComponent } from './vapor/apiDefineComponent.js'
export { defineVaporAsyncComponent as defineAsyncComponent } from './vapor/apiDefineAsyncComponent.js'

export { SlotFragment } from './vapor/fragment.js'
