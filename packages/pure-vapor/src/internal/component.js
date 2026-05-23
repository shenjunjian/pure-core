import { isRef, markRaw, proxyRefs } from '@vue/reactivity'
import { isFunction, isArray } from '@vue/shared'
import { warn } from './warning.js'

export function getComponentName(Component, includeInferred = true) {
  return isFunction(Component)
    ? Component.displayName || Component.name
    : Component.name || (includeInferred && Component.__name)
}

export function formatComponentName(instance, Component, isRoot = false) {
  let name = getComponentName(Component)
  if (!name && Component.__file) {
    const match = Component.__file.match(/([^/\\]+)\.\w+$/)
    if (match) {
      name = match[1]
    }
  }

  if (!name && instance) {
    const inferFromRegistry = registry => {
      if (!registry) return
      for (const key in registry) {
        if (registry[key] === Component) {
          return key
        }
      }
    }
    name =
      inferFromRegistry(instance.components) ||
      inferFromRegistry(instance.appContext && instance.appContext.components)
  }

  if (!name && !isRoot && instance && instance.parent) {
    return formatComponentName(instance.parent, instance.parent.type)
  }

  return name ? classify(name) : isRoot ? `App` : `Anonymous`
}

const classifyRE = /(?:^|[-_])\w/g
function classify(str) {
  return str.replace(classifyRE, c => c.toUpperCase()).replace(/[-_]/g, '')
}

/** 用户的setup中调用该函数， 最终会设置到instance.exposed 上 */
export function expose(instance, exposed) {
  if (__DEV__) {
    if (instance.exposed) {
      warn(`expose() should be called only once per setup().`)
    }
    if (exposed != null) {
      let exposedType = typeof exposed
      if (exposedType === 'object') {
        if (isArray(exposed)) {
          exposedType = 'array'
        } else if (isRef(exposed)) {
          exposedType = 'ref'
        }
      }
      if (exposedType !== 'object') {
        warn(
          `expose() should be passed a plain object, received ${exposedType}.`,
        )
      }
    }
  }
  instance.exposed = exposed || {}
}

export function getComponentPublicInstance(instance) {
  if (instance.exposed) {
    if (!instance.exposeProxy) {
      instance.exposeProxy = new Proxy(proxyRefs(markRaw(instance.exposed)), {
        get(target, key) {
          if (key in target) {
            return target[key]
          }
          return instance.proxy && instance.proxy[key]
        },
        has(target, key) {
          return key in target || (instance.proxy && key in instance.proxy)
        },
      })
    }
    return instance.exposeProxy
  }
  return instance.proxy
}
