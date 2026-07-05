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
import { currentInstance, setCurrentInstance } from '../../internal/instance.js'
import { isAsyncWrapper } from '../../internal/asyncComponent.js'
import { warn } from '../../internal/warning.js'
import { vShowOriginalDisplay } from '../../internal/vShow.js'
import {
  applyTransitionHooks,
  deferBranchUpdateDuringLeave,
  displayName,
  registerTransitionHooks,
  removeBranchWithLeave,
} from '../transition.js'
import {
  DynamicFragment,
  ForBlock,
  ForFragment,
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

export const VaporTransition = decorate((props, { slots, expose }) => {
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
      applyPendingVShows(
        frag.$transition,
        resolveTransitionBlock(frag.nodes),
        pendingVShows,
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
    const { hooks, root } = applyResolvedTransitionHooks(children, appliedHooks)
    appliedHooks = hooks
    if (!isMounted) {
      isMounted = true
      applyPendingVShows(hooks, root, pendingVShows)
    }
  })
  return children
})

const transitionTypeMap = new WeakMap()
const inheritedTransitionKeyMap = new WeakMap()

let transitionKeyGeneration = 0
let currentTransitionKeyGeneration = 0

function getTransitionType(block) {
  const type = transitionTypeMap.get(block)
  if (type !== undefined) return type
  if (block instanceof Element) return block.localName
  return block
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

function applyTransitionHooksImpl(block, hooks) {
  return applyResolvedTransitionHooks(block, hooks).hooks
}

function applyResolvedTransitionHooks(block, hooks) {
  if (isArray(block)) {
    block = block.filter(b => !(b instanceof Comment))
    if (block.length === 1) {
      block = block[0]
    } else if (block.length === 0) {
      return { hooks }
    }
  }

  if (
    hooks.applyGroup &&
    (block instanceof ForFragment ||
      isSlotFragment(block) ||
      (isVaporComponent(block) && isSlotFragment(block.block)))
  ) {
    hooks.applyGroup(block, hooks.props, hooks.state, hooks.instance)
    return { hooks }
  }

  const fragments = []
  const child = resolveTransitionBlock(block, frag => fragments.push(frag))
  if (!child) {
    fragments.forEach(f => (f.$transition = hooks))
    if (__DEV__ && fragments.length === 0) {
      warn('Transition component has no valid child element')
    }
    return { hooks }
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
    resolvedHooks.persisted || (hooks.persisted && hasVShowMarker(child))
  resolvedHooks.delayedLeave = delayedLeave
  child.$transition = resolvedHooks
  fragments.forEach(f => (f.$transition = resolvedHooks))

  return {
    hooks: resolvedHooks,
    root: child,
  }
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
        setCurrentInstance(...prevInstance)
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
  return resolveTransitionChildren(block, { mode: 'single', onFragment })[0]
}

export function resolveTransitionBlocks(block, onFragment, onUpdateOwner) {
  return resolveTransitionChildren(block, {
    mode: 'group',
    onFragment,
    onUpdateOwner,
  })
}

function resolveTransitionChildren(block, options) {
  const children = []
  const prevGeneration = currentTransitionKeyGeneration
  currentTransitionKeyGeneration = ++transitionKeyGeneration
  try {
    collectTransitionBlocks(block, options, children)
    return children
  } finally {
    currentTransitionKeyGeneration = prevGeneration
  }
}

function collectTransitionBlocks(block, options, children) {
  if (block instanceof Node) {
    if (block instanceof Element) children.push(block)
  } else if (isVaporComponent(block)) {
    collectComponentTransitionBlocks(block, options, children)
  } else if (isArray(block)) {
    collectArrayTransitionBlocks(block, options, children)
  } else if (isFragment(block)) {
    collectFragmentTransitionBlocks(block, options, children)
  }
}

function collectComponentTransitionBlocks(block, options, children) {
  if (options.mode === 'group') {
    const isRootSlot = block.block && isSlotFragment(block.block)
    if (options.onUpdateOwner && !isRootSlot) options.onUpdateOwner(block)

    const start = children.length
    collectTransitionBlocks(
      block.block,
      isRootSlot
        ? options
        : {
            mode: options.mode,
            onFragment: options.onFragment,
          },
      children,
    )
    if (!isRootSlot) {
      for (let i = start; i < children.length; i++) {
        transitionTypeMap.set(children[i], block.type)
      }
    }
    inheritTransitionKey(children, start, block.$key)
    return
  }

  if (isAsyncWrapper(block)) {
    if (!block.type.__asyncResolved) {
      if (options.onFragment) options.onFragment(block.block)
      return
    }

    const start = children.length
    collectTransitionBlocks(block.block.nodes, options, children)
    inheritSingleComponentKey(children[start], block)
    return
  }

  if (block.type === VaporTransition) return

  const start = children.length
  collectTransitionBlocks(block.block, options, children)
  inheritSingleComponentKey(children[start], block)
}

function collectArrayTransitionBlocks(block, options, children) {
  if (options.mode === 'group') {
    for (let i = 0; i < block.length; i++) {
      const c = block[i]
      const start = children.length
      collectTransitionBlocks(c, options, children)
      if (c instanceof ForBlock) {
        const count = children.length - start
        for (let j = start; j < children.length; j++) {
          children[j].$key =
            c.key != null && count > 1 ? `${c.key}:${j - start}` : c.key
        }
      }
    }
    return
  }

  let hasFound = false
  for (let i = 0; i < block.length; i++) {
    const c = block[i]
    if (c instanceof Comment) continue
    const nested = []
    collectTransitionBlocks(c, options, nested)
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

function collectFragmentTransitionBlocks(block, options, children) {
  if (options.mode === 'group') {
    if (options.onFragment) options.onFragment(block)
    if (options.onUpdateOwner) options.onUpdateOwner(block)
    const start = children.length
    collectTransitionBlocks(block.nodes, options, children)
    inheritTransitionKey(children, start, block.$key)
    return
  }

  if (options.onFragment) options.onFragment(block)
  collectTransitionBlocks(block.nodes, options, children)
}

function inheritSingleComponentKey(child, block) {
  if (!child) return
  if (child.$key == null && block.$key != null) {
    child.$key = block.$key
  }
  transitionTypeMap.set(child, block.type)
}

function inheritTransitionKey(children, start, key) {
  if (key == null || start === children.length) return
  for (let i = start; i < children.length; i++) {
    const child = children[i]
    let record = inheritedTransitionKeyMap.get(child)
    let baseKey
    if (record && record.generation === currentTransitionKeyGeneration) {
      baseKey = child.$key != null ? child.$key : i - start
    } else {
      if (!record || !Object.is(child.$key, record.inheritedKey)) {
        record = {
          generation: currentTransitionKeyGeneration,
          rawBaseKey: child.$key != null ? child.$key : i - start,
          inheritedKey: '',
        }
        inheritedTransitionKeyMap.set(child, record)
      } else {
        record.generation = currentTransitionKeyGeneration
      }
      baseKey = record.rawBaseKey
    }
    record.inheritedKey = String(key) + String(baseKey)
    child.$key = record.inheritedKey
  }
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

function applyPendingVShows(hooks, root, pendingVShows) {
  if (!pendingVShows) return

  if (root) {
    hooks.persisted =
      hooks.persisted ||
      pendingVShows.some(
        pending =>
          pending.target === root ||
          resolveTransitionBlock(pending.target) === root,
      )
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
