import { isOn } from '@vue/shared'

export const isFunctionalFallthroughKey = key =>
  key === 'class' || key === 'style' || isOn(key)

export function getFunctionalFallthrough(attrs) {
  let res
  for (const key in attrs) {
    if (isFunctionalFallthroughKey(key)) {
      if (!res) res = {}
      res[key] = attrs[key]
    }
  }
  return res
}
