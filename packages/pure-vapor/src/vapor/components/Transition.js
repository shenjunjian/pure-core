/**
 * VaporTransition component for pure-vapor.
 * Simplified version without VNode interop, hydration, and complex v-show logic.
 */

import { computed } from '@vue/reactivity'
import { isArray } from '@vue/shared'
import { renderEffect } from '../renderEffect.js'
import { getCurrentInstance } from '../../internal/instance.js'
import {
  useTransitionState,
  getLeavingNodesForType,
  checkTransitionMode,
} from '../../internal/transition.js'
import { registerTransitionHooks, displayName } from '../transition.js'
import { DynamicFragment, isFragment } from '../fragment.js'
import { resolveTransitionBlock } from './TransitionUtils.js'
import { remove } from '../block.js'
import { queuePostFlushCb } from '../../internal/scheduler.js'

// Transition props validators (simplified)
export const TransitionPropsValidators = {
  name: String,
  type: String,
  css: Boolean,
  duration: [String, Number, Object],
  enterFromClass: String,
  enterActiveClass: String,
  enterToClass: String,
  appearFromClass: String,
  appearActiveClass: String,
  appearToClass: String,
  leaveFromClass: String,
  leaveActiveClass: String,
  leaveToClass: String,
  mode: String,
  persisted: Boolean,
}

let registered = false

/**
 * Ensure transition hooks are registered with the transition module.
 */
export function ensureTransitionHooksRegistered() {
  if (!registered) {
    registered = true
    registerTransitionHooks(
      applyTransitionHooksImpl,
      deferBranchUpdateDuringLeaveImpl,
      removeBranchWithLeaveImpl,
    )
  }
}

/**
 * Resolve transition hooks for a block element.
 * @param {import('../block.js').TransitionBlock} block
 * @param {import('../block.js').TransitionProps} props
 * @param {import('../block.js').TransitionState} state
 * @param {import('../component.js').VaporComponentInstance} instance
 * @returns {import('../block.js').VaporTransitionHooks}
 */
export function resolveTransitionHooks(block, props, state, instance) {
  const key = String(block.$key ?? '')
  const leavingNodes = getLeavingNodesForType(state, getTransitionType(block))

  const callHook = (hook, args) => {
    if (typeof hook === 'function') {
      hook(...args)
    } else if (isArray(hook)) {
      hook.forEach(h => h(...args))
    }
  }

  const callAsyncHook = (hook, args) => {
    const done = args[args.length - 1]
    callHook(hook, args)
    // If hook doesn't accept callback (length <= 1), call done immediately
    if (isArray(hook)) {
      if (hook.every(h => h.length <= 1)) done()
    } else if (!hook || hook.length <= 1) {
      done()
    }
  }

  const hooks = {
    mode: props.mode,
    persisted: props.persisted,

    beforeEnter(el) {
      let hook = props.onBeforeEnter
      if (!state.isMounted && props.appear) {
        hook = props.onBeforeAppear || props.onBeforeEnter
      } else if (!state.isMounted) {
        return
      }

      // Cancel any ongoing leave
      if (el._leaveCb) {
        el._leaveCb(true) // cancelled
      }

      // Early remove previous leaving element with same key
      const leavingBlock = leavingNodes[key]
      if (leavingBlock && leavingBlock.$key === block.$key) {
        const leavingEl = getTransitionElement(leavingBlock)
        if (leavingEl && leavingEl._leaveCb) {
          leavingEl._leaveCb()
        }
      }

      callHook(hook, [el])
    },

    enter(el) {
      if (state.isLeaving) return

      let hook = props.onEnter
      let afterHook = props.onAfterEnter
      let cancelHook = props.onEnterCancelled

      if (!state.isMounted && props.appear) {
        hook = props.onAppear || props.onEnter
        afterHook = props.onAfterAppear || props.onAfterEnter
        cancelHook = props.onAppearCancelled || props.onEnterCancelled
      } else if (!state.isMounted) {
        return
      }

      let called = false
      el._enterCb = cancelled => {
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
        el._enterCb = undefined
      }

      const done = () => el._enterCb(false)
      if (hook) {
        callAsyncHook(hook, [el, done])
      } else {
        done()
      }
    },

    leave(el, remove) {
      if (el._enterCb) {
        el._enterCb(true) // cancelled
      }

      if (state.isUnmounting) {
        return remove()
      }

      callHook(props.onBeforeLeave, [el])

      let called = false
      el._leaveCb = cancelled => {
        if (called) return
        called = true
        remove()
        if (cancelled) {
          callHook(props.onLeaveCancelled, [el])
        } else {
          callHook(props.onAfterLeave, [el])
        }
        el._leaveCb = undefined
        if (leavingNodes[key] === block) {
          delete leavingNodes[key]
        }
      }

      leavingNodes[key] = block

      const done = () => el._leaveCb(false)
      if (props.onLeave) {
        callAsyncHook(props.onLeave, [el, done])
      } else {
        done()
      }
    },

    clone(newBlock) {
      return resolveTransitionHooks(newBlock, props, state, instance)
    },
  }

  return hooks
}

export {
  resolveTransitionBlock,
  resolveTransitionBlocks,
} from './TransitionUtils.js'

/**
 * Get transition element from a block
 * @param {import('../block.js').TransitionBlock} block
 * @returns {Element|undefined}
 */
export function getTransitionElement(block) {
  if (block instanceof Element) return block

  if (isFragment(block)) {
    return getTransitionElement(block.nodes)
  }

  return undefined
}

/**
 * Get transition type for caching
 * @param {import('../block.js').TransitionBlock} block
 * @returns {any}
 */
function getTransitionType(block) {
  if (block instanceof Element) {
    return block.localName
  }
  return block
}

/**
 * Apply resolved transition hooks to a block
 * @param {import('../block.js').Block} block
 * @param {import('../block.js').VaporTransitionHooks} hooks
 * @returns {import('../block.js').VaporTransitionHooks}
 */
function applyTransitionHooksImpl(block, hooks) {
  return applyResolvedTransitionHooks(block, hooks).hooks
}

function applyResolvedTransitionHooks(block, hooks) {
  // Filter out comment nodes
  if (isArray(block)) {
    block = block.filter(b => !(b instanceof Comment))
    if (block.length === 1) {
      block = block[0]
    } else if (block.length === 0) {
      return { hooks }
    }
  }

  const child = resolveTransitionBlock(block)
  if (!child) {
    return { hooks }
  }

  const { props, instance, state } = hooks
  const resolvedHooks = resolveTransitionHooks(child, props, state, instance)

  child.$transition = resolvedHooks
  return {
    hooks: resolvedHooks,
    root: child,
  }
}

/**
 * Apply leave transition hooks
 * @param {import('../block.js').Block} block
 * @param {import('../block.js').VaporTransitionHooks} enterHooks
 * @param {function(): void} afterLeaveCb
 */
function applyTransitionLeaveHooksImpl(block, enterHooks, afterLeaveCb) {
  const leavingBlock = resolveTransitionBlock(block)
  if (!leavingBlock) return

  const { props, state, instance } = enterHooks
  const leavingHooks = resolveTransitionHooks(
    leavingBlock,
    props,
    state,
    instance,
  )
  leavingBlock.$transition = leavingHooks

  const { mode } = props
  if (mode === 'out-in') {
    state.isLeaving = true
    leavingHooks.afterLeave = () => {
      state.isLeaving = false
      afterLeaveCb()
      leavingBlock.$transition = undefined
      delete leavingHooks.afterLeave
    }
  } else if (mode === 'in-out') {
    leavingHooks.delayedLeave = (el, earlyRemove, delayedLeave) => {
      const leavingNodes = getLeavingNodesForType(state, leavingBlock)
      const leavingKey = String(leavingBlock.$key)
      leavingNodes[leavingKey] = leavingBlock

      const delayedLeaveCb = () => {
        delayedLeave()
        leavingBlock.$transition = undefined
        if (enterHooks.delayedLeave === delayedLeaveCb) {
          delete enterHooks.delayedLeave
        }
      }

      el._leaveCb = () => {
        earlyRemove()
        el._leaveCb = undefined
        leavingBlock.$transition = undefined
        if (leavingNodes[leavingKey] === leavingBlock) {
          delete leavingNodes[leavingKey]
        }
        if (enterHooks.delayedLeave === delayedLeaveCb) {
          delete enterHooks.delayedLeave
        }
      }

      enterHooks.delayedLeave = delayedLeaveCb
    }
  }
}

/**
 * Defer branch update during leave animation
 */
function deferBranchUpdateDuringLeaveImpl(frag, render, key, noScope) {
  const transition = frag.$transition
  if (!transition || !transition.state || !transition.state.isLeaving) {
    return false
  }

  frag.current = key
  const pending = frag.pending
  if (pending) {
    pending.render = render
    pending.key = key
    pending.noScope = noScope
  } else {
    frag.pending = { render, key, noScope }
  }
  return true
}

/**
 * Remove branch with leave animation
 */
function removeBranchWithLeaveImpl(
  frag,
  transition,
  parent,
  render,
  key,
  noScope,
) {
  const mode = transition.mode
  if (
    mode &&
    (mode !== 'in-out' || render) &&
    (mode !== 'out-in' || isValidBlock(frag.nodes))
  ) {
    applyTransitionLeaveHooksImpl(frag.nodes, transition, () => {
      const pending = frag.pending
      if (pending) {
        frag.pending = undefined
        frag.renderBranch(
          pending.render,
          transition,
          parent,
          pending.key,
          pending.noScope,
          true,
        )
      } else {
        frag.renderBranch(render, transition, parent, key, noScope, true)
      }
    })

    if (mode === 'out-in') {
      frag.current = key
      if (parent) {
        remove(frag.nodes, parent)
      }
      return true
    }
  }
  return false
}

function isValidBlock(block) {
  if (!block) return false
  if (block instanceof Node) return !(block instanceof Comment)
  if (isArray(block)) return block.length > 0
  return true
}

/**
 * VaporTransition functional component
 */
export const VaporTransition = /*@__PURE__*/ (props, { slots }) => {
  // Register transition hooks on first use
  ensureTransitionHooksRegistered()

  const instance = getCurrentInstance()
  const state = useTransitionState()
  const { mode } = props

  __DEV__ && checkTransitionMode(mode)

  // Create a proxy to keep props reference stable
  const resolvedProps = computed(() => ({ ...props }))
  const propsProxy = new Proxy(
    {},
    {
      get(_, key) {
        return resolvedProps.value[key]
      },
    },
  )

  // Always use DynamicFragment to handle reactive slot changes (v-if, etc.)
  const frag = new DynamicFragment('transition')
  let isMounted = false

  renderEffect(() => {
    if (!frag.$transition) {
      frag.$transition = resolveTransitionHooks(
        frag,
        propsProxy,
        state,
        instance,
      )
    } else {
      frag.$transition.mode = resolvedProps.value.mode
    }

    // Update the fragment with current slot content
    // IMPORTANT: We must pass a unique key when slot content changes,
    // otherwise DynamicFragment.update() will skip the update due to key equality check.
    const children = slots.default ? slots.default() : []

    // Use the first child's reference as key to detect content changes
    // When v-if toggles, children changes from [] to [element] or vice versa
    const key = children.length > 0 ? children[0] : null
    frag.update(() => children, key)

    // Handle appear animation
    if (!isMounted && props.appear) {
      const root = resolveTransitionBlock(frag.nodes)
      if (root && root.$transition) {
        const el = getTransitionElement(root)
        if (el) {
          root.$transition.beforeEnter(el)
          queuePostFlushCb(() => root.$transition.enter(el))
        }
      }
    }
    isMounted = true
  })

  return frag
}

VaporTransition.displayName = displayName
VaporTransition.props = TransitionPropsValidators
VaporTransition.__vapor = true
