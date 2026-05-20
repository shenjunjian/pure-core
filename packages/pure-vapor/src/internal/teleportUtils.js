import { isString } from '@vue/shared'
import { warn } from './warning.js'

export function isTeleportDisabled(props) {
  return props && (props.disabled || props.disabled === '')
}

export function isTeleportDeferred(props) {
  return props && (props.defer || props.defer === '')
}

export function resolveTeleportTarget(props, select) {
  const targetSelector = props && props.to
  if (isString(targetSelector)) {
    if (!select) {
      if (__DEV__) {
        warn(
          `Current renderer does not support string target for Teleports. ` +
            `(missing querySelector renderer option)`,
        )
      }
      return null
    } else {
      const target = select(targetSelector)
      if (__DEV__ && !target && !isTeleportDisabled(props)) {
        warn(
          `Failed to locate Teleport target with selector "${targetSelector}". ` +
            `Note the target element must exist before the component is mounted - ` +
            `i.e. the target cannot be rendered by the component itself, and ` +
            `ideally should be outside of the entire Vue component tree.`,
        )
      }
      return target
    }
  } else {
    if (__DEV__ && !targetSelector && !isTeleportDisabled(props)) {
      warn(`Invalid Teleport target: ${targetSelector}`)
    }
    return targetSelector
  }
}
