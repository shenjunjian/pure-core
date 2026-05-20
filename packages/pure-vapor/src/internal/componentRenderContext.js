export let currentRenderingInstance = null
export let currentScopeId = null

export function setCurrentRenderingInstance(instance) {
  const prev = currentRenderingInstance
  currentRenderingInstance = instance
  currentScopeId = (instance && instance.type.__scopeId) || null
  return prev
}
