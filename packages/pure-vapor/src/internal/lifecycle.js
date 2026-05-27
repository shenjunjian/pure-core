import { setActiveSub } from '@vue/reactivity'
import { toHandlerKey } from '@vue/shared'
import {
  ErrorTypeStrings,
  callWithAsyncErrorHandling,
} from './errorHandling.js'
import { currentInstance, setCurrentInstance } from './instance.js'
import { LifecycleHooks } from './enums.js'
import { warn } from './warning.js'

export function injectHook(type, hook, target = currentInstance) {
  if (target) {
    // 实例上添加钩子属性  eg. instance.bm = []
    const hooks = target[type] || (target[type] = [])
    // 包装用户的函数， 在hook._weh 挂一个真实的函数。  如果同一个hook函数用户绑定多个生命周期钩子，_weh 只生成一份。
    const wrappedHook =
      hook.__weh ||
      (hook.__weh = (...args) => {
        const prevSub = setActiveSub()
        const prev = setCurrentInstance(target)
        try {
          return callWithAsyncErrorHandling(hook, target, type, args)
        } finally {
          setCurrentInstance(...prev)
          setActiveSub(prevSub)
        }
      })
    // 把 __weh 保存到相应的周期属性下面。  TODO: 我有另一个想法： 在此处不包装，在调用处， 再包装这段逻辑。 但是调用处不统一的话，可能就会重复了。
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
   * 创建生命周期钩子
   * @param {Function} hook 用户的函数
   * @param {Object} target 组件实例
   * @returns {Function} 生命周期钩子函数
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
