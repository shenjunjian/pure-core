import { isArray } from '@vue/shared'
import { ErrorCodes, callWithAsyncErrorHandling } from './errorHandling.js'
import { onBeforeUnmount, onMounted } from './lifecycle.js'
import { isHmrUpdating } from './hmr.js'
import { warn } from './warning.js'

export const leaveCbKey = Symbol('_leaveCb')
const enterCbKey = Symbol('_enterCb')

export function useTransitionState() {
  const state = {
    isMounted: false,
    isLeaving: false,
    isUnmounting: false,
    leavingNodes: new Map(),
  }
  onMounted(() => {
    state.isMounted = true
  })
  onBeforeUnmount(() => {
    state.isUnmounting = true
  })
  return state
}

const TransitionHookValidator = [Function, Array]

export const BaseTransitionPropsValidators = {
  mode: String,
  appear: Boolean,
  persisted: Boolean,
  onBeforeEnter: TransitionHookValidator,
  onEnter: TransitionHookValidator,
  onAfterEnter: TransitionHookValidator,
  onEnterCancelled: TransitionHookValidator,
  onBeforeLeave: TransitionHookValidator,
  onLeave: TransitionHookValidator,
  onAfterLeave: TransitionHookValidator,
  onLeaveCancelled: TransitionHookValidator,
  onBeforeAppear: TransitionHookValidator,
  onAppear: TransitionHookValidator,
  onAfterAppear: TransitionHookValidator,
  onAppearCancelled: TransitionHookValidator,
}

export function baseResolveTransitionHooks(context, props, state, instance) {
  const {
    isLeaving,
    setLeavingNodeCache,
    unsetLeavingNodeCache,
    earlyRemove,
    cloneHooks,
  } = context

  const {
    appear,
    mode,
    persisted = false,
    onBeforeEnter,
    onEnter,
    onAfterEnter,
    onEnterCancelled,
    onBeforeLeave,
    onLeave,
    onAfterLeave,
    onLeaveCancelled,
    onBeforeAppear,
    onAppear,
    onAfterAppear,
    onAppearCancelled,
  } = props

  const callHook = (hook, args) => {
    if (hook) {
      callWithAsyncErrorHandling(
        hook,
        instance,
        ErrorCodes.TRANSITION_HOOK,
        args,
      )
    }
  }

  const callAsyncHook = (hook, args) => {
    const done = args[1]
    callHook(hook, args)
    if (isArray(hook)) {
      if (hook.every(h => h.length <= 1)) done()
    } else if (hook.length <= 1) {
      done()
    }
  }

  const hooks = {
    mode,
    persisted,
    beforeEnter(el) {
      let hook = onBeforeEnter
      if (!state.isMounted) {
        if (appear) {
          hook = onBeforeAppear || onBeforeEnter
        } else {
          return
        }
      }
      if (el[leaveCbKey]) {
        el[leaveCbKey](true)
      }
      earlyRemove()
      callHook(hook, [el])
    },

    enter(el) {
      if (!isHmrUpdating && isLeaving()) return
      let hook = onEnter
      let afterHook = onAfterEnter
      let cancelHook = onEnterCancelled
      if (!state.isMounted) {
        if (appear) {
          hook = onAppear || onEnter
          afterHook = onAfterAppear || onAfterEnter
          cancelHook = onAppearCancelled || onEnterCancelled
        } else {
          return
        }
      }
      let called = false
      el[enterCbKey] = cancelled => {
        if (called) return
        called = true
        if (cancelled) {
          callHook(cancelHook, [el])
        } else {
          callHook(afterHook, [el])
        }
        if (hooks.delayedLeave) {
          hooks.delayedLeave()
        }
        el[enterCbKey] = undefined
      }
      const done = el[enterCbKey].bind(null, false)
      if (hook) {
        callAsyncHook(hook, [el, done])
      } else {
        done()
      }
    },

    leave(el, remove) {
      if (el[enterCbKey]) {
        el[enterCbKey](true)
      }
      if (state.isUnmounting) {
        return remove()
      }
      callHook(onBeforeLeave, [el])
      let called = false
      el[leaveCbKey] = cancelled => {
        if (called) return
        called = true
        remove()
        if (cancelled) {
          callHook(onLeaveCancelled, [el])
        } else {
          callHook(onAfterLeave, [el])
        }
        el[leaveCbKey] = undefined
        unsetLeavingNodeCache(el)
      }
      setLeavingNodeCache(el)
      const done = el[leaveCbKey].bind(null, false)
      if (onLeave) {
        callAsyncHook(onLeave, [el, done])
      } else {
        done()
      }
    },

    clone(node) {
      return cloneHooks(node)
    },
  }

  return hooks
}

export function checkTransitionMode(mode) {
  if (
    __DEV__ &&
    mode &&
    mode !== 'in-out' &&
    mode !== 'out-in' &&
    mode !== 'default'
  ) {
    warn(`invalid <transition> mode: ${mode}`)
  }
}
