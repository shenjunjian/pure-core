import { readonly, shallowRef } from '@vue/reactivity'
import { EMPTY_OBJ } from '@vue/shared'
import { getCurrentGenericInstance } from './instance.js'
import { warn } from './warning.js'
import { isTemplateRefKey, knownTemplateRefs } from './templateRef.js'

export function useTemplateRef(key) {
  const i = getCurrentGenericInstance()
  const r = shallowRef(null)
  if (i) {
    const refs = i.refs === EMPTY_OBJ ? (i.refs = {}) : i.refs
    if (__DEV__ && isTemplateRefKey(refs, key)) {
      warn(`useTemplateRef('${key}') already exists.`)
    } else {
      Object.defineProperty(refs, key, {
        enumerable: true,
        get: () => r.value,
        set: val => (r.value = val),
      })
    }
  } else if (__DEV__) {
    warn(
      `useTemplateRef() is called when there is no active component ` +
        `instance to be associated with.`,
    )
  }
  const ret = __DEV__ ? readonly(r) : r
  if (__DEV__) {
    knownTemplateRefs.add(ret)
  }
  return ret
}
