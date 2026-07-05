import { isValidSlot } from './block.js'

export let currentSlotBoundary = null

export function setCurrentSlotBoundary(b) {
  try {
    return currentSlotBoundary
  } finally {
    currentSlotBoundary = b
  }
}

export function withSlotBoundary(boundary, fn) {
  const prev = setCurrentSlotBoundary(boundary)
  try {
    return fn()
  } finally {
    setCurrentSlotBoundary(prev)
  }
}

export function trackSlotBoundaryDirtying(fragment, onInvalid) {
  const boundary = currentSlotBoundary
  if (!boundary) return

  if (onInvalid) {
    registerContentInvalid(boundary, onInvalid, fragment)
  }

  let prevValid
  ;(fragment.onBeforeUpdate || (fragment.onBeforeUpdate = [])).push(() => {
    prevValid = isValidSlot(fragment)
  })
  ;(fragment.onUpdated || (fragment.onUpdated = [])).push(() => {
    if (isValidSlot(fragment) !== prevValid) {
      boundary.markDirty()
    }
  })
}

export function registerContentInvalid(boundary, onInvalid, fragment) {
  const callbacks =
    boundary.onContentInvalid || (boundary.onContentInvalid = [])
  callbacks.push(onInvalid)
  const unregister = () => {
    const index = callbacks.indexOf(onInvalid)
    if (index > -1) callbacks.splice(index, 1)
  }
  ;(fragment.onRemove || (fragment.onRemove = [])).push(unregister)
}

export function hasSlotFallback(boundary) {
  while (boundary) {
    if (boundary.getFallback()) {
      return true
    }
    boundary = boundary.parent
  }
  return false
}
