import { insert } from './block.js'
import {
  insertionAnchor,
  insertionParent,
  resetInsertionState,
} from './insertionState.js'
import { renderEffect } from './renderEffect.js'
import { DynamicFragment } from './fragment.js'

export function createKeyedFragment(key, render) {
  const _insertionParent = insertionParent
  const _insertionAnchor = insertionAnchor
  resetInsertionState()

  const frag = __DEV__
    ? new DynamicFragment('keyed', true)
    : new DynamicFragment(undefined, true)

  renderEffect(() => frag.update(render, key()))

  if (_insertionParent) insert(frag, _insertionParent, _insertionAnchor)
  return frag
}
