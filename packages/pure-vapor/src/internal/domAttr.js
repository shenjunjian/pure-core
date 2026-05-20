import {
  camelize,
  isFunction,
  isNativeOn,
  isString,
  shouldSetAsAttr,
} from '@vue/shared'

export const xlinkNS = 'http://www.w3.org/1999/xlink'

export function shouldSetAsProp(el, key, value, isSVG) {
  if (isSVG) {
    if (key === 'innerHTML' || key === 'textContent') {
      return true
    }
    if (key in el && isNativeOn(key) && isFunction(value)) {
      return true
    }
    return false
  }

  if (shouldSetAsAttr(el.tagName, key)) {
    return false
  }

  if (isNativeOn(key) && isString(value)) {
    return false
  }

  return key in el
}

export function shouldSetAsPropForVueCE(el, key) {
  const props = el._def && el._def.props
  if (!props) {
    return false
  }
  const camelKey = camelize(key)
  if (Array.isArray(props)) {
    for (let i = 0; i < props.length; i++) {
      if (camelize(props[i]) === camelKey) return true
    }
    return false
  }
  const keys = Object.keys(props)
  for (let i = 0; i < keys.length; i++) {
    if (camelize(keys[i]) === camelKey) return true
  }
  return false
}

export function unsafeToTrustedHTML(value) {
  return value
}
