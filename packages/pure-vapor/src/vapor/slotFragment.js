import { EffectScope } from '@vue/reactivity'
import { insert, isValidSlot, remove } from './block.js'
import { hasSlotFallback, withSlotBoundary } from './slotBoundary.js'
import { applyTransitionHooks, isTransitionEnabled } from './transition.js'
import { setBlockKey } from './helpers/setKey.js'

function renderSlotFallback(boundary, scope) {
  let block

  while (boundary) {
    const current = boundary
    const localFallback = current.getFallback()

    if (localFallback) {
      let selected = false
      const content = current.run(
        () =>
          withSlotBoundary(
            {
              ...current,
              getFallback: () => undefined,
              onContentInvalid: [],
              markDirty: force =>
                current.markDirty(
                  !!force || (!selected && hasSlotFallback(current.parent)),
                ),
            },
            localFallback,
          ),
        scope,
      )
      if (isValidSlot(content)) {
        selected = true
        return content
      }
      block = content
    }

    boundary = current.parent
  }

  return block
}

export function markSlotResolutionDirty(state, force = false) {
  if (state.isDisposed()) {
    return
  }
  if (state.isRenderingFallback || state.isBusy()) {
    state.pendingRecheck = true
    state.pendingRecheckForce = state.pendingRecheckForce || force
    return
  }
  recheckSlotResolution(state, force)
}

function clearSlotFallback(state) {
  const fallback = state.activeFallback
  if (fallback) {
    const parentNode = state.getParentNode()
    if (parentNode) {
      remove(fallback, parentNode)
    }
    state.activeFallback = null
  }
  if (state.fallbackScope) {
    state.fallbackScope.stop()
    state.fallbackScope = undefined
  }
}

function renderFallbackInScope(state) {
  const scope = new EffectScope(true)
  let renderedFallback
  state.isRenderingFallback = true
  try {
    renderedFallback = renderSlotFallback(state.boundary, scope)
  } catch (err) {
    scope.stop()
    throw err
  } finally {
    state.isRenderingFallback = false
  }

  if (!renderedFallback) {
    scope.stop()
    return undefined
  }

  return {
    block: renderedFallback,
    scope,
  }
}

export function insertActiveSlotFallback(state) {
  const fallback = state.activeFallback
  if (!fallback || !isValidSlot(fallback)) {
    return
  }
  const parentNode = state.getParentNode()
  if (!parentNode) {
    return
  }
  insert(fallback, parentNode, state.getAnchor())
}

function commitSlotFallback(state, block, scope, detachContent) {
  if (detachContent) {
    const contentInvalidCallbacks = state.boundary.onContentInvalid
    if (contentInvalidCallbacks) {
      for (let i = 0; i < contentInvalidCallbacks.length; i++) {
        contentInvalidCallbacks[i]()
      }
    }
  }
  state.activeFallback = block
  state.fallbackScope = scope
  if (isTransitionEnabled) {
    const transitionState = state
    if (transitionState.$transition) {
      setBlockKey(block, '_fb')
      transitionState.$transition = applyTransitionHooks(
        block,
        transitionState.$transition,
      )
    }
  }
  insertActiveSlotFallback(state)
}

function renderAndCommitSlotFallback(state, hadFallback) {
  const result = renderFallbackInScope(state)
  clearSlotFallback(state)
  if (result) {
    commitSlotFallback(state, result.block, result.scope, !hadFallback)
    if (state.pendingRecheck) {
      const force = state.pendingRecheckForce
      state.pendingRecheck = false
      state.pendingRecheckForce = false
      recheckSlotResolution(state, force)
    }
  }
}

export function disposeSlotResolution(state) {
  clearSlotFallback(state)
  state.pendingRecheck = false
  state.pendingRecheckForce = false
  state.lastNodesValid = undefined
}

export function recheckSlotResolution(state, force = false) {
  if (state.isRenderingFallback) {
    state.pendingRecheck = true
    state.pendingRecheckForce = state.pendingRecheckForce || force
    return
  }

  const fallback = state.activeFallback
  const fallbackValid = fallback ? isValidSlot(fallback) : false
  const contentValid = state.isContentValid()
  const exposedValid = fallback ? fallbackValid : contentValid
  const prevNodesValid = state.lastNodesValid ?? exposedValid
  if (!force && contentValid && !fallback && prevNodesValid) {
    state.syncNodes()
    state.lastNodesValid = true
    return
  }

  if (contentValid) {
    const content = state.getContent()
    const hadFallback = !!fallback
    clearSlotFallback(state)
    if (hadFallback) {
      const parentNode = state.getParentNode()
      if (parentNode) {
        insert(content, parentNode, state.getAnchor())
      }
    }
  } else if (fallback) {
    if (prevNodesValid) {
      if (!fallbackValid && hasSlotFallback(state.boundary.parent)) {
        renderAndCommitSlotFallback(state, true)
      } else if (force && fallbackValid) {
        renderAndCommitSlotFallback(state, true)
      }
    } else if (fallbackValid) {
      insertActiveSlotFallback(state)
    } else if (force) {
      renderAndCommitSlotFallback(state, true)
    }
  } else {
    renderAndCommitSlotFallback(state, false)
  }

  const nextFallback = state.activeFallback
  const nextNodesValid =
    contentValid && !nextFallback
      ? true
      : nextFallback
        ? nextFallback === fallback
          ? fallbackValid
          : isValidSlot(nextFallback)
        : state.isContentValid()
  state.syncNodes()
  state.lastNodesValid = nextNodesValid
  if (prevNodesValid !== nextNodesValid) {
    state.notifyExposedValidityChange()
  }
}
