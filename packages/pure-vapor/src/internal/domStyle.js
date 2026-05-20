import { capitalize, hyphenate, isArray, isString } from '@vue/shared'
import { warn } from './warning.js'
import { vShowHidden, vShowOriginalDisplay } from './vShow.js'
import {
  domSetStyle,
  domSetStyleCssText,
  domSetStyleProperty,
} from '../vapor/dom/domOps.js'

const displayRE = /(?:^|;)\s*display\s*:/

const semicolonRE = /[^\\];\s*$/
const importantRE = /\s*!important$/

const prefixes = ['Webkit', 'Moz', 'ms']
const prefixCache = {}

function autoPrefix(style, rawName) {
  const cached = prefixCache[rawName]
  if (cached) {
    return cached
  }
  let name = rawName
  if (name !== 'filter' && name in style) {
    return (prefixCache[rawName] = name)
  }
  name = capitalize(name)
  for (let i = 0; i < prefixes.length; i++) {
    const prefixed = prefixes[i] + name
    if (prefixed in style) {
      return (prefixCache[rawName] = prefixed)
    }
  }
  return rawName
}

function queueStyleProp(style, name, rawVal) {
  if (isArray(rawVal)) {
    for (let i = 0; i < rawVal.length; i++) {
      queueStyleProp(style, name, rawVal[i])
    }
    return
  }
  const val = rawVal == null ? '' : String(rawVal)
  if (__DEV__) {
    if (semicolonRE.test(val)) {
      warn(`Unexpected semicolon at the end of '${name}' style value: '${val}'`)
    }
  }
  if (name.startsWith('--')) {
    domSetStyleProperty(style, name, val)
  } else {
    const prefixed = autoPrefix(style, name)
    if (importantRE.test(val)) {
      domSetStyleProperty(
        style,
        hyphenate(prefixed),
        val.replace(importantRE, ''),
        'important',
      )
    } else {
      domSetStyle(style, prefixed, val)
    }
  }
}

export function patchStyle(el, prev, next) {
  const style = el.style
  const isCssString = isString(next)
  let hasControlledDisplay = false
  if (next && !isCssString) {
    if (prev) {
      if (!isString(prev)) {
        for (const key in prev) {
          if (next[key] == null) {
            queueStyleProp(style, key, '')
          }
        }
      } else {
        const parts = prev.split(';')
        for (let i = 0; i < parts.length; i++) {
          const prevStyle = parts[i]
          const key = prevStyle.slice(0, prevStyle.indexOf(':')).trim()
          if (next[key] == null) {
            queueStyleProp(style, key, '')
          }
        }
      }
    }
    for (const key in next) {
      if (key === 'display') {
        hasControlledDisplay = true
      }
      const value = next[key]
      if (value != null) {
        queueStyleProp(style, key, value)
      } else {
        queueStyleProp(style, key, '')
      }
    }
  } else {
    if (isCssString) {
      if (prev !== next) {
        domSetStyleCssText(el, next)
        hasControlledDisplay = displayRE.test(next)
      }
    } else if (prev) {
      el.removeAttribute('style')
    }
  }
  if (vShowOriginalDisplay in el) {
    el[vShowOriginalDisplay] = hasControlledDisplay ? style.display : ''
    if (el[vShowHidden]) {
      domSetStyle(style, 'display', 'none')
    }
  }
}
