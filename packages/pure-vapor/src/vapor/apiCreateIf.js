import { VaporBlockShape, VaporIfFlags } from '@vue/shared'
import { insert } from './block.js'
import { createComment, createTextNode } from './dom/node.js'
import {
  insertionAnchor,
  insertionParent,
  resetInsertionState,
} from './insertionState.js'
import { renderEffect } from './renderEffect.js'
import { DynamicFragment } from './fragment.js'

export function createIf(
  condition,
  b1,
  b2,
  flags = VaporBlockShape.SINGLE_ROOT,
) {
  const _insertionParent = insertionParent
  const _insertionAnchor = insertionAnchor
  resetInsertionState()

  let frag
  if (flags & VaporIfFlags.ONCE) {
    const ok = condition()
    frag = ok
      ? b1()
      : b2
        ? b2()
        : [__DEV__ ? createComment('if') : createTextNode()]
  } else {
    const index = flags >> VaporIfFlags.INDEX_SHIFT
    const keyed = index > 0
    const keyBase = keyed ? (index - 1) * 2 : 0
    frag = __DEV__
      ? new DynamicFragment('if', keyed)
      : new DynamicFragment(undefined, keyed)
    renderEffect(() => {
      const ok = condition()
      const render = ok ? b1 : b2
      const noScope = !!(
        flags & (ok ? VaporIfFlags.TRUE_NO_SCOPE : VaporIfFlags.FALSE_NO_SCOPE)
      )
      if (keyed) {
        frag.update(render, keyBase + (ok ? 0 : 1), noScope)
      } else {
        frag.update(render, render, noScope)
      }
    })
  }

  if (_insertionParent) insert(frag, _insertionParent, _insertionAnchor)
  return frag
}
