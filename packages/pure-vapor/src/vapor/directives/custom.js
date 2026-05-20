import { onScopeDispose } from '@vue/reactivity'
import { warn } from '../../internal/warning.js'
import { getRootElement, isVaporComponent } from '../component.js'

export function withVaporDirectives(node, dirs) {
  const element = isVaporComponent(node) ? getRootElement(node.block) : node
  if (!element) {
    if (__DEV__) {
      warn(
        `Runtime directive used on component with non-element root node. ` +
          `The directives will not function as intended.`,
      )
    }
    return
  }

  for (let i = 0; i < dirs.length; i++) {
    const dir = dirs[i]
    const handler = dir[0]
    const value = dir[1]
    const argument = dir[2]
    const modifiers = dir[3]
    if (handler) {
      const ret = handler(element, value, argument, modifiers)
      if (ret) onScopeDispose(ret)
    }
  }
}
