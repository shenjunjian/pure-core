export let inOnceSlot = false
export let currentSlotOwner = null

export function setCurrentSlotOwner(owner) {
  const prev = currentSlotOwner
  currentSlotOwner = owner
  return prev
}

export function getCurrentSlotEndAnchor() {
  return null
}

export function isHydratingSlotFallbackActive() {
  return false
}
