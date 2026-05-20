import { getCurrentGenericInstance } from './instance.js'
import { warn } from './warning.js'

const warnRuntimeUsage = method =>
  warn(
    `${method}() is a compiler-hint helper that is only usable inside ` +
      `<script setup> of a single file component. Its arguments should be ` +
      `compiled away and passing it at runtime has no effect.`,
  )

export function defineProps() {
  if (__DEV__) {
    warnRuntimeUsage(`defineProps`)
  }
  return null
}

export function defineEmits() {
  if (__DEV__) {
    warnRuntimeUsage(`defineEmits`)
  }
  return null
}

export function defineExpose() {
  if (__DEV__) {
    warnRuntimeUsage(`defineExpose`)
  }
}

export function defineOptions() {
  if (__DEV__) {
    warnRuntimeUsage(`defineOptions`)
  }
}

export function defineSlots() {
  if (__DEV__) {
    warnRuntimeUsage(`defineSlots`)
  }
  return null
}

export function defineModel() {
  if (__DEV__) {
    warnRuntimeUsage('defineModel')
  }
}

export function withDefaults(props) {
  if (__DEV__) {
    warnRuntimeUsage(`withDefaults`)
  }
  return props
}

export function useSlots() {
  return getContext('useSlots').slots
}

export function useAttrs() {
  return getContext('useAttrs').attrs
}

function getContext(calledFunctionName) {
  const i = getCurrentGenericInstance()
  if (__DEV__ && !i) {
    warn(`${calledFunctionName}() called without active instance.`)
  }
  if (i && i.vapor) {
    return i
  }
  return i.setupContext
}

export function toHandlers(obj) {
  const ret = {}
  for (const key in obj) {
    ret[key] = obj[key]
  }
  return ret
}
