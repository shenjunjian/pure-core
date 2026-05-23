import { EMPTY_OBJ, hasOwn, isArray, isFunction, isOn } from '@vue/shared'
import { baseEmit } from '../internal/emit.js'
import { resolveSource } from './componentProps.js'

/** 组件定义对象的 emits 属性
 *  1、精简写法：  
 *  emits: ['click', 'update:modelValue']  =>  {click: null, 'update:modelValue': null}  
 *  2、完整写法：  返回自身不变。  
 *  emits: {  
      submit: (payload) => payload && typeof payload.id === 'number',  
      change: null,  
    },     
 */
export function normalizeEmitsOptions(comp) {
  const cached = comp.__emitsOptions
  if (cached) return cached

  const raw = comp.emits
  if (!raw) return null

  let normalized
  if (isArray(raw)) {
    normalized = {}
    for (const key of raw) normalized[key] = null
  } else {
    normalized = raw
  }

  return (comp.__emitsOptions = normalized)
}

export function emit(instance, event, ...rawArgs) {
  baseEmit(
    instance,
    instance.rawProps || EMPTY_OBJ,
    propGetter,
    event,
    ...rawArgs,
  )
}

function propGetter(rawProps, key) {
  const dynamicSources = rawProps.$
  if (dynamicSources) {
    let i = dynamicSources.length
    while (i--) {
      const source = resolveSource(dynamicSources[i])
      if (hasOwn(source, key)) {
        return isOn(key) && isFunction(dynamicSources[i])
          ? source[key]
          : resolveSource(source[key])
      }
    }
  }
  return rawProps[key] && resolveSource(rawProps[key])
}
