import { shallowReadonly, toRaw } from '@vue/reactivity'
import {
  EMPTY_OBJ,
  camelize,
  capitalize,
  extend,
  hasOwn,
  hyphenate,
  isArray,
  isFunction,
  isObject,
  isReservedProp,
  isString,
  isSymbol,
  makeMap,
  toRawType,
} from '@vue/shared'
import { restoreCurrentInstance, setCurrentInstance } from './instance.js'
import { warn } from './warning.js'

const BooleanFlags = {
  shouldCast: 0,
  shouldCastTrue: 1,
}

export function resolvePropValue(
  options,
  key,
  value,
  instance,
  resolveDefault,
  isAbsent = false,
) {
  const opt = options[key]
  if (opt != null) {
    const hasDefault = hasOwn(opt, 'default')
    if (hasDefault && value === undefined) {
      const defaultValue = opt.default
      if (
        opt.type !== Function &&
        !opt.skipFactory &&
        isFunction(defaultValue)
      ) {
        const cachedDefaults =
          instance.propsDefaults || (instance.propsDefaults = {})
        if (hasOwn(cachedDefaults, key)) {
          value = cachedDefaults[key]
        } else {
          value = cachedDefaults[key] = resolveDefault(
            defaultValue,
            instance,
            key,
          )
        }
      } else {
        value = defaultValue
      }
      if (instance.ce) {
        instance.ce._setProp(key, value)
      }
    }
    if (opt[BooleanFlags.shouldCast]) {
      if (isAbsent && !hasDefault) {
        value = false
      } else if (
        opt[BooleanFlags.shouldCastTrue] &&
        (value === '' || value === hyphenate(key))
      ) {
        value = true
      }
    }
  }
  return value
}

export function baseNormalizePropsOptions(raw, normalized, needCastKeys) {
  if (isArray(raw)) {
    for (let i = 0; i < raw.length; i++) {
      if (__DEV__ && !isString(raw[i])) {
        warn(`props must be strings when using array syntax.`, raw[i])
      }
      const normalizedKey = camelize(raw[i])
      if (validatePropName(normalizedKey)) {
        normalized[normalizedKey] = EMPTY_OBJ
      }
    }
  } else if (raw) {
    if (__DEV__ && !isObject(raw)) {
      warn(`invalid props options`, raw)
    }
    for (const key in raw) {
      const normalizedKey = camelize(key)
      if (validatePropName(normalizedKey)) {
        const opt = raw[key]
        const prop = (normalized[normalizedKey] =
          isArray(opt) || isFunction(opt) ? { type: opt } : extend({}, opt))
        const propType = prop.type
        let shouldCast = false
        let shouldCastTrue = true

        if (isArray(propType)) {
          for (let index = 0; index < propType.length; ++index) {
            const type = propType[index]
            const typeName = isFunction(type) && type.name

            if (typeName === 'Boolean') {
              shouldCast = true
              break
            } else if (typeName === 'String') {
              shouldCastTrue = false
            }
          }
        } else {
          shouldCast = isFunction(propType) && propType.name === 'Boolean'
        }

        prop[BooleanFlags.shouldCast] = shouldCast
        prop[BooleanFlags.shouldCastTrue] = shouldCastTrue
        if (shouldCast || hasOwn(prop, 'default')) {
          needCastKeys.push(normalizedKey)
        }
      }
    }
  }
}

function validatePropName(key) {
  if (key[0] !== '$' && !isReservedProp(key)) {
    return true
  } else if (__DEV__) {
    warn(`Invalid prop name: "${key}" is a reserved property.`)
  }
  return false
}

function getType(ctor) {
  if (ctor === null) {
    return 'null'
  }
  if (typeof ctor === 'function') {
    return ctor.name || ''
  } else if (typeof ctor === 'object') {
    const name = ctor.constructor && ctor.constructor.name
    return name || ''
  }
  return ''
}

export function validateProps(rawProps, resolvedProps, options) {
  resolvedProps = toRaw(resolvedProps)
  const camelizePropsKey = Object.keys(rawProps).map(key => camelize(key))
  for (const key in options) {
    const opt = options[key]
    if (opt != null) {
      validateProp(
        key,
        resolvedProps[key],
        opt,
        resolvedProps,
        !camelizePropsKey.includes(key),
      )
    }
  }
}

function validateProp(key, value, propOptions, resolvedProps, isAbsent) {
  const type = propOptions.type
  const required = propOptions.required
  const validator = propOptions.validator
  const skipCheck = propOptions.skipCheck
  if (required && isAbsent) {
    warn('Missing required prop: "' + key + '"')
    return
  }
  if (value == null && !required) {
    return
  }
  if (type != null && type !== true && !skipCheck) {
    let isValid = false
    const types = isArray(type) ? type : [type]
    const expectedTypes = []
    for (let i = 0; i < types.length && !isValid; i++) {
      const { valid, expectedType } = assertType(value, types[i])
      expectedTypes.push(expectedType || '')
      isValid = valid
    }
    if (!isValid) {
      warn(getInvalidTypeMessage(key, value, expectedTypes))
      return
    }
  }
  if (
    validator &&
    !validator(value, __DEV__ ? shallowReadonly(resolvedProps) : resolvedProps)
  ) {
    warn('Invalid prop: custom validator check failed for prop "' + key + '".')
  }
}

const isSimpleType = /*@__PURE__*/ makeMap(
  'String,Number,Boolean,Function,Symbol,BigInt',
)

function assertType(value, type) {
  let valid
  const expectedType = getType(type)
  if (expectedType === 'null') {
    valid = value === null
  } else if (isSimpleType(expectedType)) {
    const t = typeof value
    valid = t === expectedType.toLowerCase()
    if (!valid && t === 'object') {
      valid = value instanceof type
    }
  } else if (expectedType === 'Object') {
    valid = isObject(value)
  } else if (expectedType === 'Array') {
    valid = isArray(value)
  } else {
    valid = value instanceof type
  }
  return {
    valid,
    expectedType,
  }
}

function getInvalidTypeMessage(name, value, expectedTypes) {
  if (expectedTypes.length === 0) {
    return (
      `Prop type [] for prop "${name}" won't match anything.` +
      ` Did you mean to use type Array instead?`
    )
  }
  let message =
    `Invalid prop: type check failed for prop "${name}".` +
    ` Expected ${expectedTypes.map(capitalize).join(' | ')}`
  const expectedType = expectedTypes[0]
  const receivedType = toRawType(value)
  const expectedValue = styleValue(value, expectedType)
  const receivedValue = styleValue(value, receivedType)
  if (
    expectedTypes.length === 1 &&
    isExplicable(expectedType) &&
    isCoercible(expectedType, receivedType)
  ) {
    message += ` with value ${expectedValue}`
  }
  message += `, got ${receivedType} `
  if (isExplicable(receivedType)) {
    message += `with value ${receivedValue}.`
  }
  return message
}

function styleValue(value, type) {
  if (isSymbol(value)) {
    return value.toString()
  } else if (type === 'String') {
    return `"${value}"`
  } else if (type === 'Number') {
    return `${Number(value)}`
  }
  return `${value}`
}

function isExplicable(type) {
  const explicitTypes = ['string', 'number', 'boolean']
  return explicitTypes.some(elem => type.toLowerCase() === elem)
}

function isCoercible(...args) {
  return args.every(elem => {
    const value = elem.toLowerCase()
    return value !== 'boolean' && value !== 'symbol'
  })
}

export function baseResolveDefault(factory, instance, key) {
  let value
  const prev = setCurrentInstance(instance)
  const props = toRaw(instance.props)
  value = factory.call(null, props)
  restoreCurrentInstance(prev)
  return value
}
