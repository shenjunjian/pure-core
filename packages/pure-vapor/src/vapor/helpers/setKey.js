import { isArray } from '@vue/shared'
import { isKeepAlive } from '../../internal/keepAlive.js'
import { isKeepAliveEnabled } from '../keepAlive.js'
import { isVaporComponent } from '../component.js'

export function setBlockKey(block, key) {
  if (!block) return

  if (block instanceof Node) {
    block.$key = key
  } else if (isVaporComponent(block)) {
    block.$key = key
    if ((!isKeepAliveEnabled || !isKeepAlive(block)) && block.block) {
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
