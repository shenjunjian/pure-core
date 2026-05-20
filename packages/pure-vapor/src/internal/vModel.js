import {
  isArray,
  isSet,
  looseEqual,
  looseIndexOf,
  looseToNumber,
} from '@vue/shared'
import { addEventListener } from '../vapor/dom/event.js'
import { nextTick } from './scheduler.js'
import { warn } from './warning.js'

const assignKey = Symbol('_assign')

function onCompositionStart(e) {
  e.target.composing = true
}

function onCompositionEnd(e) {
  const target = e.target
  if (target.composing) {
    target.composing = false
    target.dispatchEvent(new Event('input'))
  }
}

function castValue(value, trim, number) {
  if (trim) value = value.trim()
  if (number) value = looseToNumber(value)
  return value
}

export function vModelTextInit(el, trim, number, lazy, set) {
  addEventListener(el, lazy ? 'change' : 'input', e => {
    if (e.target.composing) return
    ;(set || el[assignKey])(
      castValue(el.value, trim, number || el.type === 'number'),
    )
  })
  if (trim || number) {
    addEventListener(el, 'change', () => {
      el.value = castValue(el.value, trim, number || el.type === 'number')
    })
  }
  if (!lazy) {
    addEventListener(el, 'compositionstart', onCompositionStart)
    addEventListener(el, 'compositionend', onCompositionEnd)
    addEventListener(el, 'change', onCompositionEnd)
  }
}

export function vModelTextUpdate(el, oldValue, value, trim, number, lazy) {
  if (el.composing) return
  const elValue =
    (number || el.type === 'number') && !/^0\d/.test(el.value)
      ? looseToNumber(el.value)
      : el.value
  const newValue = value == null ? '' : value

  if (elValue === newValue) {
    return
  }

  const rootNode = el.getRootNode()
  if (
    (rootNode instanceof Document || rootNode instanceof ShadowRoot) &&
    rootNode.activeElement === el &&
    el.type !== 'range'
  ) {
    if (lazy && value === oldValue) {
      return
    }
    if (trim && el.value.trim() === newValue) {
      return
    }
  }

  el.value = newValue
}

export function vModelCheckboxInit(el, set) {
  addEventListener(el, 'change', () => {
    const assign = set || el[assignKey]
    const modelValue = el._modelValue
    const elementValue = vModelGetValue(el)
    const checked = el.checked
    if (isArray(modelValue)) {
      const index = looseIndexOf(modelValue, elementValue)
      const found = index !== -1
      if (checked && !found) {
        assign(modelValue.concat(elementValue))
      } else if (!checked && found) {
        const filtered = [...modelValue]
        filtered.splice(index, 1)
        assign(filtered)
      }
    } else if (isSet(modelValue)) {
      const cloned = new Set(modelValue)
      if (checked) {
        cloned.add(elementValue)
      } else {
        cloned.delete(elementValue)
      }
      assign(cloned)
    } else {
      assign(getCheckboxValue(el, checked))
    }
  })
}

export function vModelCheckboxUpdate(el, oldValue, value, rawValue) {
  if (rawValue == null) rawValue = vModelGetValue(el)
  el._modelValue = value
  let checked

  if (isArray(value)) {
    checked = looseIndexOf(value, rawValue) > -1
  } else if (isSet(value)) {
    checked = value.has(rawValue)
  } else {
    if (value === oldValue) return
    checked = looseEqual(value, getCheckboxValue(el, true))
  }

  if (el.checked !== checked) {
    el.checked = checked
  }
}

export function vModelGetValue(el) {
  return '_value' in el ? el._value : el.value
}

function getCheckboxValue(el, checked) {
  const key = checked ? '_trueValue' : '_falseValue'
  if (key in el) {
    return el[key]
  }
  const attr = checked ? 'true-value' : 'false-value'
  if (el.hasAttribute(attr)) {
    return el.getAttribute(attr)
  }
  return checked
}

export function vModelSelectInit(el, value, number, set) {
  const isSetModel = isSet(value)
  addEventListener(el, 'change', () => {
    const selectedVal = Array.prototype.filter
      .call(el.options, o => o.selected)
      .map(o => (number ? looseToNumber(vModelGetValue(o)) : vModelGetValue(o)))
    ;(set || el[assignKey])(
      el.multiple
        ? isSetModel
          ? new Set(selectedVal)
          : selectedVal
        : selectedVal[0],
    )
    el._assigning = true
    nextTick(() => {
      el._assigning = false
    })
  })
}

export function vModelSetSelected(el, value) {
  if (el._assigning) return
  const isMultiple = el.multiple
  const isArrayValue = isArray(value)
  if (isMultiple && !isArrayValue && !isSet(value)) {
    if (__DEV__) {
      warn(
        `<select multiple v-model> expects an Array or Set value for its binding, ` +
          `but got ${Object.prototype.toString.call(value).slice(8, -1)}.`,
      )
    }
    return
  }

  for (let i = 0, l = el.options.length; i < l; i++) {
    const option = el.options[i]
    const optionValue = vModelGetValue(option)
    if (isMultiple) {
      if (isArrayValue) {
        const optionType = typeof optionValue
        if (optionType === 'string' || optionType === 'number') {
          option.selected = value.some(v => String(v) === String(optionValue))
        } else {
          option.selected = looseIndexOf(value, optionValue) > -1
        }
      } else {
        option.selected = value.has(optionValue)
      }
    } else if (looseEqual(vModelGetValue(option), value)) {
      if (el.selectedIndex !== i) el.selectedIndex = i
      return
    }
  }
  if (!isMultiple && el.selectedIndex !== -1) {
    el.selectedIndex = -1
  }
}
