import { NO, isBuiltInDirective, isBuiltInTag, isString } from '@vue/shared'
import { warn } from './warning.js'

export function createAppContext() {
  return {
    app: null,
    config: {
      isNativeTag: NO,
      performance: false,
      globalProperties: {},
      errorHandler: undefined,
      warnHandler: undefined,
      compilerOptions: {},
    },
    components: {},
    directives: {},
    provides: Object.create(null),
  }
}

export function validateComponentName(name, { isNativeTag }) {
  if (isBuiltInTag(name) || isNativeTag(name)) {
    warn(
      'Do not use built-in or reserved HTML elements as component id: ' + name,
    )
  }
}

export function validateDirectiveName(name) {
  if (isBuiltInDirective(name)) {
    warn('Do not use built-in directive ids as custom directive id: ' + name)
  }
}

export let currentApp = null

/** 在没有组件实例时（不在 setup 里），临时把「当前 app」切到某个 app，让 inject() 能读到该 app 在 app.provide() 里注册的值。

apiInject.js 里逻辑是：

  if (instance || currentApp) {
    let provides = currentApp
      ? currentApp._context.provides
 */
export function runWithAppContext(app, fn) {
  const lastApp = currentApp
  currentApp = app
  try {
    return fn()
  } finally {
    currentApp = lastApp
  }
}

export function normalizeContainer(container) {
  if (isString(container)) {
    const res = document.querySelector(container)
    if (!res) {
      __DEV__ &&
        warn(
          `Failed to mount app: mount target selector "${container}" returned null.`,
        )
    }
    return res
  }
  if (__DEV__ && window.ShadowRoot && container instanceof window.ShadowRoot) {
    warn(
      `mounting on a ShadowRoot with \`{mode: "closed"}\` may lead to unpredictable bugs`,
    )
  }
  return container
}
