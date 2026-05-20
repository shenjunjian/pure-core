import { EMPTY_OBJ, hasOwn, isArray, isFunction, isOn } from '@vue/shared'
import { baseEmit } from '../internal/emit.js'
import { resolveSource } from './componentProps.js'

export function normalizeEmitsOptions(comp) {
  const cached = comp.__emitsOptions
  if (cached) return cached

  const raw = comp.emits
  if (!raw) return null

  let normalized
  if (isArray(raw)) {
    normalized = {}
    for (const key of raw) normalized[key] = null
  } else {
    normalized = raw
  }

  return (comp.__emitsOptions = normalized)
}

export function emit(instance, event, ...rawArgs) {
  baseEmit(
    instance,
    instance.rawProps || EMPTY_OBJ,
    propGetter,
    event,
    ...rawArgs,
  )
}

function propGetter(rawProps, key) {
  const dynamicSources = rawProps.$
  if (dynamicSources) {
    let i = dynamicSources.length
    while (i--) {
      const source = resolveSource(dynamicSources[i])
      if (hasOwn(source, key)) {
        return isOn(key) && isFunction(dynamicSources[i])
          ? source[key]
          : resolveSource(source[key])
      }
    }
  }
  return rawProps[key] && resolveSource(rawProps[key])
}
