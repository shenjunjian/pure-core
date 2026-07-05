import { VaporDynamicComponentFlags } from '@vue/shared'
import { resolveDynamicComponent } from '../internal/resolveAssets.js'
import { setCurrentRenderingInstance } from '../internal/componentRenderContext.js'
import { currentInstance } from '../internal/instance.js'
import { insert, isBlock, remove } from './block.js'
import { createComponentWithFallback, emptyContext } from './component.js'
import { renderEffect } from './renderEffect.js'
import { getScopeOwner, normalizeRawSlots } from './componentSlots.js'
import {
  insertionAnchor,
  insertionParent,
  resetInsertionState,
} from './insertionState.js'
import { DynamicFragment } from './fragment.js'

export function createDynamicComponent(getter, rawProps, rawSlots, flags = 0) {
  const isSingleRoot = !!(flags & VaporDynamicComponentFlags.SINGLE_ROOT)
  const once = !!(flags & VaporDynamicComponentFlags.ONCE)
  const slotRoot = !!(flags & VaporDynamicComponentFlags.SLOT_ROOT)
  const _insertionParent = insertionParent
  const _insertionAnchor = insertionAnchor
  resetInsertionState()

  const frag = new DynamicFragment(
    __DEV__ ? 'dynamic-component' : undefined,
    false,
    true,
    slotRoot,
    slotRoot
      ? () => {
          const nodes = frag.nodes
          if (nodes instanceof Node) {
            const parent = nodes.parentNode
            if (parent) remove(nodes, parent)
          }
          const anchorParent = frag.anchor.parentNode
          if (anchorParent) remove(frag.anchor, anchorParent)
        }
      : undefined,
  )

  const normalizedRawSlots = normalizeRawSlots(rawSlots)
  const scopeOwner = getScopeOwner()
  const renderFn = () => {
    const value = getter()
    const appContext =
      (currentInstance && currentInstance.appContext) || emptyContext
    frag.update(() => {
      if (isBlock(value)) return value

      return createComponentWithFallback(
        withScopeOwner(scopeOwner, () => resolveDynamicComponent(value)),
        rawProps,
        normalizedRawSlots,
        isSingleRoot,
        once,
        appContext,
      )
    }, value)
  }

  if (once) renderFn()
  else renderEffect(renderFn)

  if (_insertionParent) insert(frag, _insertionParent, _insertionAnchor)
  return frag
}

function withScopeOwner(owner, fn) {
  const prev = setCurrentRenderingInstance(owner)
  try {
    return fn()
  } finally {
    setCurrentRenderingInstance(prev)
  }
}
