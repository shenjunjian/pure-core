import { customRef, ref } from '@vue/reactivity'
import {
  EMPTY_OBJ,
  camelize,
  getModifierPropName,
  hasChanged,
  hyphenate,
} from '@vue/shared'
import { getCurrentGenericInstance } from './instance.js'
import { warn } from './warning.js'
import { watchSyncEffect } from './apiWatch.js'
import { defaultPropGetter } from './emit.js'

export function useModel(props, name, options = EMPTY_OBJ) {
  const i = getCurrentGenericInstance()
  if (__DEV__ && !i) {
    warn(`useModel() called without active instance.`)
    return ref()
  }

  const camelizedName = camelize(name)
  if (__DEV__ && i.propsOptions && !i.propsOptions[0][camelizedName]) {
    warn(`useModel() called with prop "${name}" which is not declared.`)
    return ref()
  }

  const hyphenatedName = hyphenate(name)
  const modifiers = getModelModifiers(props, camelizedName, defaultPropGetter)

  const res = customRef((track, trigger) => {
    let localValue
    let prevSetValue = EMPTY_OBJ
    let prevEmittedValue

    watchSyncEffect(() => {
      const propValue = props[camelizedName]
      if (hasChanged(localValue, propValue)) {
        localValue = propValue
        trigger()
      }
    })

    return {
      get() {
        track()
        return options.get ? options.get(localValue) : localValue
      },

      set(value) {
        const emittedValue = options.set ? options.set(value) : value
        if (
          !hasChanged(emittedValue, localValue) &&
          !(prevSetValue !== EMPTY_OBJ && hasChanged(value, prevSetValue))
        ) {
          return
        }

        let rawPropKeys
        let parentPassedModelValue = false
        let parentPassedModelUpdater = false

        if (i.rawKeys) {
          rawPropKeys = i.rawKeys()
        } else if (i.vnode && i.vnode.props) {
          rawPropKeys = Object.keys(i.vnode.props)
        }

        if (rawPropKeys) {
          for (const key of rawPropKeys) {
            if (
              key === name ||
              key === camelizedName ||
              key === hyphenatedName
            ) {
              parentPassedModelValue = true
            } else if (
              key === `onUpdate:${name}` ||
              key === `onUpdate:${camelizedName}` ||
              key === `onUpdate:${hyphenatedName}`
            ) {
              parentPassedModelUpdater = true
            }
          }
        }

        if (!parentPassedModelValue || !parentPassedModelUpdater) {
          localValue = value
          trigger()
        }

        i.emit(`update:${name}`, emittedValue)
        if (
          hasChanged(value, emittedValue) &&
          hasChanged(value, prevSetValue) &&
          !hasChanged(emittedValue, prevEmittedValue)
        ) {
          trigger()
        }
        prevSetValue = value
        prevEmittedValue = emittedValue
      },
    }
  })

  res[Symbol.iterator] = () => {
    let idx = 0
    return {
      next() {
        if (idx < 2) {
          return { value: idx++ ? modifiers || EMPTY_OBJ : res, done: false }
        }
        return { done: true }
      },
    }
  }

  return res
}

export const getModelModifiers = (props, modelName, getter) => {
  return (
    getter(props, getModifierPropName(modelName)) ||
    getter(props, `${camelize(modelName)}Modifiers`) ||
    getter(props, `${hyphenate(modelName)}Modifiers`)
  )
}
