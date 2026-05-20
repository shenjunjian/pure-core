import { EMPTY_OBJ } from '@vue/shared'
import { useInstanceOption } from './instance.js'
import { warn } from './warning.js'

export function useCssModule(name = '$style') {
  const { hasInstance, value: type } = useInstanceOption('type', true)
  if (!hasInstance) {
    if (__DEV__) {
      warn(`useCssModule must be called inside setup()`)
    }
    return EMPTY_OBJ
  }
  const modules = type.__cssModules
  if (!modules) {
    if (__DEV__) {
      warn(`Current instance does not have CSS modules injected.`)
    }
    return EMPTY_OBJ
  }
  const mod = modules[name]
  if (!mod) {
    if (__DEV__) {
      warn(`Current instance does not have CSS module named "${name}".`)
    }
    return EMPTY_OBJ
  }
  return mod
}
