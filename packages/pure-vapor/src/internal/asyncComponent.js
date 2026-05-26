import { ref } from '@vue/reactivity'
import { isFunction, isObject } from '@vue/shared'
import { warn as devWarn } from './warning.js'

export function isAsyncWrapper(i) {
  return !!(i.type && i.type.__asyncLoader)
}

export function createAsyncComponentContext(source) {
  if (isFunction(source)) {
    source = { loader: source }
  }

  const { loader, onError: userOnError } = source
  let pendingRequest = null
  let resolvedComp

  let retries = 0
  const retry = () => {
    retries++
    pendingRequest = null
    return load()
  }

  const load = () => {
    let thisRequest
    return (
      pendingRequest ||
      (thisRequest = pendingRequest =
        loader()
          .catch(err => {
            err = err instanceof Error ? err : new Error(String(err))
            if (userOnError) {
              return new Promise((resolve, reject) => {
                const userRetry = () => resolve(retry())
                const userFail = () => reject(err)
                userOnError(err, userRetry, userFail, retries + 1)
              })
            } else {
              throw err
            }
          })
          .then(comp => {
            if (thisRequest !== pendingRequest && pendingRequest) {
              return pendingRequest
            }
            if (__DEV__ && !comp) {
              devWarn(
                `Async component loader resolved to undefined. ` +
                  `If you are using retry(), make sure to return its return value.`,
              )
            }
            if (
              comp &&
              (comp.__esModule || comp[Symbol.toStringTag] === 'Module')
            ) {
              comp = comp.default
            }
            if (__DEV__ && comp && !isObject(comp) && !isFunction(comp)) {
              throw new Error(`Invalid async component load result: ${comp}`)
            }
            resolvedComp = comp
            return comp
          }))
    )
  }

  return {
    load,
    source,
    getResolvedComp: () => resolvedComp,
    setPendingRequest: request => {
      pendingRequest = request
    },
  }
}

export function useAsyncComponentState(delay, timeout, onError) {
  const loaded = ref(false)
  const error = ref()
  const delayed = ref(!!delay)

  if (delay) {
    setTimeout(() => {
      delayed.value = false
    }, delay)
  }

  if (timeout != null) {
    setTimeout(() => {
      if (!loaded.value && !error.value) {
        const err = new Error(`Async component timed out after ${timeout}ms.`)
        onError(err)
        error.value = err
      }
    }, timeout)
  }

  return { loaded, error, delayed }
}
