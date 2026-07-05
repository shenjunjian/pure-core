import { EffectScope, setActiveSub } from '@vue/reactivity'
import { isArray } from '@vue/shared'
import {
  currentKeepAliveCtx,
  isKeepAliveEnabled,
  setCurrentKeepAliveCtx,
  withCurrentCacheKey,
} from './keepAlive.js'
import { setBlockKey } from './helpers/setKey.js'
import { createComment, createTextNode } from './dom/node.js'
import { insert, remove, isValidBlock } from './block.js'
import {
  applyTransitionHooks,
  deferBranchUpdateDuringLeave,
  isTransitionEnabled,
  isVaporTransition,
  removeBranchWithLeave,
} from './transition.js'
import { currentInstance, setCurrentInstance } from '../internal/instance.js'
import { renderEffect } from './renderEffect.js'
import { currentSlotOwner, setCurrentSlotOwner } from './componentSlots.js'
import { isVaporComponent } from './component.js'

export class VaporFragment {
  constructor(nodes) {
    this.nodes = nodes
    this.renderInstance = currentInstance
    this.slotOwner = currentSlotOwner
    if (isKeepAliveEnabled) {
      this.keepAliveCtx = currentKeepAliveCtx
    }
  }

  runWithRenderCtx(fn, scope) {
    const prevInstance = setCurrentInstance(this.renderInstance, scope)
    const prevSlotOwner = setCurrentSlotOwner(this.slotOwner)
    let prevKeepAliveCtx = null
    if (isKeepAliveEnabled) {
      prevKeepAliveCtx = setCurrentKeepAliveCtx(this.keepAliveCtx || null)
    }
    try {
      return fn()
    } finally {
      if (isKeepAliveEnabled) {
        setCurrentKeepAliveCtx(prevKeepAliveCtx)
      }
      setCurrentSlotOwner(prevSlotOwner)
      setCurrentInstance(...prevInstance)
    }
  }
}

export class ForFragment extends VaporFragment {
  constructor(nodes) {
    super(nodes)
  }

  onReset(fn) {
    ;(this.resetListeners || (this.resetListeners = [])).push(fn)
  }
}

export class ForBlock extends VaporFragment {
  constructor(nodes, scope, item, key, index, renderKey) {
    super(nodes)
    this.scope = scope
    this.itemRef = item
    this.keyRef = key
    this.indexRef = index
    this.key = renderKey
  }
}

export class DynamicFragment extends VaporFragment {
  constructor(anchorLabel, keyed = false) {
    super([])
    this.keyed = keyed
    this.anchor =
      __DEV__ && anchorLabel ? createComment(anchorLabel) : createTextNode()
    if (__DEV__) this.anchorLabel = anchorLabel
    if (
      isTransitionEnabled &&
      currentInstance &&
      isVaporTransition(currentInstance.type)
    ) {
      this.inTransition = true
    }
  }

  update(render, key = render, noScope = false) {
    if (key === this.current) {
      return
    }

    const transition = isTransitionEnabled ? this.$transition : undefined
    const wasMounted = this.current !== undefined
    if (wasMounted) {
      const onBeforeUpdate = this.onBeforeUpdate
      if (onBeforeUpdate) {
        for (let i = 0; i < onBeforeUpdate.length; i++) {
          onBeforeUpdate[i]()
        }
      }
    }
    if (
      transition &&
      deferBranchUpdateDuringLeave(this, render, key, noScope)
    ) {
      return
    }

    const instance = currentInstance
    const prevSub = setActiveSub()
    const parent = this.anchor.parentNode

    if (wasMounted) {
      if (this.scope) {
        if (isKeepAliveEnabled) {
          let retainScope = false
          const keepAliveCtx = this.keepAliveCtx
          if (keepAliveCtx) {
            const cacheKey = this.keyed
              ? withCurrentCacheKey(this.current, () =>
                  keepAliveCtx.processShapeFlag(this.nodes),
                )
              : keepAliveCtx.processShapeFlag(this.nodes)
            if (cacheKey !== false) {
              keepAliveCtx.cacheScope(cacheKey, this.current, this.scope)
              retainScope = true
            }
          }
          if (!retainScope) {
            this.scope.stop()
          }
        } else {
          this.scope.stop()
        }
      }
      if (
        transition &&
        removeBranchWithLeave(this, transition, parent, render, key, noScope)
      ) {
        setActiveSub(prevSub)
        return
      }
      if (parent) remove(this.nodes, parent)
    }

    const prevInstance = setCurrentInstance(instance)
    try {
      this.renderBranch(
        render,
        transition,
        parent,
        key,
        noScope,
        wasMounted || !!parent,
      )
    } finally {
      setCurrentInstance(...prevInstance)
    }
    setActiveSub(prevSub)
  }

  renderBranch(
    render,
    transition,
    parent,
    key,
    noScope = false,
    notifyUpdated = !!parent,
  ) {
    this.current = key
    if (render) {
      const keepAliveCtx = isKeepAliveEnabled ? this.keepAliveCtx : null
      const useScope = !noScope || !!this.hasFallthroughAttrs
      if (useScope) {
        const scope = keepAliveCtx && keepAliveCtx.getScope(this.current)
        if (scope) {
          this.scope = scope
        } else {
          this.scope = new EffectScope()
        }
      } else {
        this.scope = undefined
      }

      const renderBranch = () => {
        this.nodes =
          this.runWithRenderCtx(
            () => (useScope ? this.scope.run(render) : render()) || [],
            this.scope,
          ) || []
        const blockKey = this.keyed ? this.current : this.$key
        if (
          blockKey !== undefined &&
          (transition || this.inTransition || keepAliveCtx)
        ) {
          setBlockKey(this.nodes, blockKey)
        }
        if (isTransitionEnabled && transition) {
          this.$transition = applyTransitionHooks(this.nodes, transition)
        }
        if (keepAliveCtx) {
          keepAliveCtx.processShapeFlag(this.nodes)
        }
      }

      if (keepAliveCtx && this.keyed) {
        withCurrentCacheKey(key, renderBranch)
      } else {
        renderBranch()
      }

      if (parent) {
        insert(this.nodes, parent, this.anchor)
      }
    } else {
      this.scope = undefined
      this.nodes = []
    }

    if (notifyUpdated && parent && this.onUpdated) {
      for (let i = 0; i < this.onUpdated.length; i++) {
        this.onUpdated[i](this.nodes)
      }
    }
  }
}

export function isFragment(val) {
  return val instanceof VaporFragment
}

export function isDynamicFragment(val) {
  return val instanceof DynamicFragment
}

export function isSlotFragment(val) {
  return isDynamicFragment(val) && !!val.isSlot
}

// ---------------------------------------------------------------------------
// Slot fallback (non-hydration)
// ---------------------------------------------------------------------------

let currentSlotBoundary = null

export function getCurrentSlotBoundary() {
  return currentSlotBoundary
}

export function setCurrentSlotBoundary(b) {
  const prev = currentSlotBoundary
  currentSlotBoundary = b
  return prev
}

export function withOwnedSlotBoundary(boundary, fn) {
  const prev = setCurrentSlotBoundary(boundary)
  try {
    return fn()
  } finally {
    setCurrentSlotBoundary(prev)
  }
}

function getRedirectedBoundary(boundary) {
  if (boundary.redirected) {
    return boundary.redirected
  }
  return (boundary.redirected = {
    get parent() {
      return boundary.parent
    },
    getFallback: () => undefined,
    run: (fn, scope) => boundary.run(fn, scope),
    markDirty: () => boundary.markDirty(),
  })
}

function walkSlotFallbackBlock(block, node, fragment) {
  if (block instanceof Node) {
    return node(block)
  }

  if (isVaporComponent(block)) {
    return walkSlotFallbackBlock(block.block, node, fragment)
  }

  if (isArray(block)) {
    for (let i = 0; i < block.length; i++) {
      if (walkSlotFallbackBlock(block[i], node, fragment)) {
        return true
      }
    }
    return false
  }

  return fragment(block, block => walkSlotFallbackBlock(block, node, fragment))
}

export function resolveSlotFallbackCarrierOwner(block) {
  let owner = null
  walkSlotFallbackBlock(
    block,
    () => false,
    block => {
      owner = block
      return true
    },
  )
  return owner
}

function findFirstSlotFallbackCarrierNode(block) {
  let node = null
  walkSlotFallbackBlock(
    block,
    value => {
      node = value
      return true
    },
    (block, walk) => {
      if (walk(block.nodes)) {
        return true
      }
      if (block.anchor) {
        node = block.anchor
        return true
      }
      return false
    },
  )
  return node
}

function collectBlockNodes(block, nodes, includeComments) {
  walkSlotFallbackBlock(
    block,
    block => {
      if (includeComments || !(block instanceof Comment)) {
        nodes.push(block)
      }
      return false
    },
    block => {
      collectBlockNodes(block.nodes, nodes, true)
      if (block.anchor) {
        nodes.push(block.anchor)
      }
      return false
    },
  )
  return nodes
}

export function mutateSlotFallbackCarrier(block, apply) {
  walkSlotFallbackBlock(
    block,
    block => {
      if (!(block instanceof Comment)) {
        apply(block)
      }
      return false
    },
    block => {
      apply(block)
      return false
    },
  )
}

function hasSlotFallback(boundary) {
  while (boundary) {
    if (boundary.getFallback()) {
      return true
    }
    boundary = boundary.parent
  }
  return false
}

function renderSlotFallbackBlock(boundary, scope, args) {
  if (!boundary) {
    return [[], false]
  }

  const localFallback = boundary.getFallback()
  if (!localFallback) {
    return renderSlotFallbackBlock(boundary.parent, scope, args)
  }

  const renderFallback = () =>
    withOwnedSlotBoundary(getRedirectedBoundary(boundary), () =>
      localFallback(...args),
    )
  const local = boundary.run(
    () => (scope ? scope.run(renderFallback) : renderFallback()) || [],
    scope,
  )
  if (isValidBlock(local)) {
    return [local, true]
  }

  const inherited = renderSlotFallbackBlock(boundary.parent, scope, args)[0]
  return [
    resolveSlotFallbackCarrierOwner(local) ? [inherited, local] : inherited,
    true,
  ]
}

function renderSlotFallback(boundary, scope, ...args) {
  const result = renderSlotFallbackBlock(boundary || null, scope, args)
  return result[1] ? result[0] : undefined
}

function getSlotEffectiveOutput(outlet) {
  return outlet.activeFallback || outlet.getContent()
}

function isSlotFallbackContentValid(outlet) {
  return outlet.isContentValid
    ? outlet.isContentValid()
    : isValidBlock(outlet.getContent())
}

export function markSlotFallbackDirty(outlet) {
  if (outlet.isDisposed && outlet.isDisposed()) {
    return
  }
  if (outlet.isRenderingFallback) {
    outlet.pendingRecheck = true
    return
  }
  if (outlet.isBusy && outlet.isBusy()) {
    outlet.pendingRecheck = true
    return
  }
  recheckSlotFallback(outlet, true)
}

function clearSlotFallback(outlet) {
  if (outlet.activeFallback) {
    const parentNode = outlet.getParentNode()
    if (parentNode) {
      remove(outlet.activeFallback, parentNode)
    }
    outlet.activeFallback = null
  }
  if (outlet.fallbackScope) {
    outlet.fallbackScope.stop()
    outlet.fallbackScope = undefined
  }
}

function renderSlotFallbackForOutlet(outlet) {
  const scope = new EffectScope()
  let renderedFallback
  outlet.isRenderingFallback = true
  try {
    renderedFallback = renderSlotFallback(outlet.boundary, scope) || undefined
  } catch (err) {
    scope.stop()
    throw err
  } finally {
    outlet.isRenderingFallback = false
  }

  if (!renderedFallback) {
    scope.stop()
    return { found: false }
  }

  return {
    found: true,
    block: renderedFallback,
    scope,
  }
}

function syncSlotFallbackOrder(outlet, block) {
  if (!isFragment(block) || !isArray(block.nodes) || block.nodes.length < 2) {
    return
  }

  const carrierNodes = collectBlockNodes(outlet.getContent(), [], true)
  const fallbackNodes = collectBlockNodes(block, [], true)
  const lastNode = fallbackNodes[fallbackNodes.length - 1]
  if (!carrierNodes.length || !lastNode) {
    return
  }

  const parentNode = carrierNodes[0].parentNode
  if (!parentNode || lastNode.parentNode !== parentNode) {
    return
  }

  let inOrder = true
  let nextNode = lastNode.nextSibling
  for (let i = 0; i < carrierNodes.length; i++) {
    const carrierNode = carrierNodes[i]
    if (carrierNode.parentNode !== parentNode) {
      return
    }
    if (carrierNode !== nextNode) {
      inOrder = false
      break
    }
    nextNode = carrierNode.nextSibling
  }

  if (inOrder) {
    return
  }

  let anchor = lastNode.nextSibling
  for (let i = carrierNodes.length - 1; i >= 0; i--) {
    const carrierNode = carrierNodes[i]
    parentNode.insertBefore(carrierNode, anchor)
    anchor = carrierNode
  }
}

function ensureSlotFallbackOrderHook(outlet, block) {
  if (!isFragment(block)) {
    return
  }

  if (block.hasSlotFallbackOrderHook) {
    return
  }

  ;(block.onUpdated || (block.onUpdated = [])).push(() =>
    syncSlotFallbackOrder(outlet, block),
  )
  block.hasSlotFallbackOrderHook = true
}

function insertActiveSlotFallback(outlet) {
  if (!outlet.activeFallback) {
    return
  }
  const parentNode = outlet.getParentNode()
  if (!parentNode) {
    return
  }
  const carrierAnchor = findFirstSlotFallbackCarrierNode(outlet.getContent())
  insert(
    outlet.activeFallback,
    parentNode,
    carrierAnchor && carrierAnchor.parentNode === parentNode
      ? carrierAnchor
      : outlet.getAnchor(),
  )
}

function commitSlotFallback(outlet, block, scope) {
  outlet.activeFallback = block
  outlet.fallbackScope = scope
  ensureSlotFallbackOrderHook(outlet, block)
  insertActiveSlotFallback(outlet)
}

function disposeSlotFallback(outlet) {
  clearSlotFallback(outlet)
  outlet.pendingRecheck = false
  outlet.lastEffectiveValid = undefined
}

function recheckSlotFallback(outlet, force) {
  if (outlet.isRenderingFallback) {
    outlet.pendingRecheck = true
    return
  }

  const prevValid =
    outlet.lastEffectiveValid === undefined
      ? outlet.activeFallback
        ? isValidBlock(outlet.activeFallback)
        : isSlotFallbackContentValid(outlet)
      : outlet.lastEffectiveValid
  const contentValid = isSlotFallbackContentValid(outlet)

  if (contentValid) {
    clearSlotFallback(outlet)
  } else {
    if (force) {
      clearSlotFallback(outlet)
    }
    if (outlet.activeFallback) {
      insertActiveSlotFallback(outlet)
    } else {
      const result = renderSlotFallbackForOutlet(outlet)
      if (result.found) {
        commitSlotFallback(outlet, result.block, result.scope)
        if (
          outlet.pendingRecheck &&
          outlet.rerunRecheckAfterFallbackRender !== false
        ) {
          outlet.pendingRecheck = false
          recheckSlotFallback(outlet, true)
        }
      } else {
        clearSlotFallback(outlet)
      }
    }
  }

  const nextValid = outlet.activeFallback
    ? isValidBlock(outlet.activeFallback)
    : isSlotFallbackContentValid(outlet)
  if (outlet.syncEffectiveOutput) {
    outlet.syncEffectiveOutput()
  }
  outlet.lastEffectiveValid = nextValid
  if (prevValid !== nextValid) {
    outlet.notifyFallbackValidityChange()
  }
}

export class SlotFragment extends DynamicFragment {
  constructor() {
    super(__DEV__ ? 'slot' : undefined, false)
    this.isSlot = true
    this.disposed = false
    this.forwarded = false
    this.parentSlotBoundary = getCurrentSlotBoundary()
    this.activeFallback = null
    this.pendingRecheck = false
    this.isRenderingFallback = false
    this.rerunRecheckAfterFallbackRender = false
    this.insert = (parent, anchor) => this.insertSlot(parent, anchor)
    this.remove = parent => this.removeSlot(parent)
  }

  ensureSlotFallbackBoundary() {
    if (this._slotFallbackBoundary) {
      return this._slotFallbackBoundary
    }
    const owner = this
    return (this._slotFallbackBoundary = {
      get parent() {
        return owner.parentSlotBoundary
      },
      getFallback: () => owner.localFallback,
      run: (fn, scope) => owner.runWithRenderCtx(fn, scope),
      markDirty: () => markSlotFallbackDirty(owner),
    })
  }

  get fallbackBlock() {
    return this.activeFallback
  }

  get boundary() {
    return this.slotFallbackBoundary
  }

  get slotFallbackBoundary() {
    return this.ensureSlotFallbackBoundary()
  }

  getEffectiveOutput() {
    return getSlotEffectiveOutput(this)
  }

  insertSlot(parent, anchor) {
    this.disposed = false
    if (this.fallbackBlock) {
      insert(this.fallbackBlock, parent, anchor)
      mutateSlotFallbackCarrier(this.nodes, block =>
        insert(block, parent, anchor),
      )
      return
    }
    insert(this.nodes, parent, anchor)
  }

  removeSlot(parent) {
    this.disposed = true
    if (this.fallbackBlock) {
      mutateSlotFallbackCarrier(this.nodes, block => remove(block, parent))
    } else {
      remove(this.nodes, parent)
    }
    disposeSlotFallback(this)
  }

  updateSlot(render, fallback, key) {
    const prevLocalFallback = this.localFallback
    this.localFallback = fallback
    const fallbackChanged = prevLocalFallback !== fallback
    const fastSlotKey = key === undefined ? render : key

    if (!fallback && !this.parentSlotBoundary && !this._slotFallbackBoundary) {
      this.update(render, fastSlotKey)
      return
    }

    const boundary = this.slotFallbackBoundary
    const slotRender = render
      ? () => withOwnedSlotBoundary(boundary, render)
      : () => []
    const slotKey = key === undefined ? slotRender : key
    this.isUpdatingSlot = true
    this.pendingRecheck = false

    try {
      const shouldForce = fallbackChanged
      this.update(slotRender, slotKey)
      recheckSlotFallback(this, shouldForce)
    } finally {
      this.pendingRecheck = false
      this.isUpdatingSlot = false
    }
  }

  getContent() {
    return this.nodes
  }

  getParentNode() {
    return this.anchor ? this.anchor.parentNode : null
  }

  getAnchor() {
    return this.anchor || null
  }

  isBusy() {
    return this.isUpdatingSlot
  }

  isDisposed() {
    return this.disposed
  }

  notifyFallbackValidityChange() {
    if (this.parentSlotBoundary) {
      this.parentSlotBoundary.markDirty()
    }
  }
}
