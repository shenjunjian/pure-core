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
import { renderEffect } from './renderEffect.js'

function getTemplateRefUpdateFragment(el) {
  if (isDynamicFragment(el)) return el
  if (isVaporComponent(el) && isAsyncWrapper(el)) {
    return el.block
  }
}

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
  const stateMap = new WeakMap()

  return (el, ref, refFor, refKey) => {
    let state = stateMap.get(el)
    if (!state) {
      stateMap.set(el, (state = { ref }))
    }
    return setTemplateRefWithState(instance, el, state, ref, refFor, refKey)
  }
}

function createSingleTemplateRefSetter() {
  const instance = currentInstance
  let state

  return (el, ref, refFor, refKey) => {
    if (!state) {
      state = { ref }
    }
    return setTemplateRefWithState(instance, el, state, ref, refFor, refKey)
  }
}

function setTemplateRefWithState(instance, el, state, ref, refFor, refKey) {
  state.ref = ref
  state.refFor = refFor
  state.refKey = refKey

  const frag = getTemplateRefUpdateFragment(el)
  if (frag && state.registeredFrag !== frag) {
    state.registeredFrag = frag
    ;(frag.onUpdated || (frag.onUpdated = [])).push(() => {
      if (isVaporComponent(el) && el.isDeactivated) return
      state.oldRef = setRef(
        instance,
        el,
        state.ref,
        state.oldRef,
        state.refFor,
        state.refKey,
        state.oldRefKey,
      )
      state.oldRefKey = state.oldRef != null ? state.refKey : undefined
    })
  }

  const oldRef = setRef(
    instance,
    el,
    ref,
    state.oldRef,
    refFor,
    refKey,
    state.oldRefKey,
  )
  state.oldRef = oldRef
  state.oldRefKey = oldRef != null ? refKey : undefined
  return oldRef
}

export function setStaticTemplateRef(el, ref, refFor, refKey) {
  const instance = currentInstance
  const oldRef = setRef(instance, el, ref, undefined, refFor, refKey)
  const frag = getTemplateRefUpdateFragment(el)
  if (frag) {
    ;(frag.onUpdated || (frag.onUpdated = [])).push(() => {
      if (isVaporComponent(el) && el.isDeactivated) return
      setRef(instance, el, ref, oldRef, refFor, refKey)
    })
  }
  return oldRef
}

export function setTemplateRefBinding(
  el,
  getter,
  setter = createSingleTemplateRefSetter(),
  refFor,
  refKey,
) {
  renderEffect(() => setter(el, getter(), refFor, refKey))
}

function setRef(instance, el, ref, oldRef, refFor, refKey, oldRefKey) {
  if (!instance || instance.isUnmounted) return

  const setupState = __DEV__ ? instance.setupState || {} : null
  const refValue = getRefValue(el)

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
      if (canSetRef(oldRef, oldRefKey)) oldRef.value = null
      if (oldRefKey) refs[oldRefKey] = null
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

    invokeRefSetter(refValue)
    ensureCleanup(el).fn = () => invokeRefSetter(null)
  } else {
    const _isString = isString(ref)
    const _isRef = isRef(ref)
    let existing

    if (_isString || _isRef) {
      const doSet = () => {
        if (refFor) {
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
          refs[ref] = refValue
          if (__DEV__ && canSetSetupRef(ref)) {
            setupState[ref] = refValue
          }
        } else if (_isRef) {
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
            remove(existing, refValue)
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
