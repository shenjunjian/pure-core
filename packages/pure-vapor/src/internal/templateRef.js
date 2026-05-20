import { readonly, shallowRef } from '@vue/reactivity'
import { EMPTY_OBJ } from '@vue/shared'
import { getCurrentInstance } from './instance.js'
import { warn } from './warning.js'

export const knownTemplateRefs = new WeakSet()

export function isTemplateRefKey(refs, key) {
  const desc = Object.getOwnPropertyDescriptor(refs, key)
  return !!(desc && !desc.configurable)
}

export function createCanSetSetupRefChecker(setupState, refs) {
  const rawSetupState = setupState
  if (setupState === undefined || setupState === EMPTY_OBJ) {
    return () => false
  }
  return key => {
    if (__DEV__) {
      if (knownTemplateRefs.has(rawSetupState[key])) {
        return false
      }
    }
    if (isTemplateRefKey(refs, key)) {
      return false
    }
    return Object.prototype.hasOwnProperty.call(rawSetupState, key)
  }
}
