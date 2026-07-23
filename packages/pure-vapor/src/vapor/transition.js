export let applyTransitionHooks
export let deferBranchUpdateDuringLeave
export let removeBranchWithLeave

export let isTransitionEnabled = false

export function registerTransitionHooks(
  applyHooks,
  deferBranchUpdate,
  removeBranch,
) {
  isTransitionEnabled = true
  applyTransitionHooks = applyHooks
  deferBranchUpdateDuringLeave = deferBranchUpdate
  removeBranchWithLeave = removeBranch
}

export const displayName = 'VaporTransition'

export function isVaporTransition(component) {
  return component.displayName === displayName
}
