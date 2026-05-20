import { isFunction } from '@vue/shared'
import { currentApp } from './app.js'
import { currentInstance, getCurrentGenericInstance } from './instance.js'
import { warn } from './warning.js'

export function provide(key, value) {
  if (__DEV__) {
    if (!currentInstance) {
      warn(`provide() can only be used inside setup().`)
    }
  }
  if (currentInstance) {
    let provides = currentInstance.provides
    const parentProvides =
      currentInstance.parent && currentInstance.parent.provides
    if (parentProvides === provides) {
      provides = currentInstance.provides = Object.create(parentProvides)
    }
    provides[key] = value
  }
}

export function inject(key, defaultValue, treatDefaultAsFactory = false) {
  const instance = getCurrentGenericInstance()

  if (instance || currentApp) {
    let provides = currentApp
      ? currentApp._context.provides
      : instance
        ? instance.parent == null || instance.ce
          ? instance.appContext && instance.appContext.provides
          : instance.parent.provides
        : undefined

    if (provides && key in provides) {
      return provides[key]
    } else if (arguments.length > 1) {
      return treatDefaultAsFactory && isFunction(defaultValue)
        ? defaultValue.call(instance && instance.proxy)
        : defaultValue
    } else if (__DEV__) {
      warn(`injection "${String(key)}" not found.`)
    }
  } else if (__DEV__) {
    warn(`inject() can only be used inside setup() or functional components.`)
  }
}

export function hasInjectionContext() {
  return !!(getCurrentGenericInstance() || currentApp)
}
