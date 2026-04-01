import { isArray } from '@vue/shared'
import type { Block } from './types'
import { VaporComponentInstance } from './component'



export function insert(
  block: Block,
  parent: ParentNode,
  anchor: Node | null = null,
): void {
  if (block instanceof Node) {
    parent.insertBefore(block, anchor)
  } else if (block instanceof VaporComponentInstance) {
    if (block.isMounted) {
      insert(block.block, parent, anchor)
    } else {
      // Mount component
      mountComponent(block, parent, anchor)
    }
  } else if (isArray(block)) {
    for (const b of block) {
      insert(b, parent, anchor)
    }
  }
}

export function remove(block: Block, parent?: ParentNode): void {
  if (block instanceof Node) {
    parent && parent.removeChild(block)
  } else if (block instanceof VaporComponentInstance) {
    unmountComponent(block, parent)
  } else if (isArray(block)) {
    for (const b of block) {
      remove(b, parent)
    }
  }
}

export function isBlock(val: NonNullable<unknown>): val is Block {
  return (
    val instanceof Node ||
    isArray(val) ||
    val instanceof VaporComponentInstance
  )
}