import { setActiveSub } from '@vue/reactivity'
import { toHandlerKey } from '@vue/shared'
import {
  ErrorTypeStrings,
  callWithAsyncErrorHandling,
} from './errorHandling.js'
import {
  currentInstance,
  restoreCurrentInstance,
  setCurrentInstance,
} from './instance.js'
import { LifecycleHooks } from './enums.js'
import { warn } from './warning.js'

export function injectHook(type, hook, target = currentInstance) {
  if (target) {
    // ?????????  eg. instance.bm = []
    const hooks = target[type] || (target[type] = [])
    // ???????? ?hook._weh ?????????  ?????hook???????????????_weh ??????
    const wrappedHook =
      hook.__weh ||
      (hook.__weh = (...args) => {
        const prevSub = setActiveSub()
        const prev = setCurrentInstance(target)
        try {
          return callWithAsyncErrorHandling(hook, target, type, args)
        } finally {
          restoreCurrentInstance(prev)
          setActiveSub(prevSub)
        }
      })
    // ? __weh ?????????????  TODO: ???????? ???????????? ???????? ???????????????????
    hooks.push(wrappedHook)
    return wrappedHook
  } else if (__DEV__) {
    const apiName = toHandlerKey(ErrorTypeStrings[type].replace(/ hook$/, ''))
    warn(
      `${apiName} is called when there is no active component instance to be ` +
        `associated with. ` +
        `Lifecycle injection APIs can only be used during execution of setup().`,
    )
  }
}

const createHook =
  lifecycle =>
  /**
   * ????????
   * @param {Function} hook ?????
   * @param {Object} target ????
   * @returns {Function} ????????
   */
  (hook, target = currentInstance) => {
    injectHook(lifecycle, (...args) => hook(...args), target)
  }

export const onBeforeMount = createHook(LifecycleHooks.BEFORE_MOUNT)
export const onMounted = createHook(LifecycleHooks.MOUNTED)
export const onBeforeUpdate = createHook(LifecycleHooks.BEFORE_UPDATE)
export const onUpdated = createHook(LifecycleHooks.UPDATED)
export const onBeforeUnmount = createHook(LifecycleHooks.BEFORE_UNMOUNT)
export const onUnmounted = createHook(LifecycleHooks.UNMOUNTED)
export const onServerPrefetch = createHook(LifecycleHooks.SERVER_PREFETCH)
export const onRenderTriggered = createHook(LifecycleHooks.RENDER_TRIGGERED)
export const onRenderTracked = createHook(LifecycleHooks.RENDER_TRACKED)
export const onActivated = createHook(LifecycleHooks.ACTIVATED)
export const onDeactivated = createHook(LifecycleHooks.DEACTIVATED)

export function onErrorCaptured(hook, target = currentInstance) {
  injectHook(LifecycleHooks.ERROR_CAPTURED, hook, target)
}
