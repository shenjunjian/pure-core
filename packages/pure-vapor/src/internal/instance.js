import { setCurrentScope } from '@vue/reactivity'
import { warn } from './warning.js'

export let currentInstance = null

export const getCurrentGenericInstance = () => currentInstance

export function getCurrentInstance() {
  return currentInstance
}

let simpleSetCurrentInstance = i => {
  currentInstance = i
}

export const setCurrentInstance = (
  instance,
  scope = instance !== null ? instance.scope : undefined,
) => {
  try {
    return [currentInstance, setCurrentScope(scope)]
  } finally {
    simpleSetCurrentInstance(instance)
  }
}

/**
 * Restores a snapshot returned by {@link setCurrentInstance}. Unlike calling
 * `setCurrentInstance(...prev)`, an `undefined` saved scope is restored
 * verbatim instead of re-triggering the `instance.scope` default.
 */
export const restoreCurrentInstance = prev => {
  setCurrentScope(prev[1])
  simpleSetCurrentInstance(prev[0])
}

const internalOptions = ['ce', 'type', 'uid']

export const useInstanceOption = (key, silent = false) => {
  const instance = getCurrentGenericInstance()
  if (!instance) {
    if (__DEV__ && !silent) {
      warn(`useInstanceOption called without an active component instance.`)
    }
    return { hasInstance: false, value: undefined }
  }

  if (!internalOptions.includes(key)) {
    if (__DEV__) {
      warn(
        `useInstanceOption only accepts ` +
          ` ${internalOptions.map(k => `'${k}'`).join(', ')} as key, got '${key}'.`,
      )
    }
    return { hasInstance: true, value: undefined }
  }

  return { hasInstance: true, value: instance[key] }
}
