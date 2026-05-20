import {
  camelize,
  getModifierPropName,
  hasOwn,
  hyphenate,
  isFunction,
  isOn,
  isString,
  looseToNumber,
  toHandlerKey,
} from '@vue/shared'
import { formatComponentName } from './component.js'
import { ErrorCodes, callWithAsyncErrorHandling } from './errorHandling.js'
import { warn } from './warning.js'

export function defaultPropGetter(props, key) {
  return props[key]
}

function getModelModifiers(props, modelName, getter) {
  return (
    getter(props, getModifierPropName(modelName)) ||
    getter(props, `${camelize(modelName)}Modifiers`) ||
    getter(props, `${hyphenate(modelName)}Modifiers`)
  )
}

export function baseEmit(instance, props, getter, event, ...rawArgs) {
  if (instance.isUnmounted) return
  if (__DEV__) {
    const emitsOptions = instance.emitsOptions
    const propsOptions = instance.propsOptions
    if (emitsOptions) {
      if (
        !(event in emitsOptions) &&
        (!propsOptions ||
          !propsOptions[0] ||
          !(toHandlerKey(camelize(event)) in propsOptions[0]))
      ) {
        warn(
          `Component emitted event "${event}" but it is neither declared in ` +
            `the emits option nor as an "${toHandlerKey(camelize(event))}" prop.`,
        )
      } else {
        const validator = emitsOptions[event]
        if (isFunction(validator)) {
          const isValid = validator(...rawArgs)
          if (!isValid) {
            warn(
              `Invalid event arguments: event validation failed for event "${event}".`,
            )
          }
        }
      }
    }
  }

  let args = rawArgs
  const isModelListener = event.startsWith('update:')
  const modifiers =
    isModelListener && getModelModifiers(props, event.slice(7), getter)
  if (modifiers) {
    if (modifiers.trim) {
      args = rawArgs.map(a => (isString(a) ? a.trim() : a))
    }
    if (modifiers.number) {
      args = rawArgs.map(looseToNumber)
    }
  }

  if (__DEV__) {
    const lowerCaseEvent = event.toLowerCase()
    if (
      lowerCaseEvent !== event &&
      getter(props, toHandlerKey(lowerCaseEvent))
    ) {
      warn(
        `Event "${lowerCaseEvent}" is emitted in component ` +
          `${formatComponentName(instance, instance.type)} but the handler is registered for "${event}". ` +
          `Note that HTML attributes are case-insensitive and you cannot use ` +
          `v-on to listen to camelCase events when using in-DOM templates. ` +
          `You should probably use "${hyphenate(event)}" instead of "${event}".`,
      )
    }
  }

  let handlerName
  let handler =
    getter(props, (handlerName = toHandlerKey(event))) ||
    getter(props, (handlerName = toHandlerKey(camelize(event))))
  if (!handler && isModelListener) {
    handler = getter(props, (handlerName = toHandlerKey(hyphenate(event))))
  }

  if (handler) {
    callWithAsyncErrorHandling(
      handler,
      instance,
      ErrorCodes.COMPONENT_EVENT_HANDLER,
      args,
    )
  }

  const onceHandler = getter(props, handlerName + `Once`)
  if (onceHandler) {
    if (!instance.emitted) {
      instance.emitted = {}
    } else if (instance.emitted[handlerName]) {
      return
    }
    instance.emitted[handlerName] = true
    callWithAsyncErrorHandling(
      onceHandler,
      instance,
      ErrorCodes.COMPONENT_EVENT_HANDLER,
      args,
    )
  }
}

export function isEmitListener(options, key) {
  if (!options || !isOn(key)) {
    return false
  }

  key = key.slice(2).replace(/Once$/, '')
  return (
    hasOwn(options, key[0].toLowerCase() + key.slice(1)) ||
    hasOwn(options, hyphenate(key)) ||
    hasOwn(options, key)
  )
}
