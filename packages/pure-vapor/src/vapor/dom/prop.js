import {
  EMPTY_OBJ,
  camelize,
  canSetValueDirectly,
  includeBooleanAttr,
  isArray,
  isOn,
  isString,
  isSymbol,
  normalizeClass,
  normalizeStyle,
  parseStringStyle,
  toDisplayString,
} from '@vue/shared'
import { mergeProps } from '../../internal/mergeProps.js'
import { onBinding, parseEventName } from './event.js'
import { patchStyle } from '../../internal/domStyle.js'
import {
  shouldSetAsProp,
  shouldSetAsPropForVueCE,
  unsafeToTrustedHTML,
  xlinkNS,
} from '../../internal/domAttr.js'
import { currentInstance } from '../../internal/instance.js'
import { isFunctionalFallthroughKey } from '../../internal/functionalFallthrough.js'
import {
  isApplyingFallthroughProps,
  isVaporComponent,
  shouldUseFunctionalFallthrough,
} from '../component.js'
import { warn } from '../../internal/warning.js'
import {
  domSetAttr,
  domSetAttrNS,
  domSetClassName,
  domSetInnerHTML,
  domSetProperty,
  domSetText,
  domSetTextContent,
} from './domOps.js'

const shouldSkipFallthroughKey = (el, key) => {
  const instance = currentInstance
  return (
    !isApplyingFallthroughProps &&
    el.$root &&
    instance &&
    instance.hasFallthrough &&
    instance.type.inheritAttrs !== false &&
    key in instance.attrs &&
    (!shouldUseFunctionalFallthrough(instance.type) ||
      isFunctionalFallthroughKey(key))
  )
}

export function setProp(el, key, value) {
  if (key in el) {
    setDOMProp(el, key, value)
  } else {
    setAttr(el, key, value)
  }
}

export function setAttr(el, key, value, isSVG = false) {
  if (shouldSkipFallthroughKey(el, key)) {
    return
  }

  if (key === 'true-value') {
    el._trueValue = value
  } else if (key === 'false-value') {
    el._falseValue = value
  }

  if (value !== el[`$${key}`]) {
    el[`$${key}`] = value
    if (isSVG && key.startsWith('xlink:')) {
      if (value != null) {
        domSetAttrNS(el, xlinkNS, key, value)
      } else {
        domSetAttrNS(el, xlinkNS, key.slice(6), null)
      }
    } else {
      if (value != null) {
        domSetAttr(el, key, isSymbol(value) ? String(value) : value)
      } else {
        domSetAttr(el, key, null)
      }
    }
  }
}

export function setDOMProp(el, key, value, forceHydrate = false, attrName) {
  if (shouldSkipFallthroughKey(el, key)) {
    return
  }

  const prev = el[key]
  if (value === prev) {
    return
  }

  let needRemove = false
  if (value === '' || value == null) {
    const type = typeof prev
    if (type === 'boolean') {
      value = includeBooleanAttr(value)
    } else if (value == null && type === 'string') {
      value = ''
      needRemove = true
    } else if (type === 'number') {
      value = 0
      needRemove = true
    }
  }

  try {
    domSetProperty(el, key, value)
  } catch (e) {
    if (__DEV__ && !needRemove) {
      warn(
        `Failed setting prop "${key}" on <${el.tagName.toLowerCase()}>: ` +
          `value ${value} is invalid.`,
        e,
      )
    }
  }
  if (needRemove) {
    domSetAttr(el, attrName || key, null)
  }
}

export function setClass(el, value, isSVG = false, isNormalized = false) {
  if (el.$clsFlags !== undefined) el.$clsFlags = undefined
  if (el.$root) {
    setClassIncremental(el, value, isNormalized)
  } else {
    if (!isNormalized) value = normalizeClass(value)
    if (value !== el.$cls) {
      el.$cls = value
      if (isSVG) {
        domSetAttr(el, 'class', value)
      } else {
        domSetClassName(el, value)
      }
    }
  }
}

export function setClassName(el, flags, cls, prefix = '', suffix = '') {
  if (flags === el.$clsFlags) return

  let value = prefix
  if (isString(cls)) {
    if (flags & 1) value += cls
  } else {
    for (let i = 0, bit = 1; i < cls.length; i++, bit <<= 1) {
      if (flags & bit) value += cls[i]
    }
  }
  if (!prefix && value.charCodeAt(0) === 32) {
    value = value.slice(1)
  }
  if (suffix) {
    value = value ? `${value} ${suffix}` : suffix
  }

  if (el.$root) {
    setClass(el, value, false, true)
  } else {
    el.$cls = value
    domSetClassName(el, value)
  }
  el.$clsFlags = flags
}

function setClassIncremental(el, value, isNormalized = false) {
  const cacheKey = `$clsi${isApplyingFallthroughProps ? '$' : ''}`
  const normalizedValue = isNormalized ? value : normalizeClass(value)
  const prev = el[cacheKey]
  if ((value = el[cacheKey] = normalizedValue) !== prev) {
    const nextList = value.split(/\s+/)
    if (value) {
      el.classList.add(...nextList)
    }
    if (prev) {
      for (const cls of prev.split(/\s+/)) {
        if (!nextList.includes(cls)) el.classList.remove(cls)
      }
    }
  }
}

export function setStyle(el, value) {
  if (el.$root) {
    setStyleIncremental(el, value)
  } else {
    const normalizedValue = normalizeStyle(value)
    patchStyle(el, el.$sty, (el.$sty = normalizedValue))
  }
}

function setStyleIncremental(el, value) {
  const cacheKey = `$styi${isApplyingFallthroughProps ? '$' : ''}`
  const normalizedValue = isString(value)
    ? parseStringStyle(value)
    : normalizeStyle(value)
  patchStyle(el, el[cacheKey], (el[cacheKey] = normalizedValue))
}

export function setValue(el, value) {
  if (shouldSkipFallthroughKey(el, 'value')) {
    return
  }

  el._value = value

  const oldValue = el.tagName === 'OPTION' ? el.getAttribute('value') : el.value
  const newValue = value == null ? '' : value
  if (oldValue !== newValue) {
    domSetProperty(el, 'value', newValue)
  }
  if (value == null) {
    domSetAttr(el, 'value', null)
  }
}

export function setText(el, value) {
  if (el.$txt !== value) {
    el.$txt = value
    domSetText(el, value)
  }
}

export function setElementText(el, value) {
  value = toDisplayString(value)
  if (el.$txt !== value) {
    el.$txt = value
    domSetTextContent(el, value)
  }
}

export function setBlockText(block, value) {
  value = value == null ? '' : value
  if (block.$txt !== value) {
    setTextToBlock(block, (block.$txt = value))
  }
}

function warnCannotSetProp(prop) {
  warn(
    `Extraneous non-props attributes (` +
      `${prop}) ` +
      `were passed to component but could not be automatically inherited ` +
      `because component renders text or multiple root nodes.`,
  )
}

function setTextToBlock(block, value) {
  if (block instanceof Node) {
    if (block instanceof Element) {
      domSetTextContent(block, value)
    } else if (__DEV__) {
      warnCannotSetProp('textContent')
    }
  } else if (isVaporComponent(block)) {
    setTextToBlock(block.block, value)
  } else if (isArray(block)) {
    if (__DEV__) {
      warnCannotSetProp('textContent')
    }
  } else {
    setTextToBlock(block.nodes, value)
  }
}

/**
 * 设置 DOM 元素的 innerHTML。
 * 它只处理真实的 DOM 元素（Node），不做递归或类型判断。
 * 适用场景：直接操作真实 DOM 元素，如根节点或已知是 Element 的节点。
 */
export function setHtml(el, value) {
  value = value == null ? '' : unsafeToTrustedHTML(value)
  if (el.$html !== value) {
    el.$html = value
    domSetInnerHTML(el, value)
  }
}

/**
 * 设置 block（Vapor 渲染块）的 innerHTML。
 * - Node：是 Element 则直接设置，否则开发模式下警告。
 * - Vapor 组件：取其 block 继续递归。
 * - 数组：开发模式下警告（不能直接对数组设置 innerHTML）。
 * - 其他（Block 对象）：取其 nodes 继续递归。
 */
export function setBlockHtml(block, value) {
  value = value == null ? '' : unsafeToTrustedHTML(value)
  if (block.$html !== value) {
    setHtmlToBlock(block, (block.$html = value))
  }
}

/**
 * 私有方法： 递归查找真正的 DOM Element 并设置 innerHTML
 *  */
function setHtmlToBlock(block, value) {
  if (block instanceof Node) {
    if (block instanceof Element) {
      domSetInnerHTML(block, value)
    } else if (__DEV__) {
      warnCannotSetProp('innerHTML')
    }
  } else if (isVaporComponent(block)) {
    setHtmlToBlock(block.block, value)
  } else if (isArray(block)) {
    if (__DEV__) {
      warnCannotSetProp('innerHTML')
    }
  } else {
    setHtmlToBlock(block.nodes, value)
  }
}

export function setDynamicProps(el, args, isSVG) {
  const props = args.length > 1 ? mergeProps(...args) : args[0] || EMPTY_OBJ
  const cacheKey = `$dprops${isApplyingFallthroughProps ? '$' : ''}`
  const prevProps = el[cacheKey]
  const nextProps = Object.create(null)

  if (prevProps) {
    for (const key in prevProps) {
      if (!(key in props)) {
        setDynamicProp(el, key, null, isSVG)
      }
    }
  }

  const keys = Object.keys(props)
  for (let i = 0; i < keys.length; i++) {
    const key = keys[i]
    const value = props[key]
    nextProps[key] = value
    if (
      prevProps &&
      key in prevProps &&
      !isOn(key) &&
      (value == null || typeof value !== 'object') &&
      Object.is(prevProps[key], value)
    ) {
      continue
    }
    setDynamicProp(el, key, value, isSVG)
  }

  el[cacheKey] = nextProps
}

export function setDynamicProp(el, key, value, isSVG = false) {
  let forceHydrate = false
  if (key === 'class') {
    setClass(el, value, isSVG)
  } else if (key === 'style') {
    setStyle(el, value)
  } else if (isOn(key)) {
    if (shouldSkipFallthroughKey(el, key)) {
      return
    }
    const [event, options] = parseEventName(key)
    onBinding(el, event, value, options)
  } else if (
    (forceHydrate = key[0] === '.')
      ? ((key = key.slice(1)), true)
      : key[0] === '^'
        ? ((key = key.slice(1)), false)
        : shouldSetAsProp(el, key, value, isSVG)
  ) {
    if (key === 'innerHTML') {
      setHtml(el, value)
    } else if (key === 'textContent') {
      setElementText(el, value)
    } else if (key === 'value' && canSetValueDirectly(el.tagName)) {
      setValue(el, value, forceHydrate)
    } else {
      setDOMProp(el, key, value, forceHydrate)
    }
  } else if (
    el._isVueCE &&
    (shouldSetAsPropForVueCE(el, key) ||
      (el._def &&
        el._def.__asyncLoader &&
        (/[A-Z]/.test(key) || !isString(value))))
  ) {
    setDOMProp(el, camelize(key), value, forceHydrate, key)
  } else {
    setAttr(el, key, value, isSVG)
  }
  return value
}

let isOptimized = false

export function optimizePropertyLookup() {
  if (isOptimized) return
  isOptimized = true
  const proto = Element.prototype
  proto.$transition = undefined
  proto.$key = undefined
  proto.$fc = proto.$evtclick = undefined
  proto.$root = false
  proto.$clsFlags = undefined
  proto.$html = proto.$cls = proto.$sty = ''
  Text.prototype.$txt = undefined
}
