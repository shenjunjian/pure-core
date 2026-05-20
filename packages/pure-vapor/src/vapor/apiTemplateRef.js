import { isRef, onScopeDispose } from '@vue/reactivity'
import {
  EMPTY_OBJ,
  NO,
  NOOP,
  isArray,
  isFunction,
  isString,
  remove,
} from '@vue/shared'
import { ErrorCodes, callWithErrorHandling } from '../internal/errorHandling.js'
import { isAsyncWrapper } from '../internal/asyncComponent.js'
import {
  createCanSetSetupRefChecker,
  isTemplateRefKey,
  knownTemplateRefs,
} from '../internal/templateRef.js'
import { queuePostFlushCb } from '../internal/scheduler.js'
import { warn } from '../internal/warning.js'
import { currentInstance } from '../internal/instance.js'
import { DynamicFragment, isDynamicFragment, isFragment } from './fragment.js'
import { getExposed, isVaporComponent } from './component.js'
import { invalidatePendingRef, refCleanups, unsetRef } from './refCleanup.js'

function ensureCleanup(el) {
  let cleanupRef = refCleanups.get(el)
  if (!cleanupRef) {
    refCleanups.set(el, (cleanupRef = { fn: NOOP }))
    onScopeDispose(() => {
      invalidatePendingRef(el)
      cleanupRef.fn()
      refCleanups.delete(el)
    })
  }
  return cleanupRef
}

export function createTemplateRefSetter() {
  const instance = currentInstance
  const oldRefMap = new WeakMap()
  const setRefMap = new WeakMap()

  return (el, ref, refFor, refKey) => {
    if (isDynamicFragment(el) || (isVaporComponent(el) && isAsyncWrapper(el))) {
      const frag = isDynamicFragment(el) ? el : el.block
      const doSet = () => {
        if (isVaporComponent(el) && el.isDeactivated) return
        oldRefMap.set(
          el,
          setRef(instance, el, ref, oldRefMap.get(el), refFor, refKey),
        )
      }
      const prevSet = setRefMap.get(frag)
      if (prevSet && frag.onUpdated) remove(frag.onUpdated, prevSet)
      ;(frag.onUpdated || (frag.onUpdated = [])).push(doSet)
      setRefMap.set(frag, doSet)
    }

    const oldRef = setRef(instance, el, ref, oldRefMap.get(el), refFor, refKey)
    oldRefMap.set(el, oldRef)
    return oldRef
  }
}

function setRef(instance, el, ref, oldRef, refFor, refKey) {
  if (!instance || instance.isUnmounted) return

  const setupState = __DEV__ ? instance.setupState || {} : null

  const refs =
    instance.refs === EMPTY_OBJ ? (instance.refs = {}) : instance.refs

  const canSetSetupRef = __DEV__
    ? createCanSetSetupRefChecker(setupState, refs)
    : NO

  const canSetRef = (ref, key) => {
    if (__DEV__ && knownTemplateRefs.has(ref)) {
      return false
    }
    if (key && isTemplateRefKey(refs, key)) {
      return false
    }
    return true
  }

  if (oldRef != null && oldRef !== ref) {
    invalidatePendingRef(el)
    if (isString(oldRef)) {
      refs[oldRef] = null
      if (__DEV__ && canSetSetupRef(oldRef)) {
        setupState[oldRef] = null
      }
    } else if (isRef(oldRef)) {
      if (canSetRef(oldRef)) oldRef.value = null
    } else if (isFunction(oldRef) && isDynamicFragment(el)) {
      callWithErrorHandling(oldRef, instance, ErrorCodes.FUNCTION_REF, [
        null,
        refs,
      ])
    }
  } else if (oldRef != null && isDynamicFragment(el)) {
    if (isFunction(oldRef)) {
      callWithErrorHandling(oldRef, instance, ErrorCodes.FUNCTION_REF, [
        null,
        refs,
      ])
    } else if (refFor) {
      unsetRef(el)
    }
  }

  if (ref == null) return ref

  if (isFunction(ref)) {
    const invokeRefSetter = value => {
      callWithErrorHandling(ref, instance, ErrorCodes.FUNCTION_REF, [
        value,
        refs,
      ])
    }

    invokeRefSetter(getRefValue(el))
    ensureCleanup(el).fn = () => invokeRefSetter(null)
  } else {
    const _isString = isString(ref)
    const _isRef = isRef(ref)
    let existing

    if (_isString || _isRef) {
      const doSet = () => {
        if (refFor) {
          const refValue = getRefValue(el)
          if (refValue == null) return

          existing = _isString
            ? __DEV__ && canSetSetupRef(ref)
              ? setupState[ref]
              : refs[ref]
            : canSetRef(ref) || !refKey
              ? ref.value
              : refs[refKey]

          if (!isArray(existing)) {
            existing = [refValue]
            if (_isString) {
              refs[ref] = existing
              if (__DEV__ && canSetSetupRef(ref)) {
                setupState[ref] = refs[ref]
                existing = setupState[ref]
              }
            } else {
              if (canSetRef(ref, refKey)) ref.value = existing
              if (refKey) refs[refKey] = existing
            }
          } else if (!existing.includes(refValue)) {
            existing.push(refValue)
          }
        } else if (_isString) {
          const refValue = getRefValue(el)
          refs[ref] = refValue
          if (__DEV__ && canSetSetupRef(ref)) {
            setupState[ref] = refValue
          }
        } else if (_isRef) {
          const refValue = getRefValue(el)
          if (canSetRef(ref, refKey)) ref.value = refValue
          if (refKey) refs[refKey] = refValue
        } else if (__DEV__) {
          warn('Invalid template ref type:', ref, `(${typeof ref})`)
        }
      }
      const cleanup = ensureCleanup(el)
      cleanup.fn = () => {
        if (refFor) {
          if (isArray(existing)) {
            remove(existing, getRefValue(el))
          }
        } else if (_isString) {
          refs[ref] = null
          if (__DEV__ && canSetSetupRef(ref)) {
            setupState[ref] = null
          }
        } else if (_isRef) {
          if (canSetRef(ref, refKey)) ref.value = null
          if (refKey) refs[refKey] = null
        }
      }

      invalidatePendingRef(el)
      const refValue = getRefValue(el)
      if (refValue != null) {
        const job = () => {
          doSet()
          if (cleanup.job === job) cleanup.job = undefined
        }
        cleanup.job = job
        queuePostFlushCb(job, -1)
      } else {
        doSet()
      }
    } else if (__DEV__) {
      warn('Invalid template ref type:', ref, `(${typeof ref})`)
    }
  }
  return ref
}

function getRefValue(el) {
  if (isVaporComponent(el)) {
    if (isAsyncWrapper(el)) {
      if (!el.type.__asyncResolved) return null
      return getRefValue(el.block.nodes)
    }
    return getExposed(el) || el
  } else if (isDynamicFragment(el)) {
    if (isArray(el.nodes)) return null
    return getRefValue(el.nodes)
  }
  return el
}
