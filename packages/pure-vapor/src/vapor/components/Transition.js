import { isArray } from '@vue/shared'
import { computed } from '@vue/reactivity'
import {
  baseResolveTransitionHooks,
  checkTransitionMode,
  leaveCbKey,
  useTransitionState,
} from '../../internal/baseTransition.js'
import {
  resolveTransitionProps,
  TransitionPropsValidators,
} from '../../internal/transitionDom.js'
import { onBeforeMount } from '../../internal/lifecycle.js'
import { queuePostFlushCb } from '../../internal/scheduler.js'
import {
  currentInstance,
  restoreCurrentInstance,
  setCurrentInstance,
} from '../../internal/instance.js'
import { isAsyncWrapper } from '../../internal/asyncComponent.js'
import { warn } from '../../internal/warning.js'
import { vShowOriginalDisplay } from '../../internal/vShow.js'
import {
  applyTransitionHooks,
  deferBranchUpdateDuringLeave,
  displayName,
  isVaporTransition,
  registerTransitionHooks,
  removeBranchWithLeave,
} from '../transition.js'
import {
  DynamicFragment,
  isDynamicFragment,
  isForFragment,
  isFragment,
  isSlotFragment,
} from '../fragment.js'
import { isValidBlock, remove } from '../block.js'
import { renderEffect } from '../renderEffect.js'
import { isVaporComponent } from '../component.js'
import { setCurrentPendingVShows } from '../directives/vShow.js'

let registered = false
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

const decorate = t => {
  t.displayName = displayName
  t.props = TransitionPropsValidators
  t.__vapor = true
  return t
}

export const VaporTransition =
  /*@__PURE__*/ decorate((props, { slots, expose }) => {
    expose()

    ensureTransitionHooksRegistered()

    const state = useTransitionState()
    const instance = currentInstance
    const { mode } = props
    if (__DEV__) checkTransitionMode(mode)

    const resolvedProps = computed(() => resolveTransitionProps(props))
    const propsProxy = new Proxy(
      {},
      {
        get(_, key) {
          return resolvedProps.value[key]
        },
      },
    )

    const shouldCaptureVShow = !!props.appear

    if (instance.rawSlots.$) {
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
        const [, pendingVShows] = capturePendingVShows(
          shouldCaptureVShow && !isMounted,
          () => frag.update(slots.default),
        )
        let hasStructuralRoot = false
        const root = resolveTransitionBlock(frag.nodes, fragment => {
          hasStructuralRoot =
            hasStructuralRoot || isStructuralTransitionFragment(fragment)
        })
        applyPendingVShows(
          frag.$transition,
          root,
          pendingVShows,
          hasStructuralRoot,
        )
        isMounted = true
      })
      return frag
    }

    const [children, pendingVShows] = capturePendingVShows(
      shouldCaptureVShow,
      () => (slots.default && slots.default()) || [],
    )

    let appliedHooks = {
      state,
      props: propsProxy,
      instance,
    }
    let isMounted = false
    renderEffect(() => {
      const { hooks, root, hasStructuralRoot } = applyResolvedTransitionHooks(
        children,
        appliedHooks,
      )
      appliedHooks = hooks
      if (!isMounted) {
        isMounted = true
        applyPendingVShows(hooks, root, pendingVShows, hasStructuralRoot)
      }
    })
    return children
  })

const transitionTypeMap = new WeakMap()

function getTransitionType(block) {
  const type = transitionTypeMap.get(block)
  if (type !== undefined) return type
  if (block instanceof Element) return block.localName
  return block
}

export function setTransitionType(block, type) {
  transitionTypeMap.set(block, type)
}

function getLeavingNodesForType(state, block) {
  const { leavingNodes } = state
  const type = getTransitionType(block)
  let nodes = leavingNodes.get(type)
  if (!nodes) {
    nodes = Object.create(null)
    leavingNodes.set(type, nodes)
  }
  return nodes
}

function getLeaveElement(block) {
  const el = getTransitionElement(block)
  if (el) return el
  if (
    isFragment(block) &&
    !isArray(block.nodes) &&
    (block.nodes instanceof Element || isFragment(block.nodes))
  ) {
    return getLeaveElement(block.nodes)
  }
}

function getTransitionHooksContext(block, props, state, instance, postClone) {
  const key = String(block.$key)
  const leavingNodes = getLeavingNodesForType(state, block)
  const context = {
    isLeaving: () => leavingNodes[key] === block,
    setLeavingNodeCache: () => {
      leavingNodes[key] = block
    },
    unsetLeavingNodeCache: () => {
      if (leavingNodes[key] === block) {
        delete leavingNodes[key]
      }
    },
    earlyRemove: () => {
      const leavingNode = leavingNodes[key]
      if (leavingNode && leavingNode.$key === block.$key) {
        const el = getLeaveElement(leavingNode)
        if (el && el[leaveCbKey]) {
          el[leaveCbKey]()
        }
      }
    },
    cloneHooks: b => {
      const hooks = resolveTransitionHooks(b, props, state, instance, postClone)
      if (postClone) postClone(hooks)
      return hooks
    },
  }
  return context
}

export function resolveTransitionHooks(
  block,
  props,
  state,
  instance,
  postClone,
) {
  const context = getTransitionHooksContext(
    block,
    props,
    state,
    instance,
    postClone,
  )
  const hooks = baseResolveTransitionHooks(context, props, state, instance)
  hooks.state = state
  hooks.props = props
  hooks.instance = instance
  return hooks
}

export function applyTransitionHooksImpl(block, hooks) {
  return applyResolvedTransitionHooks(block, hooks).hooks
}

function applyResolvedTransitionHooks(block, hooks) {
  if (isArray(block)) {
    block = block.filter(b => !(b instanceof Comment))
    if (block.length === 1) {
      block = block[0]
    } else if (block.length === 0) {
      return { hooks, hasStructuralRoot: false }
    }
  }

  if (
    hooks.applyGroup &&
    (isForFragment(block) ||
      isSlotFragment(block) ||
      (isVaporComponent(block) && isSlotFragment(block.block)))
  ) {
    hooks.applyGroup(block, hooks.props, hooks.state, hooks.instance)
    return { hooks, hasStructuralRoot: false }
  }

  const fragments = []
  let hasStructuralRoot = false
  const child = resolveTransitionBlock(block, fragment => {
    fragments.push(fragment)
    hasStructuralRoot =
      hasStructuralRoot || isStructuralTransitionFragment(fragment)
  })
  if (!child) {
    fragments.forEach(f => (f.$transition = hooks))
    if (__DEV__ && fragments.length === 0) {
      warn('Transition component has no valid child element')
    }
    return { hooks, hasStructuralRoot }
  }

  const { props, instance, state, delayedLeave } = hooks
  let resolvedHooks = resolveTransitionHooks(
    child,
    props,
    state,
    instance,
    h => (resolvedHooks = h),
  )
  resolvedHooks.persisted =
    resolvedHooks.persisted ||
    (!hasStructuralRoot && hooks.persisted && hasVShowMarker(child))
  resolvedHooks.delayedLeave = delayedLeave
  child.$transition = resolvedHooks
  fragments.forEach(f => (f.$transition = resolvedHooks))

  return {
    hooks: resolvedHooks,
    root: child,
    hasStructuralRoot,
  }
}

function isStructuralTransitionFragment(fragment) {
  return !!(
    isDynamicFragment(fragment) &&
    !isSlotFragment(fragment) &&
    fragment.inTransition
  )
}

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
    leavingHooks.delayLeave = (el, earlyRemove, delayedLeave) => {
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
      el[leaveCbKey] = () => {
        earlyRemove()
        el[leaveCbKey] = undefined
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

function deferBranchUpdateDuringLeaveImpl(frag, render, key, noScope) {
  const transition = frag.$transition
  if (!transition.state.isLeaving) return false
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
    const instance = currentInstance
    applyTransitionLeaveHooksImpl(frag.nodes, transition, () => {
      const prevInstance = setCurrentInstance(instance)
      try {
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
      } finally {
        restoreCurrentInstance(prevInstance)
      }
    })
    if (mode === 'out-in') {
      frag.current = key
      if (parent) remove(frag.nodes, parent)
      return true
    }
  }
  return false
}

export function resolveTransitionBlock(block, onFragment) {
  const children = []
  collectTransitionBlocks(block, onFragment, children)
  return children[0]
}

function collectTransitionBlocks(block, onFragment, children) {
  if (block instanceof Node) {
    if (block instanceof Element) children.push(block)
  } else if (isVaporComponent(block)) {
    collectComponentTransitionBlocks(block, onFragment, children)
  } else if (isArray(block)) {
    collectArrayTransitionBlocks(block, onFragment, children)
  } else if (isFragment(block)) {
    collectFragmentTransitionBlocks(block, onFragment, children)
  }
}

function collectComponentTransitionBlocks(block, onFragment, children) {
  if (isAsyncWrapper(block)) {
    if (!block.type.__asyncResolved) {
      if (onFragment) onFragment(block.block)
      return
    }

    const start = children.length
    collectTransitionBlocks(block.block.nodes, onFragment, children)
    inheritSingleComponentKey(children[start], block)
    return
  }

  if (isVaporTransition(block.type)) return

  const start = children.length
  collectTransitionBlocks(block.block, onFragment, children)
  inheritSingleComponentKey(children[start], block)
}

function collectArrayTransitionBlocks(block, onFragment, children) {
  let hasFound = false
  for (let i = 0; i < block.length; i++) {
    const c = block[i]
    if (c instanceof Comment) continue
    const nested = []
    collectTransitionBlocks(c, onFragment, nested)
    if (__DEV__ && hasFound) {
      warn(
        '<transition> can only be used on a single element or component. ' +
          'Use <transition-group> for lists.',
      )
      break
    }
    if (nested.length) children.push(nested[0])
    hasFound = true
    if (!__DEV__) break
  }
}

function collectFragmentTransitionBlocks(block, onFragment, children) {
  if (onFragment) onFragment(block)
  collectTransitionBlocks(block.nodes, onFragment, children)
}

function inheritSingleComponentKey(child, block) {
  if (!child) return
  if (child.$key == null && block.$key != null) {
    child.$key = block.$key
  }
  setTransitionType(child, block.type)
}

export function setTransitionHooks(block, hooks) {
  if (isVaporComponent(block)) {
    block = resolveTransitionBlock(block.block)
    if (!block) return
  }
  block.$transition = hooks
}

export function isValidTransitionBlock(block) {
  return block instanceof Element
}

export function getTransitionElement(block) {
  if (block instanceof Element) return block
}

function capturePendingVShows(enabled, render) {
  if (!enabled) {
    return [render(), undefined]
  }

  const pendingVShows = []
  const prev = setCurrentPendingVShows(pendingVShows)
  try {
    return [render(), pendingVShows]
  } finally {
    setCurrentPendingVShows(prev)
  }
}

function applyPendingVShows(hooks, root, pendingVShows, hasStructuralRoot) {
  if (!pendingVShows) return

  if (root) {
    hooks.persisted =
      hooks.persisted ||
      (!hasStructuralRoot &&
        pendingVShows.some(
          pending =>
            pending.target === root ||
            resolveTransitionBlock(pending.target) === root,
        ))
  }

  onBeforeMount(() => {
    let enterCbs
    pendingVShows.forEach(pending => {
      const enterCb = pending.apply()
      if (enterCb) {
        ;(enterCbs || (enterCbs = [])).push(enterCb)
      }
    })
    pendingVShows.length = 0
    if (enterCbs) {
      const cbs = enterCbs
      queuePostFlushCb(() => cbs.forEach(cb => cb()), -1)
    }
  })
}

function hasVShowMarker(block) {
  if (!block) return false
  if (block instanceof Element) return vShowOriginalDisplay in block
  if (isVaporComponent(block)) return hasVShowMarker(block.block)
  if (isArray(block)) return block.length === 1 && hasVShowMarker(block[0])
  if (isFragment(block)) return hasVShowMarker(block.nodes)
  return false
}
