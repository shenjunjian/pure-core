import { EffectScope, setActiveSub } from '@vue/reactivity'
import { isArray } from '@vue/shared'
import {
  getKeepAliveContext,
  isKeepAliveEnabled,
  setCurrentKeepAliveCtx,
} from './keepAlive.js'
import { setBlockKey } from './helpers/setKey.js'
import { createComment, createTextNode } from './dom/node.js'
import { insert, remove, isValidSlot } from './block.js'
import {
  applyTransitionHooks,
  deferBranchUpdateDuringLeave,
  isTransitionEnabled,
  isVaporTransition,
  removeBranchWithLeave,
} from './transition.js'
import {
  currentInstance,
  restoreCurrentInstance,
  setCurrentInstance,
} from '../internal/instance.js'
import { currentSlotOwner, setCurrentSlotOwner } from './componentSlots.js'
import { isVaporComponent } from './component.js'
import {
  currentSlotBoundary,
  setCurrentSlotBoundary,
  trackSlotBoundaryDirtying,
  withSlotBoundary,
} from './slotBoundary.js'
import {
  disposeSlotResolution,
  markSlotResolutionDirty,
  recheckSlotResolution,
} from './slotFragment.js'

export class VaporFragment {
  constructor(nodes) {
    this.nodes = nodes
    this.renderInstance = currentInstance
    this.slotOwner = currentSlotOwner
    this.slotBoundary = currentSlotBoundary
    if (isKeepAliveEnabled) {
      this.keepAliveCtx = getKeepAliveContext(currentInstance)
    }
  }

  runWithRenderCtx(fn, scope) {
    const prevInstance = setCurrentInstance(this.renderInstance, scope)
    const prevSlotOwner = setCurrentSlotOwner(this.slotOwner)
    const prevBoundary = setCurrentSlotBoundary(this.slotBoundary)
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
      setCurrentSlotBoundary(prevBoundary)
      setCurrentSlotOwner(prevSlotOwner)
      restoreCurrentInstance(prevInstance)
    }
  }
}

export class ForFragment extends VaporFragment {
  constructor(nodes, trackSlotBoundary = false, onInvalid) {
    super(nodes)
    if (trackSlotBoundary) trackSlotBoundaryDirtying(this, onInvalid)
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
  constructor(
    anchorLabel,
    keyed = false,
    locate = true,
    trackSlotBoundary = false,
    onInvalid,
  ) {
    super([])
    if (keyed) this.keyed = true
    if (
      isTransitionEnabled &&
      currentInstance &&
      isVaporTransition(currentInstance.type)
    ) {
      this.inTransition = true
    }
    this.anchor =
      __DEV__ && anchorLabel ? createComment(anchorLabel) : createTextNode()
    if (__DEV__) this.anchorLabel = anchorLabel
    if (trackSlotBoundary) trackSlotBoundaryDirtying(this, onInvalid)
  }

  getBranchParent() {
    return this.anchor.parentNode
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
    const parent = this.getBranchParent()

    if (wasMounted) {
      const scope = this.scope
      if (scope) {
        let retainScope = false
        const onBeforeRemove = this.onBeforeRemove
        if (onBeforeRemove) {
          for (let i = 0; i < onBeforeRemove.length; i++) {
            retainScope = onBeforeRemove[i](scope) || retainScope
          }
        }
        if (!retainScope) {
          scope.stop()
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
      restoreCurrentInstance(prevInstance)
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
        const scope =
          keepAliveCtx && keepAliveCtx.acquireBranchScope(this.current)
        if (scope) {
          this.scope = scope
        } else {
          this.scope = new EffectScope()
        }
      } else {
        this.scope = undefined
      }

      const renderBranch = () => {
        try {
          this.nodes =
            this.runWithRenderCtx(
              () => (useScope ? this.scope.run(render) : render()) || [],
              this.scope,
            ) || []
        } finally {
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
        }
      }

      if (keepAliveCtx) {
        keepAliveCtx.runBranchRender(this, renderBranch)
      } else {
        renderBranch()
      }

      if (parent) {
        const onBeforeInsert = this.onBeforeInsert
        if (onBeforeInsert) {
          for (let i = 0; i < onBeforeInsert.length; i++) {
            onBeforeInsert[i](this.nodes)
          }
        }
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

export class SlotFragment extends DynamicFragment {
  constructor(notifyParentBoundary = false) {
    super(__DEV__ ? 'slot' : undefined, false, false)
    this.isSlot = true
    this.disposed = false
    this.forwarded = false
    this.activeFallback = null
    this.pendingRecheck = false
    this.pendingRecheckForce = false
    this.isRenderingFallback = false
    this.onContentInvalid = []
    this.content = []
    this.isUpdating = false
    this.notifyParentBoundary = notifyParentBoundary
    this.insert = (parent, anchor) => this.insertSlot(parent, anchor)
    this.remove = parent => this.removeSlot(parent)
  }

  get boundary() {
    if (!this.ownBoundary) {
      const owner = this
      this.ownBoundary = {
        get parent() {
          return owner.slotBoundary
        },
        getFallback: () => owner.localFallback,
        run: (fn, scope) => owner.runWithRenderCtx(fn, scope),
        markDirty: force => markSlotResolutionDirty(owner, force),
        onContentInvalid: owner.onContentInvalid,
      }
    }
    return this.ownBoundary
  }

  insertSlot(parent, anchor) {
    this.disposed = false
    insert(this.nodes, parent, anchor)
  }

  removeSlot(parent) {
    this.disposed = true
    const nodes = this.nodes
    remove(nodes, parent)
    if (this.activeFallback === nodes) {
      this.activeFallback = null
    }
    this.onContentInvalid.length = 0
    disposeSlotResolution(this)
  }

  getBranchParent() {
    return this.activeFallback ? null : super.getBranchParent()
  }

  updateContent(render, key) {
    if (key !== this.current) {
      this.onContentInvalid.length = 0
    }
    this.nodes = this.content
    this.update(render, key)
    this.content = this.nodes
  }

  updateSlot(render, fallback, key = render || fallback) {
    const prevLocalFallback = this.localFallback
    this.localFallback = fallback
    const boundary = this.boundary
    const slotRender = render
      ? () => withSlotBoundary(boundary, render)
      : () => []
    this.isUpdating = true
    this.pendingRecheck = false

    try {
      const shouldForce = prevLocalFallback !== fallback
      this.updateContent(slotRender, key)
      recheckSlotResolution(this, shouldForce || this.pendingRecheckForce)
    } finally {
      this.pendingRecheck = false
      this.pendingRecheckForce = false
      this.isUpdating = false
    }
  }

  getContent() {
    return this.content
  }

  getParentNode() {
    return this.anchor ? this.anchor.parentNode : null
  }

  getAnchor() {
    return this.anchor || null
  }

  isBusy() {
    return this.isUpdating
  }

  isDisposed() {
    return this.disposed
  }

  isContentValid() {
    return isValidSlot(this.content)
  }

  syncNodes() {
    this.nodes = this.activeFallback || this.content
  }

  notifyExposedValidityChange() {
    if (this.notifyParentBoundary && this.slotBoundary) {
      this.slotBoundary.markDirty()
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

export function isForFragment(val) {
  return isFragment(val) && typeof val.onReset === 'function'
}

export function isForBlock(val) {
  return isFragment(val) && val.itemRef !== undefined
}

export { withSlotBoundary, currentSlotBoundary, setCurrentSlotBoundary }
