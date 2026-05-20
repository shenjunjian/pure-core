export let isKeepAliveEnabled = false
export let currentKeepAliveCtx = null
export let currentCacheKey

export function enableKeepAlive() {
  isKeepAliveEnabled = true
}

export function withKeepAliveEnabled(value) {
  enableKeepAlive()
  return value
}

export function setCurrentKeepAliveCtx(ctx) {
  try {
    return currentKeepAliveCtx
  } finally {
    currentKeepAliveCtx = ctx
  }
}

export function withCurrentCacheKey(key, fn) {
  const prev = currentCacheKey
  currentCacheKey = key
  try {
    return fn()
  } finally {
    currentCacheKey = prev
  }
}
