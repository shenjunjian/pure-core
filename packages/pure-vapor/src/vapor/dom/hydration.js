/** No-op hydration stubs (pure-vapor has no SSR hydration). */

export const isHydrating = false

export function isComment() {
  return false
}

export function advanceHydrationNode() {}
export function captureHydrationCursor() {
  return null
}
export function enterHydrationCursor() {
  return null
}
export function exitHydrationCursor() {}
export function enterHydrationBoundary() {
  return () => {}
}
export function locateHydrationBoundaryClose() {
  return null
}
export function locateHydrationNode() {}
export function markHydrationAnchor(node) {
  return node
}
export function nextLogicalSibling(node) {
  return node.nextSibling
}
export function setCurrentHydrationNode() {}
export function cleanupHydrationTail() {}
export function isInDeferredHydrationBoundary() {
  return false
}
