import { getCurrentInstance } from './instance.js'
import { warn } from './warning.js'

export function useId() {
  const i = getCurrentInstance()
  if (i) {
    const prefix =
      i.appContext && i.appContext.config && i.appContext.config.idPrefix
    return (prefix || 'v') + '-' + i.ids[0] + i.ids[1]++
  } else if (__DEV__) {
    warn(
      `useId() is called when there is no active component ` +
        `instance to be associated with.`,
    )
  }
  return ''
}

export function markAsyncBoundary(instance) {
  instance.ids = [instance.ids[0] + instance.ids[2]++ + '-', 0, 0]
}
