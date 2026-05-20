import { EffectScope, setActiveSub } from '@vue/reactivity'
import { createComment, createTextNode } from './dom/node.js'
import { insert, remove } from './block.js'
import { currentInstance, setCurrentInstance } from '../internal/instance.js'
import { renderEffect } from './renderEffect.js'
import { currentSlotOwner, setCurrentSlotOwner } from './componentSlots.js'

export class VaporFragment {
  constructor(nodes) {
    this.nodes = nodes
    this.renderInstance = currentInstance
    this.slotOwner = currentSlotOwner
  }

  runWithRenderCtx(fn, scope) {
    const prevInstance = setCurrentInstance(this.renderInstance, scope)
    const prevSlotOwner = setCurrentSlotOwner(this.slotOwner)
    try {
      return fn()
    } finally {
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
  }

  update(render, key = render) {
    if (key === this.current) {
      return
    }

    const instance = currentInstance
    const prevSub = setActiveSub()
    const parent = this.anchor.parentNode

    if (this.scope) {
      this.scope.stop()
      if (parent) remove(this.nodes, parent)
    }

    const prevInstance = setCurrentInstance(instance)
    try {
      this.renderBranch(render, parent, key)
    } finally {
      setCurrentInstance(...prevInstance)
    }
    setActiveSub(prevSub)
  }

  renderBranch(render, parent, key) {
    this.current = key
    if (render) {
      this.scope = new EffectScope()
      this.nodes =
        this.runWithRenderCtx(() => this.scope.run(render) || [], this.scope) ||
        []
      if (parent) {
        insert(this.nodes, parent, this.anchor)
      }
    } else {
      this.scope = undefined
      this.nodes = []
    }

    if (parent && this.onUpdated) {
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
