/**
 * Transition hooks registry for pure-vapor.
 * Simplified version without runtime-dom dependencies and VNode interop.
 */

/**
 * @typedef {import('./block.js').Block} Block
 * @typedef {import('./block.js').BlockFn} BlockFn
 * @typedef {import('./block.js').VaporTransitionHooks} VaporTransitionHooks
 * @typedef {import('./component.js').VaporComponent} VaporComponent
 * @typedef {import('./fragment.js').DynamicFragment} DynamicFragment
 */

// Transition hooks registry for tree-shaking
// These are registered by Transition component when it's used

/**
 * @typedef {(block: Block, hooks: VaporTransitionHooks) => VaporTransitionHooks} ApplyTransitionHooksFn
 * @typedef {(frag: DynamicFragment, render: BlockFn|undefined, key: any, noScope: boolean) => boolean} DeferBranchUpdateDuringLeaveFn
 * @typedef {(frag: DynamicFragment, transition: VaporTransitionHooks, parent: ParentNode|null, render: BlockFn|undefined, key: any, noScope: boolean) => boolean} RemoveBranchWithLeaveFn
 */

/** @type {ApplyTransitionHooksFn} */
export let applyTransitionHooks = undefined

/** @type {DeferBranchUpdateDuringLeaveFn} */
export let deferBranchUpdateDuringLeave = undefined

/** @type {RemoveBranchWithLeaveFn} */
export let removeBranchWithLeave = undefined

export let isTransitionEnabled = false

/**
 * Register transition hook implementations from Transition component.
 * This allows tree-shaking when Transition is not used.
 *
 * @param {ApplyTransitionHooksFn} applyHooks
 * @param {DeferBranchUpdateDuringLeaveFn} deferBranchUpdate
 * @param {RemoveBranchWithLeaveFn} removeBranch
 */
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

/**
 * Check if a component is the VaporTransition component
 * @param {VaporComponent} component
 * @returns {boolean}
 */
export function isVaporTransition(component) {
  return component.displayName === displayName || component.name === displayName
}
