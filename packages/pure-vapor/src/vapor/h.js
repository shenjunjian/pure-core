import { isRef, unref } from '@vue/reactivity'
import {
  isArray,
  isFunction,
  isObject,
  isOn,
  isString,
  toDisplayString,
} from '@vue/shared'
import { warn } from '../internal/warning.js'
import { isBlock } from './block.js'
import { createComponentWithFallback, createPlainElement } from './component.js'
import { createDynamicComponent } from './apiCreateDynamicComponent.js'
import { createTextNode } from './dom/node.js'
import { DynamicFragment } from './fragment.js'
import { renderEffect } from './renderEffect.js'

/**
 * Vapor-native Fragment symbol (not VDOM Fragment).
 * `h(Fragment, …)` returns a multi-root Block (array or reactive fragment).
 */
export const Fragment = Symbol(__DEV__ ? 'Fragment' : '')

/**
 * Vapor-native `h` — returns a Block (DOM / component / fragment), not a VNode.
 *
 * Reactive updates follow vapor conventions:
 * - prop getters / refs: `h('div', { class: () => cls.value })` or `{ class: cls }`
 * - children getters / refs: `h('div', null, () => msg.value)` or `h('div', null, msg)`
 * Snapshot values only render once.
 *
 * Argument overloads match runtime-core `h` (named slots require explicit `null` props).
 *
 * @param {string | object | Function | symbol | import('@vue/reactivity').Ref} type
 * @param {object | any} [propsOrChildren]
 * @param {any} [children]
 */
export function h(type, propsOrChildren, children) {
  const l = arguments.length
  let props
  let kids

  if (l === 2) {
    if (isObject(propsOrChildren) && !isArray(propsOrChildren)) {
      if (isBlock(propsOrChildren)) {
        props = null
        kids = propsOrChildren
      } else {
        // plain object → props (named slots need h(type, null, slots))
        props = propsOrChildren
        kids = undefined
      }
    } else {
      props = null
      kids = propsOrChildren
    }
  } else {
    props = propsOrChildren
    if (l > 3) {
      kids = Array.prototype.slice.call(arguments, 2)
    } else {
      kids = children
    }
  }

  if (type === Fragment) {
    return normalizeFragment(kids)
  }

  if (isRef(type)) {
    return createDynamicComponent(
      () => unref(type),
      normalizeProps(props),
      normalizeChildrenToSlots(kids),
    )
  }

  if (__DEV__) {
    warnIfNonVaporComponent(type)
  }

  const rawProps = normalizeProps(props)
  const rawSlots = normalizeChildrenToSlots(kids)

  if (isString(type)) {
    return createPlainElement(type, rawProps, rawSlots, true)
  }

  return createComponentWithFallback(type, rawProps, rawSlots, true)
}

function normalizeProps(props) {
  if (props == null) return null
  if (!isObject(props) || isArray(props)) return null

  const rawProps = {}
  for (const key in props) {
    const value = props[key]
    if (isOn(key) && isFunction(value)) {
      // Event handlers must be getters that return the handler (vapor rawProps).
      rawProps[key] = () => value
    } else if (isRef(value)) {
      rawProps[key] = () => unref(value)
    } else {
      // Functions are treated as getters (compiler-vapor style).
      rawProps[key] = value
    }
  }
  return rawProps
}

function normalizeChildrenToSlots(kids) {
  if (kids == null || kids === true || kids === false) return null

  // Named slots object (only as 3rd argument / explicit children)
  if (isNamedSlotsObject(kids)) {
    return normalizeNamedSlots(kids)
  }

  if (isRef(kids) || isFunction(kids)) {
    return {
      default: () =>
        createReactiveBlock(() => (isRef(kids) ? unref(kids) : kids())),
    }
  }

  return {
    default: () => normalizeToBlock(kids),
  }
}

function isNamedSlotsObject(val) {
  if (!isObject(val) || isArray(val) || isBlock(val) || isRef(val)) {
    return false
  }
  let hasFn = false
  for (const key in val) {
    if (key === '$') {
      hasFn = true
      continue
    }
    const v = val[key]
    if (v != null && !isFunction(v)) return false
    if (isFunction(v)) hasFn = true
  }
  return hasFn
}

function normalizeNamedSlots(slots) {
  const normalized = {}
  for (const key in slots) {
    if (key === '$') {
      normalized.$ = slots.$
      continue
    }
    const fn = slots[key]
    if (!isFunction(fn)) continue
    normalized[key] = (...args) => {
      const result = fn(...args)
      if (isRef(result) || isFunction(result)) {
        return createReactiveBlock(() =>
          isRef(result)
            ? unref(result)
            : isFunction(result)
              ? result()
              : result,
        )
      }
      return normalizeToBlock(result)
    }
  }
  return normalized
}

function normalizeFragment(kids) {
  if (kids == null || kids === true || kids === false) return []
  if (isRef(kids) || isFunction(kids)) {
    return createReactiveBlock(() => (isRef(kids) ? unref(kids) : kids()))
  }
  return normalizeToBlock(kids)
}

/**
 * Self-updating block: re-runs getter when its reactive deps change and
 * swaps content via DynamicFragment (same pattern as createIf / dynamic slots).
 */
function createReactiveBlock(getter) {
  const frag = new DynamicFragment(__DEV__ ? 'h' : undefined)
  renderEffect(() => {
    const value = getter()
    const resolved = isRef(value) ? unref(value) : value
    frag.update(() => normalizeToBlock(resolved), blockKey(resolved))
  })
  return frag
}

function blockKey(value) {
  if (value == null || value === true || value === false) return ''
  if (isBlock(value) || isArray(value)) return value
  return toDisplayString(value)
}

function normalizeToBlock(value) {
  if (value == null || value === true || value === false) {
    return createTextNode('')
  }
  if (isRef(value)) {
    return normalizeToBlock(unref(value))
  }
  if (isFunction(value)) {
    return normalizeToBlock(value())
  }
  if (isBlock(value)) {
    return value
  }
  if (isArray(value)) {
    const blocks = []
    for (let i = 0; i < value.length; i++) {
      const child = value[i]
      if (child == null || child === true || child === false) continue
      blocks.push(normalizeToBlock(child))
    }
    return blocks
  }
  return createTextNode(toDisplayString(value))
}

function warnIfNonVaporComponent(type) {
  if (type == null || isString(type) || type === Fragment) return
  if (isFunction(type)) return
  if (isObject(type) && type.__vapor) return
  if (isObject(type) && (isFunction(type.setup) || isFunction(type.render))) {
    warn(
      `h() received a component without __vapor. ` +
        `Use defineVaporComponent() / defineComponent() from pure-vapor. ` +
        `VDOM components are not supported.`,
    )
    return
  }
  if (isObject(type)) {
    warn(
      `h() received an invalid type. Expected a string tag, vapor component, ` +
        `or Fragment.`,
    )
  }
}
