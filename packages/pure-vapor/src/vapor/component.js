export function isVaporComponent(val) {
  return !!(val && val.type && val.uid != null)
}

export function mountComponent() {
  throw new Error(
    'mountComponent is not implemented yet (vapor-component todo)',
  )
}

export function unmountComponent() {}

export let isApplyingFallthroughProps = false
