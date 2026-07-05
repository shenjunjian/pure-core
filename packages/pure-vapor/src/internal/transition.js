/**
 * Simplified transition state management for pure-vapor.
 * Mirrors runtime-core's useTransitionState but without VNode dependencies.
 */

import { onMounted, onBeforeUnmount } from './lifecycle.js'

/**
 * @typedef {Object} TransitionState
 * @property {boolean} isMounted
 * @property {boolean} isLeaving
 * @property {boolean} isUnmounting
 * @property {Map<any, Record<string, any>>} leavingNodes - keyed by type, then by string key
 */

/**
 * Transition state instance (module-level singleton per app would be ideal,
 * but for simplicity we use a single shared state).
 * Multi-app isolation can be added later via app._Internal if needed.
 */
let sharedState = null

export function useTransitionState() {
  if (!sharedState) {
    sharedState = {
      isMounted: false,
      isLeaving: false,
      isUnmounting: false,
      leavingNodes: new Map(),
    }

    onMounted(() => {
      sharedState.isMounted = true
    })

    onBeforeUnmount(() => {
      sharedState.isUnmounting = true
    })
  }

  return sharedState
}

/**
 * Get or create the leaving nodes cache for a given transition type.
 * @param {TransitionState} state
 * @param {any} type - element tag name or component type
 * @returns {Record<string, any>}
 */
export function getLeavingNodesForType(state, type) {
  const { leavingNodes } = state
  let nodes = leavingNodes.get(type)
  if (!nodes) {
    nodes = Object.create(null)
    leavingNodes.set(type, nodes)
  }
  return nodes
}

/**
 * Check if transition mode is valid
 * @param {string|undefined} mode
 */
export function checkTransitionMode(mode) {
  if (mode && mode !== 'in-out' && mode !== 'out-in') {
    console.warn(
      `<transition> invalid mode "${mode}". Valid modes are: "in-out", "out-in".`,
    )
  }
}
