export let isTeleportEnabled = false

export function enableTeleport(value) {
  isTeleportEnabled = true
  return value
}

export function isVaporTeleport(value) {
  return !!(value && value.__isTeleport && value.__vapor)
}

export function isTeleportFragment(value) {
  return !!(value && value.__isTeleportFragment)
}
