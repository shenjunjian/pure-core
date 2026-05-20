import { hyphenate } from '@vue/shared'

const systemModifiers = ['ctrl', 'shift', 'alt', 'meta']

const modifierGuards = {
  stop: e => e.stopPropagation(),
  prevent: e => e.preventDefault(),
  self: e => e.target !== e.currentTarget,
  ctrl: e => !e.ctrlKey,
  shift: e => !e.shiftKey,
  alt: e => !e.altKey,
  meta: e => !e.metaKey,
  left: e => 'button' in e && e.button !== 0,
  middle: e => 'button' in e && e.button !== 1,
  right: e => 'button' in e && e.button !== 2,
  exact: (e, modifiers) =>
    systemModifiers.some(m => e[`${m}Key`] && !modifiers.includes(m)),
}

export function withModifiers(fn, modifiers) {
  if (!fn) return fn
  const cache = fn._withMods || (fn._withMods = {})
  const cacheKey = modifiers.join('.')
  return (
    cache[cacheKey] ||
    (cache[cacheKey] = (event, ...args) => {
      for (let i = 0; i < modifiers.length; i++) {
        const guard = modifierGuards[modifiers[i]]
        if (guard && guard(event, modifiers)) return
      }
      return fn(event, ...args)
    })
  )
}

const keyNames = {
  esc: 'escape',
  space: ' ',
  up: 'arrow-up',
  left: 'arrow-left',
  right: 'arrow-right',
  down: 'arrow-down',
  delete: 'backspace',
}

export function withKeys(fn, modifiers) {
  const cache = fn._withKeys || (fn._withKeys = {})
  const cacheKey = modifiers.join('.')
  return (
    cache[cacheKey] ||
    (cache[cacheKey] = event => {
      if (!('key' in event)) {
        return
      }
      const eventKey = hyphenate(event.key)
      for (let i = 0; i < modifiers.length; i++) {
        const k = modifiers[i]
        if (k === eventKey || keyNames[k] === eventKey) {
          return fn(event)
        }
      }
    })
  )
}
