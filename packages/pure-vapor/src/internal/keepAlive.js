import { ShapeFlags, isArray, isRegExp, isString } from '@vue/shared'

/**该函数用于判断组件是否是 KeepAlive 组件。
 */
export function isKeepAlive(instance) {
  const type = instance && (instance.type || instance)
  return !!(type && type.__isKeepAlive)
}
/**该函数用于 完全清除组件的 KeepAlive 相关标志位 ，通常在以下场景调用：

- 组件真正被销毁时（不再被 KeepAlive 缓存）
- HMR（热模块替换）场景中，确保更新后的组件重新初始化
这样可以防止已销毁的组件被错误地当作缓存组件处理。
 */
export function resetShapeFlag(instance) {
  instance.shapeFlag =
    instance.shapeFlag & ~ShapeFlags.COMPONENT_SHOULD_KEEP_ALIVE
  instance.shapeFlag = instance.shapeFlag & ~ShapeFlags.COMPONENT_KEPT_ALIVE
}

export function matches(pattern, name) {
  if (isArray(pattern)) {
    for (let i = 0; i < pattern.length; i++) {
      if (matches(pattern[i], name)) return true
    }
    return false
  } else if (isString(pattern)) {
    return pattern.split(',').includes(name)
  } else if (isRegExp(pattern)) {
    pattern.lastIndex = 0
    return pattern.test(name)
  }
  return false
}
