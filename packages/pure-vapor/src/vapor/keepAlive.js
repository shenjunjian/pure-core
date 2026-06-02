/**该变量用于判断是否启用了 KeepAlive 功能。
 * 一个 编译时优化/Tree-shaking 标志
 */
export let isKeepAliveEnabled = false
/** 跟踪" 当前正在执行的 KeepAlive 上下文"
 * 子fragment的.keepAliveCtx 会记录当前所属的 KeepAlive 上下文
 */
export let currentKeepAliveCtx = null

/** 记录" 当前组件/Fragment 的缓存键 " */
export let currentCacheKey

export function enableKeepAlive() {
  isKeepAliveEnabled = true
}
/** 当 KeepAlive 组件被 导入 时（即使是只导入没使用）， withKeepAliveEnabled 会立即被调用。
 */
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
