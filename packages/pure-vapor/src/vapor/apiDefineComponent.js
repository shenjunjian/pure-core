import { extend, isFunction } from '@vue/shared'

export function defineVaporComponent(comp, extraOptions) {
  if (isFunction(comp)) {
    return (() =>
      extend({ name: comp.name }, extraOptions, {
        setup: comp,
        __vapor: true,
      }))()
  }
  comp.__vapor = true
  return comp
}
