/**
 * Transition utility functions for resolving transition blocks.
 * Simplified version without VNode interop and hydration.
 */

import { isArray } from '@vue/shared'
import { isVaporComponent } from '../component.js'
import { isFragment } from '../fragment.js'

/**
 * Resolve a single transition block from a block tree.
 * @param {import('../block.js').Block} block
 * @param {function(import('../fragment.js').VaporFragment): void} [onFragment]
 * @returns {import('../block.js').TransitionBlock|undefined}
 */
export function resolveTransitionBlock(block, onFragment) {
  return resolveTransitionChildren(block, { mode: 'single', onFragment })[0]
}

/**
 * Resolve multiple transition blocks (for TransitionGroup).
 * @param {import('../block.js').Block} block
 * @param {function(import('../fragment.js').VaporFragment): void} [onFragment]
 * @param {function(import('../fragment.js').VaporFragment|import('../component.js').VaporComponentInstance): void} [onUpdateOwner]
 * @returns {import('../block.js').TransitionBlock[]}
 */
export function resolveTransitionBlocks(block, onFragment, onUpdateOwner) {
  return resolveTransitionChildren(block, {
    mode: 'group',
    onFragment,
    onUpdateOwner,
  })
}

/**
 * @typedef {Object} ResolveTransitionBlocksOptions
 * @property {'single'|'group'} mode
 * @property {function(import('../fragment.js').VaporFragment): void} [onFragment]
 * @property {function(import('../fragment.js').VaporFragment|import('../component.js').VaporComponentInstance): void} [onUpdateOwner]
 */

/**
 * Internal function to collect transition children.
 * @param {import('../block.js').Block} block
 * @param {ResolveTransitionBlocksOptions} options
 * @returns {import('../block.js').TransitionBlock[]}
 */
function resolveTransitionChildren(block, options) {
  const children = []
  collectTransitionBlocks(block, options, children)
  return children
}

/**
 * Collect transition blocks recursively.
 * @param {import('../block.js').Block} block
 * @param {ResolveTransitionBlocksOptions} options
 * @param {import('../block.js').TransitionBlock[]} children
 */
function collectTransitionBlocks(block, options, children) {
  if (block instanceof Node) {
    // Transition can only be applied on Element child
    if (block instanceof Element) {
      children.push(block)
    }
  } else if (isVaporComponent(block)) {
    collectComponentTransitionBlocks(block, options, children)
  } else if (isArray(block)) {
    collectArrayTransitionBlocks(block, options, children)
  } else if (isFragment(block)) {
    collectFragmentTransitionBlocks(block, options, children)
  }
}

/**
 * Collect transition blocks from a component.
 * @param {import('../component.js').VaporComponentInstance} block
 * @param {ResolveTransitionBlocksOptions} options
 * @param {import('../block.js').TransitionBlock[]} children
 */
function collectComponentTransitionBlocks(block, options, children) {
  // Stop searching if encountering nested Transition component
  // Note: We can't check VaporTransition directly due to circular dependency
  // This would need to be handled differently or imported dynamically

  const start = children.length
  collectTransitionBlocks(block.block, options, children)

  // Inherit key from component to resolved child
  if (children[start] && children[start].$key == null && block.$key != null) {
    children[start].$key = block.$key
  }
}

/**
 * Collect transition blocks from an array.
 * @param {import('../block.js').Block[]} block
 * @param {ResolveTransitionBlocksOptions} options
 * @param {import('../block.js').TransitionBlock[]} children
 */
function collectArrayTransitionBlocks(block, options, children) {
  if (options.mode === 'group') {
    for (const c of block) {
      collectTransitionBlocks(c, options, children)
    }
    return
  }

  // Single mode: find first non-comment child
  let hasFound = false
  for (const c of block) {
    if (c instanceof Comment) continue

    const nested = []
    collectTransitionBlocks(c, options, nested)

    if (__DEV__ && hasFound) {
      console.warn(
        '<transition> can only be used on a single element or component. ' +
          'Use <transition-group> for lists.',
      )
      break
    }

    if (nested.length) children.push(nested[0])
    hasFound = true
    if (!__DEV__) break
  }
}

/**
 * Collect transition blocks from a fragment.
 * @param {import('../fragment.js').VaporFragment} block
 * @param {ResolveTransitionBlocksOptions} options
 * @param {import('../block.js').TransitionBlock[]} children
 */
function collectFragmentTransitionBlocks(block, options, children) {
  if (options.mode === 'group') {
    if (options.onFragment) options.onFragment(block)
    if (options.onUpdateOwner) options.onUpdateOwner(block)

    const start = children.length
    collectTransitionBlocks(block.nodes, options, children)

    // Inherit keys for group mode
    if (block.$key != null) {
      for (let i = start; i < children.length; i++) {
        children[i].$key = `${block.$key}:${i - start}`
      }
    }
    return
  }

  // Single mode
  if (options.onFragment) options.onFragment(block)
  collectTransitionBlocks(block.nodes, options, children)
}
