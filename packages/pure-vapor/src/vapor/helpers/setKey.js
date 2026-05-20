import { isArray } from '@vue/shared'
import { isVaporComponent } from '../component.js'

export function setBlockKey(block, key) {
  if (!block) return

  if (block instanceof Node) {
    block.$key = key
  } else if (isVaporComponent(block)) {
    block.$key = key
    if (block.block) {
      setBlockKey(block.block, key)
    }
  } else if (isArray(block)) {
    if (block.length === 1) {
      setBlockKey(block[0], key)
    }
  } else {
    block.$key = key
    if (block.vnode) block.vnode.key = key
    setBlockKey(block.nodes, key)
  }
}
