/**
 * FLIP (First, Last, Invert, Play) animation utilities for TransitionGroup.
 * Ported from runtime-dom with pure-vapor adaptations.
 */

/**
 * @typedef {Object} Position
 * @property {number} left
 * @property {number} top
 */

/**
 * @typedef {Object} ElementWithTransition
 * @extends Element
 * @property {function(): void} [_moveCb] - move callback
 * @property {function(): void} [_enterCb] - enter callback
 */

const positionMap = new WeakMap()
const newPositionMap = new WeakMap()

/**
 * Record the current position of an element
 * @param {Element} el
 */
export function recordPosition(el) {
  if (el) {
    positionMap.set(el, getPosition(el))
  }
}

/**
 * Record the new position after DOM update
 * @param {Element} el
 */
export function recordNewPosition(el) {
  if (el) {
    newPositionMap.set(el, getPosition(el))
  }
}

/**
 * Get element position
 * @param {Element} el
 * @returns {Position}
 */
function getPosition(el) {
  const rect = el.getBoundingClientRect()
  return {
    left: rect.left,
    top: rect.top,
  }
}

/**
 * Apply translation to animate element from old to new position
 * @param {Element} oldEl - element at old position
 * @param {Element} newEl - element at new position (can be same as oldEl)
 * @returns {boolean} true if translation was applied
 */
export function applyTranslation(oldEl, newEl) {
  const el = newEl || oldEl
  if (!oldEl || !el) return false

  const oldPos = positionMap.get(oldEl)
  const newPos = newPositionMap.get(el)

  if (!oldPos || !newPos) return false

  return baseApplyTranslation(oldPos, newPos, el)
}

/**
 * Core translation logic (shared between vdom and vapor)
 * @param {Position} oldPos
 * @param {Position} newPos
 * @param {ElementWithTransition} el
 * @returns {boolean}
 */
export function baseApplyTranslation(oldPos, newPos, el) {
  const dx = oldPos.left - newPos.left
  const dy = oldPos.top - newPos.top

  if (dx === 0 && dy === 0) return false

  const s = el.style
  const rect = el.getBoundingClientRect()

  // Calculate scale factors to handle transformed parents
  let scaleX = 1
  let scaleY = 1
  if (el.offsetWidth) scaleX = rect.width / el.offsetWidth
  if (el.offsetHeight) scaleY = rect.height / el.offsetHeight

  // Avoid division noise when scale is effectively 1
  if (!Number.isFinite(scaleX) || scaleX === 0) scaleX = 1
  if (!Number.isFinite(scaleY) || scaleY === 0) scaleY = 1
  if (Math.abs(scaleX - 1) < 0.01) scaleX = 1
  if (Math.abs(scaleY - 1) < 0.01) scaleY = 1

  // Apply transform
  s.transform =
    s.webkitTransform = `translate(${dx / scaleX}px,${dy / scaleY}px)`
  s.transitionDuration = '0s'

  return true
}

/**
 * Check if element has CSS transform transition
 * @param {ElementWithTransition} el
 * @param {Node} root
 * @param {string} moveClass
 * @returns {boolean}
 */
export function hasCSSTransform(el, root, moveClass) {
  // Clone element to test CSS transitions without affecting layout
  const clone = el.cloneNode(true)

  // Remove existing transition classes
  const classes = el.getAttribute('class')
  if (classes) {
    classes.split(/\s+/).forEach(cls => {
      if ((cls && cls.includes('-enter-')) || cls.includes('-leave-')) {
        clone.classList.remove(cls)
      }
    })
  }

  // Add move class
  moveClass.split(/\s+/).forEach(c => c && clone.classList.add(c))
  clone.style.display = 'none'

  const container = root.nodeType === 1 ? root : root.parentNode
  container.appendChild(clone)

  // Check for transform transition
  const computedStyle = window.getComputedStyle(clone)
  const hasTransform =
    computedStyle.transitionProperty.includes('transform') ||
    computedStyle.transitionProperty === 'all'

  container.removeChild(clone)
  return hasTransform
}

/**
 * Handle moved children by applying move class and cleaning up transforms
 * @param {ElementWithTransition} el
 * @param {string} moveClass
 */
export function handleMovedChildren(el, moveClass) {
  const style = el.style

  // Add move class for transition
  el.classList.add(moveClass)

  // Clear inline transform to allow CSS transition
  style.transform = style.webkitTransform = style.transitionDuration = ''

  // Set up callback to clean up after transition ends
  const cb = e => {
    if (e && e.target !== el) return
    if (!e || e.propertyName.endsWith('transform')) {
      el.classList.remove(moveClass)
      el.removeEventListener('transitionend', cb)
    }
  }

  el.addEventListener('transitionend', cb)

  // Store callback for potential early cancellation
  el._moveCb = cb
}

/**
 * Call pending callbacks (move/enter) before starting new animation
 * @param {ElementWithTransition} el
 */
export function callPendingCbs(el) {
  if (el._moveCb) {
    el._moveCb()
  }
  if (el._enterCb) {
    el._enterCb()
  }
}

/**
 * Force browser reflow
 * @param {Node} [el] - optional element, defaults to document.body
 */
export function forceReflow(el) {
  const target = el || document.body
  // Reading offsetHeight forces a reflow
  return target.offsetHeight
}

/**
 * Clear position maps
 */
export function clearPositionMaps() {
  positionMap.clear()
  newPositionMap.clear()
}
