import { isArray } from '@vue/shared'
import {
  isVaporComponent,
  mountComponent,
  unmountComponent,
} from './component.js'
import { isFragment } from './fragment.js'
import { _child } from './dom/node.js'
import { domInsert, domRemove } from './dom/domOps.js'
import {
  MoveType,
  performTransitionEnter,
  performTransitionLeave,
} from '../internal/transitionRuntime.js'
import { isTransitionEnabled } from './transition.js'

export function isBlock(val) {
  return (
    val instanceof Node ||
    isArray(val) ||
    isVaporComponent(val) ||
    isFragment(val)
  )
}

export function isValidBlock(block, componentAsValid = false) {
  if (!block) {
    return false
  } else if (block instanceof Node) {
    return !(block instanceof Comment)
  } else if (isVaporComponent(block)) {
    return componentAsValid || isValidBlock(block.block, componentAsValid)
  } else if (isArray(block)) {
    return (
      block.length > 0 && block.some(b => isValidBlock(b, componentAsValid))
    )
  } else {
    const isBlockValid = block.isBlockValid
    if (isBlockValid) {
      return isBlockValid.call(block, componentAsValid)
    }
    if (block.validityPending) {
      return true
    }
    const getEffectiveOutput = block.getEffectiveOutput
    return isValidBlock(
      getEffectiveOutput ? getEffectiveOutput.call(block) : block.nodes,
      componentAsValid,
    )
  }
}

export function isValidSlot(block) {
  return isValidBlock(block, true)
}

export function insert(block, parent, anchor = null) {
  if (block instanceof Node) {
    insertNode(block, parent, anchor)
    return
  }

  anchor = anchor === 0 ? parent.$fc || _child(parent) : anchor
  if (isVaporComponent(block)) {
    if (block.isMounted && !block.isDeactivated) {
      insert(block.block, parent, anchor)
    } else {
      mountComponent(block, parent, anchor)
    }
  } else if (isArray(block)) {
    for (let i = 0; i < block.length; i++) {
      insert(block[i], parent, anchor)
    }
  } else {
    insertFragment(block, parent, anchor)
  }
}

function insertNode(block, parent, anchor = null) {
  anchor = anchor === 0 ? parent.$fc || _child(parent) : anchor
  if (
    isTransitionEnabled &&
    block instanceof Element &&
    block.$transition &&
    !block.$transition.disabled
  ) {
    performTransitionEnter(block, block.$transition, () =>
      domInsert(parent, block, anchor),
    )
  } else {
    domInsert(parent, block, anchor)
  }
}

function insertFragment(block, parent, anchor = null) {
  anchor = anchor === 0 ? parent.$fc || _child(parent) : anchor
  if (block.anchor) {
    insertNode(block.anchor, parent, anchor)
    anchor = block.anchor
  }
  if (block.insert) {
    block.insert(parent, anchor, block.$transition)
  } else {
    insert(block.nodes, parent, anchor)
  }
}

export function move(
  block,
  parent,
  anchor = null,
  moveType = MoveType.LEAVE,
  parentComponent,
) {
  anchor = anchor === 0 ? parent.$fc || _child(parent) : anchor
  if (block instanceof Node) {
    if (
      isTransitionEnabled &&
      block instanceof Element &&
      block.$transition &&
      !block.$transition.disabled &&
      moveType !== MoveType.REORDER
    ) {
      if (moveType === MoveType.ENTER) {
        performTransitionEnter(
          block,
          block.$transition,
          () => domInsert(parent, block, anchor),
          null,
          true,
        )
      } else {
        performTransitionLeave(
          block,
          block.$transition,
          () => {
            if (
              moveType === MoveType.LEAVE &&
              parentComponent &&
              parentComponent.isUnmounted
            ) {
              block.remove()
            } else {
              domInsert(parent, block, anchor)
            }
          },
          true,
          true,
        )
      }
    } else {
      domInsert(parent, block, anchor)
    }
  } else if (isVaporComponent(block)) {
    if (block.isMounted) {
      move(block.block, parent, anchor, moveType, parentComponent)
    } else {
      mountComponent(block, parent, anchor)
    }
  } else if (isArray(block)) {
    for (let i = 0; i < block.length; i++) {
      move(block[i], parent, anchor, moveType, parentComponent)
    }
  } else {
    if (block.anchor) {
      move(block.anchor, parent, anchor, moveType, parentComponent)
      anchor = block.anchor
    }
    if (block.insert) {
      block.insert(parent, anchor, block.$transition)
    } else {
      move(block.nodes, parent, anchor, moveType, parentComponent)
    }
  }
}

export function prepend(parent, ...blocks) {
  let i = blocks.length
  while (i--) insert(blocks[i], parent, 0)
}

export function remove(block, parent) {
  if (block instanceof Node) {
    removeNode(block, parent)
  } else if (isVaporComponent(block)) {
    unmountComponent(block, parent)
  } else if (isArray(block)) {
    for (let i = 0; i < block.length; i++) {
      remove(block[i], parent)
    }
  } else {
    removeFragment(block, parent)
  }
}

function removeNode(block, parent) {
  if (isTransitionEnabled && block.$transition && block instanceof Element) {
    performTransitionLeave(block, block.$transition, () => {
      if (parent) domRemove(parent, block)
    })
  } else {
    if (parent) domRemove(parent, block)
  }
}

function removeFragment(block, parent) {
  if (block.remove) {
    block.remove(parent, block.$transition)
  } else {
    remove(block.nodes, parent)
  }
  if (block.anchor) removeNode(block.anchor, parent)
  if (block.scope) {
    block.scope.stop()
  }
}

export function normalizeBlock(block) {
  if (!__DEV__ && !__TEST__) {
    throw new Error(
      'normalizeBlock should not be used in production code paths',
    )
  }
  const nodes = []
  if (block instanceof Node) {
    nodes.push(block)
  } else if (isArray(block)) {
    for (let i = 0; i < block.length; i++) {
      nodes.push(...normalizeBlock(block[i]))
    }
  } else if (isVaporComponent(block)) {
    nodes.push(...normalizeBlock(block.block))
  } else {
    nodes.push(...normalizeBlock(block.nodes))
    if (block.anchor) nodes.push(block.anchor)
  }
  return nodes
}

function isComment(node, data) {
  return node.nodeType === 8 && (data === undefined || node.data === data)
}

export function findBlockBoundary(block) {
  const lastChild = findLastChild(block)
  let parentNode = lastChild.parentNode
  let nextNode = lastChild.nextSibling

  if (
    nextNode &&
    isComment(nextNode, ']') &&
    isFragmentBlock(block) &&
    !isComment(lastChild, ']') &&
    !(lastChild.nodeType === 3 && !lastChild.data)
  ) {
    nextNode = nextNode.nextSibling
  }

  return { parentNode, nextNode }
}

/** @deprecated use findBlockBoundary */
export const findBlockNode = findBlockBoundary

function findLastChild(node) {
  if (node && node instanceof Node) {
    return node
  } else if (isArray(node)) {
    return findLastChild(node[node.length - 1])
  } else if (isVaporComponent(node)) {
    return findLastChild(node.block)
  } else {
    if (node.anchor) return node.anchor
    return findLastChild(node.nodes)
  }
}

export function isFragmentBlock(block) {
  if (isArray(block)) {
    return true
  } else if (isVaporComponent(block)) {
    return isFragmentBlock(block.block)
  } else if (isFragment(block)) {
    return isFragmentBlock(block.nodes)
  }
  return false
}
