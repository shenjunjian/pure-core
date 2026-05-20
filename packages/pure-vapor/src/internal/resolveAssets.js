import { camelize, capitalize, isString } from '@vue/shared'
import { getComponentName } from './component.js'
import { currentInstance } from './instance.js'
import { warn } from './warning.js'

export const COMPONENTS = 'components'
export const DIRECTIVES = 'directives'

export const NULL_DYNAMIC_COMPONENT = Symbol.for('v-ndc')

export function resolveComponent(name, maybeSelfReference) {
  return resolveAsset(COMPONENTS, name, true, maybeSelfReference) || name
}

export function resolveDynamicComponent(component) {
  if (isString(component)) {
    return resolveAsset(COMPONENTS, component, false) || component
  }
  return component || NULL_DYNAMIC_COMPONENT
}

export function resolveDirective(name) {
  return resolveAsset(DIRECTIVES, name)
}

function resolveAsset(
  type,
  name,
  warnMissing = true,
  maybeSelfReference = false,
) {
  const instance = currentInstance
  if (instance) {
    const Component = instance.type

    if (type === COMPONENTS) {
      const selfName = getComponentName(Component, false)
      if (
        selfName &&
        (selfName === name ||
          selfName === camelize(name) ||
          selfName === capitalize(camelize(name)))
      ) {
        return Component
      }
    }

    const res =
      resolve(instance[type] || Component[type], name) ||
      resolve(instance.appContext[type], name)

    if (!res && maybeSelfReference) {
      return Component
    }

    if (__DEV__ && warnMissing && !res) {
      const extra =
        type === COMPONENTS
          ? `\nIf this is a native custom element, make sure to exclude it from ` +
            `component resolution via compilerOptions.isCustomElement.`
          : ``
      warn(`Failed to resolve ${type.slice(0, -1)}: ${name}${extra}`)
    }

    return res
  } else if (__DEV__) {
    warn(
      `resolve${capitalize(type.slice(0, -1))} ` +
        `can only be used in render() or setup().`,
    )
  }
}

function resolve(registry, name) {
  return (
    registry &&
    (registry[name] ||
      registry[camelize(name)] ||
      registry[capitalize(camelize(name))])
  )
}
