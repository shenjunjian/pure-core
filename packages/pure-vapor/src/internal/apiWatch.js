import { watch as _watch } from '@vue/reactivity'

export { _watch as watch }

export function watchEffect(effect, options) {
  return _watch(effect, null, options)
}

export function watchPostEffect(effect, options) {
  return _watch(
    effect,
    null,
    __DEV__ ? { ...options, flush: 'post' } : { flush: 'post' },
  )
}

export function watchSyncEffect(effect, options) {
  return _watch(
    effect,
    null,
    __DEV__ ? { ...options, flush: 'sync' } : { flush: 'sync' },
  )
}
