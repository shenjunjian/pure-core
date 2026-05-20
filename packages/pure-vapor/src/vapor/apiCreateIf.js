import { insert } from './block.js'
import { createComment, createTextNode } from './dom/node.js'
import {
  insertionAnchor,
  insertionParent,
  resetInsertionState,
} from './insertionState.js'
import { renderEffect } from './renderEffect.js'
import { DynamicFragment } from './fragment.js'

export function createIf(condition, b1, b2, blockShape, once, index) {
  const _insertionParent = insertionParent
  const _insertionAnchor = insertionAnchor
  resetInsertionState()

  let frag
  if (once) {
    const ok = condition()
    frag = ok
      ? b1()
      : b2
        ? b2()
        : [__DEV__ ? createComment('if') : createTextNode()]
  } else {
    const keyed = index != null
    frag = __DEV__
      ? new DynamicFragment('if', keyed, false)
      : new DynamicFragment(undefined, keyed, false)
    renderEffect(() => {
      const ok = condition()
      frag.update(ok ? b1 : b2, keyed ? index * 2 + (ok ? 0 : 1) : undefined)
    })
  }

  if (_insertionParent) insert(frag, _insertionParent, _insertionAnchor)
  return frag
}
