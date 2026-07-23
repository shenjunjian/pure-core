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
import {
  currentInstance,
  restoreCurrentInstance,
  setCurrentInstance,
} from '../internal/instance.js'
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
    // create the computed in the parent's context so it is collected by the
    // parent's scope rather than whatever scope happens to be active here
    const prev = setCurrentInstance(parent)
    try {
      source._cache = computed(oldValue => {
        const prevInner = setCurrentInstance(parent)
        try {
          return stabilizeDynamicSourceValue(oldValue, source())
        } finally {
          restoreCurrentInstance(prevInner)
        }
      })
      onScopeDispose(() => {
        source._cache = undefined
      })
    } finally {
      restoreCurrentInstance(prev)
    }
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

export function snapshotRawProps(rawProps) {
  const snapshot = Object.create(null)
  for (const key in rawProps) {
    if (key !== '$') {
      const value = resolveSource(rawProps[key])
      snapshot[key] = () => value
    }
  }

  const dynamicSources = rawProps.$
  if (dynamicSources) {
    const snapshotSources = []
    for (let i = 0; i < dynamicSources.length; i++) {
      const source = dynamicSources[i]
      const value = Object.create(null)
      if (isFunction(source)) {
        const resolved = resolveFunctionSource(source)
        for (const key in resolved) {
          value[key] = resolved[key]
        }
        snapshotSources[i] = () => value
      } else {
        for (const key in source) {
          const resolved = resolveSource(source[key])
          value[key] = () => resolved
        }
        snapshotSources[i] = value
      }
    }
    const symbols = Object.getOwnPropertySymbols(dynamicSources)
    for (let i = 0; i < symbols.length; i++) {
      snapshotSources[symbols[i]] = dynamicSources[symbols[i]]
    }
    snapshot.$ = snapshotSources
  }

  return snapshot
}

export function getPropsProxyHandlers(comp) {
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
      const cache =
        instance.oncePropsCache ||
        (instance.oncePropsCache = Object.create(null))
      if (!hasOwn(cache, key)) {
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
  const getMaybeOnceProp = (instance, key) =>
    (instance.isOnce ? getOnceProp : getProp)(instance, key)
  const propsHandlers = propsOptions
    ? {
        get: getMaybeOnceProp,
        has: (_, key) => isProp(key),
        ownKeys: () => Object.keys(propsOptions),
        getOwnPropertyDescriptor(target, key) {
          if (isProp(key)) {
            return {
              configurable: true,
              enumerable: true,
              get: () => getMaybeOnceProp(target, key),
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
  const onceAttrKeys = Symbol()
  const getAttrKeys = target =>
    getKeysFromRawProps(target.rawProps).filter(isAttr)
  const getOnceAttrKeys = target => {
    const cache =
      target.oncePropsCache || (target.oncePropsCache = Object.create(null))
    if (!hasOwn(cache, onceAttrKeys)) {
      pauseTracking()
      try {
        const keys = getAttrKeys(target)
        cache[onceAttrKeys] = keys
        for (let i = 0; i < keys.length; i++) {
          const key = keys[i]
          if (!hasOwn(cache, key)) {
            cache[key] = getAttr(target.rawProps, key)
          }
        }
      } finally {
        resetTracking()
      }
    }
    return cache[onceAttrKeys]
  }
  const getMaybeOnceAttrKeys = target =>
    target.isOnce ? getOnceAttrKeys(target) : getAttrKeys(target)
  const getMaybeOnceAttr = (instance, key) =>
    instance.isOnce
      ? getOnceAttrKeys(instance).includes(key)
        ? getOnceAttr(instance, key)
        : undefined
      : getAttr(instance.rawProps, key)
  const attrsHandlers = {
    get: getMaybeOnceAttr,
    has: (target, key) =>
      target.isOnce
        ? getOnceAttrKeys(target).includes(key)
        : hasAttr(target.rawProps, key),
    ownKeys: getMaybeOnceAttrKeys,
    getOwnPropertyDescriptor(target, key) {
      if (
        isString(key) &&
        (target.isOnce
          ? getOnceAttrKeys(target).includes(key)
          : hasAttr(target.rawProps, key))
      ) {
        return {
          configurable: true,
          enumerable: true,
          get: () => getMaybeOnceAttr(target, key),
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

/** ??????? props ??? ????? [normalized, needCastKeys]
 * normalized: {type:String, shouldCast:bool(?????), shouldCastTrue:bool(?????)}
 * needCastKeys: ??cast???? ?? number, boolean?props??????? ['count', 'isShow']
 */
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
  restoreCurrentInstance(prev)
  return res
}
/**  ???????? prop ???, ??????????attrs
 *  1. rawProps.$ ??
 *  2. ????? props
 *  3.rawProps ?????? key ?????? prop
 *
 * @eg < Child  data-id="1" /> data-id??props?????instance.hasFallthrough=true.
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

/**
 * ?????????? props ??????
 * pure-vapor ? instance.props ???? rawProps?? $ ??????? Proxy?
 * ??????? props ?????/??/custom validator ???????
 * ??? renderEffect ????? instance.props ??? validateProps?
 * ? runtime-core ? initProps ??????????
 * ????? noLifecycle=true????????????????
 */
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
