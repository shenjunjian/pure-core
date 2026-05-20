import { isOn } from '@vue/shared'

export function getFunctionalFallthrough(attrs) {
  let res
  for (const key in attrs) {
    if (key === 'class' || key === 'style' || isOn(key)) {
      if (!res) res = {}
      res[key] = attrs[key]
    }
  }
  return res
}
