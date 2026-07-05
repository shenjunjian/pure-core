import {
  addTransitionClass,
  getTransitionInfo,
  removeTransitionClass,
  vtcKey,
} from './transitionDom.js'

const moveCbKey = Symbol('_moveCb')
const enterCbKey = Symbol('_enterCb')

export function callPendingCbs(el) {
  if (el[moveCbKey]) {
    el[moveCbKey]()
  }
  if (el[enterCbKey]) {
    el[enterCbKey]()
  }
}

export function baseApplyTranslation(oldPos, newPos, el) {
  const dx = oldPos.left - newPos.left
  const dy = oldPos.top - newPos.top
  if (dx || dy) {
    const s = el.style
    const rect = el.getBoundingClientRect()
    let scaleX = 1
    let scaleY = 1
    if (el.offsetWidth) scaleX = rect.width / el.offsetWidth
    if (el.offsetHeight) scaleY = rect.height / el.offsetHeight
    if (!Number.isFinite(scaleX) || scaleX === 0) scaleX = 1
    if (!Number.isFinite(scaleY) || scaleY === 0) scaleY = 1
    if (Math.abs(scaleX - 1) < 0.01) scaleX = 1
    if (Math.abs(scaleY - 1) < 0.01) scaleY = 1
    s.transform = s.webkitTransform = `translate(${dx / scaleX}px,${
      dy / scaleY
    }px)`
    s.transitionDuration = '0s'
    return true
  }
  return false
}

export function hasCSSTransform(el, root, moveClass) {
  const clone = el.cloneNode()
  const _vtc = el[vtcKey]
  if (_vtc) {
    _vtc.forEach(cls => {
      cls.split(/\s+/).forEach(c => c && clone.classList.remove(c))
    })
  }
  moveClass.split(/\s+/).forEach(c => c && clone.classList.add(c))
  clone.style.display = 'none'
  const container = root.nodeType === 1 ? root : root.parentNode
  container.appendChild(clone)
  const { hasTransform } = getTransitionInfo(clone)
  container.removeChild(clone)
  return hasTransform
}

export function handleMovedChildren(el, moveClass) {
  const style = el.style
  addTransitionClass(el, moveClass)
  style.transform = style.webkitTransform = style.transitionDuration = ''
  const cb = (el[moveCbKey] = e => {
    if (e && e.target !== el) {
      return
    }
    if (!e || e.propertyName.endsWith('transform')) {
      el.removeEventListener('transitionend', cb)
      el[moveCbKey] = null
      removeTransitionClass(el, moveClass)
    }
  })
  el.addEventListener('transitionend', cb)
}
