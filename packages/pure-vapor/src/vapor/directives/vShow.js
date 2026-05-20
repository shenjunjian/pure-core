import { isArray } from '@vue/shared'
import { vShowHidden, vShowOriginalDisplay } from '../../internal/vShow.js'
import { warn } from '../../internal/warning.js'
import { renderEffect } from '../renderEffect.js'
import { isVaporComponent } from '../component.js'
import { isFragment, DynamicFragment, VaporFragment } from '../fragment.js'

export function applyVShow(target, source) {
  if (isVaporComponent(target)) {
    return applyVShow(target.block, source)
  }

  if (isArray(target) && target.length === 1) {
    return applyVShow(target[0], source)
  }

  if (target instanceof DynamicFragment) {
    const update = target.update
    target.update = (render, key) => {
      update.call(target, render, key)
      setDisplay(target, source())
    }
  } else if (target instanceof VaporFragment && target.insert) {
    const insert = target.insert
    target.insert = (parent, anchor) => {
      insert.call(target, parent, anchor)
      setDisplay(target, source())
    }
  }

  renderEffect(() => {
    setDisplay(target, source())
  })
}

function setDisplay(target, value) {
  if (isVaporComponent(target)) {
    return setDisplay(target.block, value)
  }
  if (isArray(target)) {
    if (target.length === 0) return
    if (target.length === 1) return setDisplay(target[0], value)
  }
  if (isFragment(target)) {
    return setDisplay(target.nodes, value)
  }

  if (target instanceof Element) {
    const el = target
    if (!(vShowOriginalDisplay in el)) {
      el[vShowOriginalDisplay] =
        el.style.display === 'none' ? '' : el.style.display
    }
    el.style.display = value ? el[vShowOriginalDisplay] : 'none'
    el[vShowHidden] = !value
  } else if (__DEV__) {
    warn(
      `v-show used on component with non-single-element root node ` +
        `and will be ignored.`,
    )
  }
}
