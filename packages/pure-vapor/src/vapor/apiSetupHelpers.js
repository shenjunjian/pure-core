import { isPromise } from '@vue/shared'
import {
  currentInstance,
  getCurrentInstance,
  setCurrentInstance,
} from '../internal/instance.js'
import { warn } from '../internal/warning.js'

export function withAsyncContext(getAwaitable) {
  const ctx = getCurrentInstance()
  if (__DEV__ && !ctx) {
    warn(
      `withAsyncContext called without active current instance. ` +
        `This is likely a bug.`,
    )
  }
  let awaitable = getAwaitable()
  setCurrentInstance(null, undefined)

  const restore = () => {
    const resetStoppedScope = ctx && !ctx.scope.active ? ctx.scope : undefined
    setCurrentInstance(ctx)
    return () => {
      if (resetStoppedScope) resetStoppedScope.reset()
    }
  }

  const cleanup = () => {
    setCurrentInstance(null, undefined)
  }

  if (isPromise(awaitable)) {
    awaitable = awaitable.catch(e => {
      const reset = restore()
      Promise.resolve().then(() =>
        Promise.resolve().then(() => {
          if (reset) reset()
          cleanup()
        }),
      )
      throw e
    })
  }
  return [
    awaitable,
    () => {
      const reset = restore()
      cleanup()
      return reset
    },
  ]
}
