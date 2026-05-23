import {
  EMPTY_ARR,
  NO,
  camelize,
  hasOwn,
  isArray,
  isFunction,
  isPlainObject,
  isString,
} from '@vue/shared'
import {
  computed,
  onScopeDispose,
  pauseTracking,
  resetTracking,
  ReactiveFlags,
} from '@vue/reactivity'
import {
  baseNormalizePropsOptions,
  resolvePropValue,
  validateProps,
} from '../internal/props.js'
import { isEmitListener } from '../internal/emit.js'
import { currentInstance, setCurrentInstance } from '../internal/instance.js'
import {
  pushWarningContext,
  popWarningContext,
  warn,
} from '../internal/warning.js'
import { normalizeEmitsOptions } from './componentEmits.js'
import { renderEffect } from './renderEffect.js'

export function resolveSource(source) {
  return isFunction(source) ? resolveFunctionSource(source) : source
}

export function resolveFunctionSource(source) {
  if (source._cache) {
    return source._cache.value
  }

  const parent = currentInstance && currentInstance.parent
  if (parent) {
    source._cache = computed(oldValue => {
      const prev = setCurrentInstance(parent)
      try {
        return stabilizeDynamicSourceValue(oldValue, source())
      } finally {
        setCurrentInstance(...prev)
      }
    })
    onScopeDispose(() => {
      source._cache = undefined
    })
    return source._cache.value
  }

  return source()
}

function stabilizeDynamicSourceValue(oldValue, value) {
  if (!isPlainObject(oldValue) || !isPlainObject(value)) {
    return value
  }

  const oldKeys = Object.keys(oldValue)
  const newKeys = Object.keys(value)
  if (oldKeys.length !== newKeys.length) {
    return value
  }

  for (let i = 0; i < newKeys.length; i++) {
    const key = newKeys[i]
    if (!hasOwn(oldValue, key) || !Object.is(oldValue[key], value[key])) {
      return value
    }
  }

  return oldValue
}

export function getPropsProxyHandlers(comp, once) {
  if (comp.__propsHandlers) {
    return comp.__propsHandlers
  }
  const propsOptions = normalizePropsOptions(comp)[0]
  const emitsOptions = normalizeEmitsOptions(comp)
  const isProp = propsOptions
    ? key => isString(key) && hasOwn(propsOptions, camelize(key))
    : NO
  const isAttr =
    propsOptions || emitsOptions
      ? key =>
          isString(key) &&
          key !== '$' &&
          !isProp(key) &&
          !isEmitListener(emitsOptions, key)
      : key => isString(key)

  const getProp = (instance, key) => {
    if (key === ReactiveFlags.IS_REACTIVE) return true

    if (!isProp(key)) return
    const rawProps = instance.rawProps
    const dynamicSources = rawProps.$
    if (dynamicSources) {
      let i = dynamicSources.length
      let source, isDynamic, rawKey
      while (i--) {
        source = dynamicSources[i]
        isDynamic = isFunction(source)
        source = isDynamic ? resolveFunctionSource(source) : source
        for (rawKey in source) {
          if (camelize(rawKey) === key) {
            return resolvePropValue(
              propsOptions,
              key,
              isDynamic ? source[rawKey] : resolveSource(source[rawKey]),
              instance,
              resolveDefault,
            )
          }
        }
      }
    }
    for (const rawKey in rawProps) {
      if (camelize(rawKey) === key) {
        return resolvePropValue(
          propsOptions,
          key,
          resolveSource(rawProps[rawKey]),
          instance,
          resolveDefault,
        )
      }
    }
    return resolvePropValue(
      propsOptions,
      key,
      undefined,
      instance,
      resolveDefault,
      true,
    )
  }

  const withOnceCache = getter => {
    return (instance, key) => {
      const cache = instance.oncePropsCache || (instance.oncePropsCache = {})
      if (!(key in cache)) {
        pauseTracking()
        try {
          cache[key] = getter(instance, key)
        } finally {
          resetTracking()
        }
      }
      return cache[key]
    }
  }

  const getOnceProp = withOnceCache(getProp)
  const propsHandlers = propsOptions
    ? {
        get: (target, key) => (once ? getOnceProp : getProp)(target, key),
        has: (_, key) => isProp(key),
        ownKeys: () => Object.keys(propsOptions),
        getOwnPropertyDescriptor(target, key) {
          if (isProp(key)) {
            return {
              configurable: true,
              enumerable: true,
              get: () => (once ? getOnceProp : getProp)(target, key),
            }
          }
        },
      }
    : null

  if (__DEV__ && propsOptions) {
    Object.assign(propsHandlers, {
      set: propsSetDevTrap,
      deleteProperty: propsDeleteDevTrap,
    })
  }

  const getAttr = (target, key) => {
    if (isString(key) && !isProp(key) && !isEmitListener(emitsOptions, key)) {
      return getAttrFromRawProps(target, key)
    }
  }

  const hasAttr = (target, key) => {
    if (isAttr(key)) {
      return hasAttrFromRawProps(target, key)
    } else {
      return false
    }
  }

  const getOnceAttr = withOnceCache((instance, key) =>
    getAttr(instance.rawProps, key),
  )
  const attrsHandlers = {
    get: (target, key) =>
      once ? getOnceAttr(target, key) : getAttr(target.rawProps, key),
    has: (target, key) => hasAttr(target.rawProps, key),
    ownKeys: target => getKeysFromRawProps(target.rawProps).filter(isAttr),
    getOwnPropertyDescriptor(target, key) {
      if (isString(key) && hasAttr(target.rawProps, key)) {
        return {
          configurable: true,
          enumerable: true,
          get: () =>
            once ? getOnceAttr(target, key) : getAttr(target.rawProps, key),
        }
      }
    },
  }

  if (__DEV__) {
    Object.assign(attrsHandlers, {
      set: propsSetDevTrap,
      deleteProperty: propsDeleteDevTrap,
    })
  }

  return (comp.__propsHandlers = [propsHandlers, attrsHandlers])
}

export function getAttrFromRawProps(rawProps, key) {
  if (key === '$') return
  const merged = key === 'class' || key === 'style' ? [] : undefined
  const dynamicSources = rawProps.$
  if (dynamicSources) {
    let i = dynamicSources.length
    let source, isDynamic
    while (i--) {
      source = dynamicSources[i]
      isDynamic = isFunction(source)
      source = isDynamic ? resolveFunctionSource(source) : source
      if (source && hasOwn(source, key)) {
        const value = isDynamic ? source[key] : resolveSource(source[key])
        if (merged) {
          merged.push(value)
        } else {
          return value
        }
      }
    }
  }
  if (hasOwn(rawProps, key)) {
    const value = resolveSource(rawProps[key])
    if (merged) {
      merged.push(value)
    } else {
      return value
    }
  }
  if (merged && merged.length) {
    return merged
  }
}

export function hasAttrFromRawProps(rawProps, key) {
  if (key === '$') return false
  const dynamicSources = rawProps.$
  if (dynamicSources) {
    let i = dynamicSources.length
    while (i--) {
      const source = resolveSource(dynamicSources[i])
      if (source && hasOwn(source, key)) {
        return true
      }
    }
  }
  return hasOwn(rawProps, key)
}

export function getKeysFromRawProps(rawProps) {
  const keys = []
  for (const key in rawProps) {
    if (key !== '$') keys.push(key)
  }
  const dynamicSources = rawProps.$
  if (dynamicSources) {
    let i = dynamicSources.length
    let source
    while (i--) {
      source = isFunction(dynamicSources[i])
        ? resolveFunctionSource(dynamicSources[i])
        : dynamicSources[i]
      for (const key in source) {
        keys.push(key)
      }
    }
  }
  return Array.from(new Set(keys))
}

export function normalizePropsOptions(comp) {
  const cached = comp.__propsOptions
  if (cached) return cached

  const raw = comp.props
  if (!raw) return EMPTY_ARR

  const normalized = {}
  const needCastKeys = []
  baseNormalizePropsOptions(raw, normalized, needCastKeys)

  return (comp.__propsOptions = [normalized, needCastKeys])
}

function resolveDefault(factory, instance) {
  const prev = setCurrentInstance(instance)
  const res = factory.call(null, instance.props)
  setCurrentInstance(...prev)
  return res
}
/**  是否存在未声明为 prop 的属性, 需要我传递给子组件的attrs
 *  1. rawProps.$ 存在
 *  2. 组件未声明 props
 *  3.rawProps 里至少有一个 key 不是已声明的 prop
 *
 * @eg < Child  data-id="1" /> data-id不是props时，它就为instance.hasFallthrough=true.
 */
export function hasFallthroughAttrs(comp, rawProps) {
  if (rawProps) {
    if (rawProps.$ || !comp.props) {
      return true
    } else {
      const propsOptions = normalizePropsOptions(comp)[0]
      for (const key in rawProps) {
        if (!hasOwn(propsOptions, camelize(key))) {
          return true
        }
      }
    }
  }
  return false
}

export function setupPropsValidation(instance) {
  const rawProps = instance.rawProps
  if (!rawProps) return
  renderEffect(() => {
    pushWarningContext(instance)
    validateProps(
      resolveDynamicProps(rawProps),
      instance.props,
      normalizePropsOptions(instance.type)[0],
    )
    popWarningContext()
  }, true)
}

export function resolveDynamicProps(props) {
  const mergedRawProps = {}
  for (const key in props) {
    if (key !== '$') {
      mergedRawProps[key] = resolveSource(props[key])
    }
  }
  if (props.$) {
    for (const source of props.$) {
      const isDynamic = isFunction(source)
      const resolved = isDynamic ? resolveFunctionSource(source) : source
      for (const key in resolved) {
        const value = isDynamic ? resolved[key] : resolveSource(source[key])
        if (key === 'class' || key === 'style') {
          const existing = mergedRawProps[key]
          if (isArray(existing)) {
            existing.push(value)
          } else {
            mergedRawProps[key] = [existing, value]
          }
        } else {
          mergedRawProps[key] = value
        }
      }
    }
  }
  return mergedRawProps
}

function propsSetDevTrap(_, key) {
  warn(
    `Attempt to mutate prop ${JSON.stringify(key)} failed. Props are readonly.`,
  )
  return true
}

function propsDeleteDevTrap(_, key) {
  warn(
    `Attempt to delete prop ${JSON.stringify(key)} failed. Props are readonly.`,
  )
  return true
}

export const rawPropsProxyHandlers = {
  get: getAttrFromRawProps,
  has: hasAttrFromRawProps,
  ownKeys: getKeysFromRawProps,
  getOwnPropertyDescriptor(target, key) {
    if (hasAttrFromRawProps(target, key)) {
      return {
        configurable: true,
        enumerable: true,
        get: () => getAttrFromRawProps(target, key),
      }
    }
  },
}
