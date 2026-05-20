import { isArray } from '@vue/shared'
import {
  isVaporComponent,
  mountComponent,
  unmountComponent,
} from './component.js'
import { isComment } from './dom/hydration.js'
import { isFragment } from './fragment.js'
import { domInsert, domPrepend, domRemove } from './dom/domOps.js'

export function isBlock(val) {
  return (
    val instanceof Node ||
    isArray(val) ||
    isVaporComponent(val) ||
    isFragment(val)
  )
}

export function isValidBlock(block) {
  if (!block) {
    return false
  } else if (block instanceof Node) {
    return !(block instanceof Comment)
  } else if (isVaporComponent(block)) {
    return isValidBlock(block.block)
  } else if (isArray(block)) {
    return block.length > 0 && block.some(isValidBlock)
  } else {
    const isBlockValid = block.isBlockValid
    if (isBlockValid) {
      return isBlockValid.call(block)
    }
    if (block.validityPending) {
      return true
    }
    const getEffectiveOutput = block.getEffectiveOutput
    return isValidBlock(
      getEffectiveOutput ? getEffectiveOutput.call(block) : block.nodes,
    )
  }
}

export function insert(block, parent, anchor = null) {
  if (block instanceof Node) {
    domInsert(parent, block, anchor)
  } else if (isVaporComponent(block)) {
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
    if (block.anchor) {
      insert(block.anchor, parent, anchor)
      anchor = block.anchor
    }
    if (block.insert) {
      block.insert(parent, anchor)
    } else {
      insert(block.nodes, parent, anchor)
    }
  }
}

export function move(block, parent, anchor = null) {
  if (block instanceof Node) {
    domInsert(parent, block, anchor)
  } else if (isVaporComponent(block)) {
    if (block.isMounted) {
      move(block.block, parent, anchor)
    } else {
      mountComponent(block, parent, anchor)
    }
  } else if (isArray(block)) {
    for (let i = 0; i < block.length; i++) {
      move(block[i], parent, anchor)
    }
  } else {
    if (block.anchor) {
      move(block.anchor, parent, anchor)
      anchor = block.anchor
    }
    if (block.insert) {
      block.insert(parent, anchor)
    } else {
      move(block.nodes, parent, anchor)
    }
  }
}

export function prepend(parent, ...blocks) {
  let i = blocks.length
  while (i--) insert(blocks[i], parent, 0)
}

export function remove(block, parent) {
  if (block instanceof Node) {
    if (parent) domRemove(parent, block)
  } else if (isVaporComponent(block)) {
    unmountComponent(block, parent)
  } else if (isArray(block)) {
    for (let i = 0; i < block.length; i++) {
      remove(block[i], parent)
    }
  } else {
    if (block.remove) {
      block.remove(parent)
    } else {
      remove(block.nodes, parent)
    }
    if (block.anchor) remove(block.anchor, parent)
    if (block.scope) {
      block.scope.stop()
    }
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

export function findBlockNode(block) {
  const lastChild = findLastChild(block)
  let parentNode = lastChild.parentNode
  let nextNode = lastChild.nextSibling

  if (
    nextNode &&
    isComment(nextNode, ']') &&
    isFragmentBlock(block) &&
    !isComment(lastChild, ']')
  ) {
    nextNode = nextNode.nextSibling
  }

  return { parentNode, nextNode }
}

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
