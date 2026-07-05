import { isArray } from '@vue/shared'
import { vShowHidden, vShowOriginalDisplay } from '../../internal/vShow.js'
import { warn } from '../../internal/warning.js'
import { renderEffect } from '../renderEffect.js'
import { isVaporComponent } from '../component.js'
import { isFragment, DynamicFragment, VaporFragment } from '../fragment.js'

export let currentPendingVShows = null

export function setCurrentPendingVShows(pending) {
  try {
    return currentPendingVShows
  } finally {
    currentPendingVShows = pending
  }
}

export function applyVShow(target, source) {
  if (isVaporComponent(target)) {
    return applyVShow(target.block, source)
  }

  if (isArray(target) && target.length === 1) {
    return applyVShow(target[0], source)
  }

  if (target instanceof DynamicFragment) {
    const update = target.update
    target.update = (render, key, noScope) => {
      update.call(target, render, key, noScope)
      setDisplay(target, source())
    }
  } else if (target instanceof VaporFragment && target.insert) {
    const insert = target.insert
    target.insert = (parent, anchor, transition) => {
      insert.call(target, parent, anchor, transition)
      setDisplay(target, source())
    }
  }

  renderEffect(() => {
    const value = source()
    if (currentPendingVShows) {
      currentPendingVShows.push({
        target,
        apply: () => setDisplay(target, value, true),
      })
      return
    }
    setDisplay(target, value)
  })
}

function setDisplay(target, value, deferEnter = false) {
  if (isVaporComponent(target)) {
    return setDisplay(target.block, value, deferEnter)
  }
  if (isArray(target)) {
    if (target.length === 0) return
    if (target.length === 1) return setDisplay(target[0], value, deferEnter)
  }
  if (isFragment(target)) {
    return setDisplay(target.nodes, value, deferEnter)
  }

  if (target instanceof Element) {
    const el = target
    if (!(vShowOriginalDisplay in el)) {
      el[vShowOriginalDisplay] =
        el.style.display === 'none' ? '' : el.style.display
    }

    const transition = target.$transition
    if (transition) {
      if (value) {
        transition.beforeEnter(target)
        el.style.display = el[vShowOriginalDisplay]
        if (deferEnter) {
          return () => transition.enter(target)
        }
        transition.enter(target)
      } else {
        if (target.isConnected) {
          transition.leave(target, () => {
            el.style.display = 'none'
          })
        } else {
          el.style.display = 'none'
        }
      }
    } else {
      el.style.display = value ? el[vShowOriginalDisplay] : 'none'
    }

    el[vShowHidden] = !value
  } else if (__DEV__) {
    warn(
      `v-show used on component with non-single-element root node ` +
        `and will be ignored.`,
    )
  }
}
