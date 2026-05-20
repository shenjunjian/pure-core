import { isArray, isRegExp, isString, ShapeFlags } from '@vue/shared'

export function isKeepAlive(instance) {
  const type = instance && (instance.type || instance)
  return !!(type && type.__isKeepAlive)
}

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
