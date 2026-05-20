import {
  NO,
  extend,
  hasOwn,
  isFunction,
  isObject,
  isString,
  isBuiltInDirective,
  isBuiltInTag,
} from '@vue/shared'
import { ErrorCodes, callWithAsyncErrorHandling } from './errorHandling.js'
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

let uid = 0

export function createAppAPI(mount, unmount, getPublicInstance) {
  return function createApp(rootComponent, rootProps = null) {
    if (!isFunction(rootComponent)) {
      rootComponent = extend({}, rootComponent)
    }

    if (rootProps != null && !isObject(rootProps)) {
      __DEV__ && warn(`root props passed to app.mount() must be an object.`)
      rootProps = null
    }

    const context = createAppContext()
    const installedPlugins = new WeakSet()
    const pluginCleanupFns = []

    let isMounted = false

    const app = (context.app = {
      vapor: true,
      _uid: uid++,
      _component: rootComponent,
      _props: rootProps,
      _container: null,
      _context: context,
      _instance: null,

      version: __VERSION__,

      get config() {
        return context.config
      },

      set config(v) {
        if (__DEV__) {
          warn(
            `app.config cannot be replaced. Modify individual options instead.`,
          )
        }
      },

      use(plugin, ...options) {
        if (installedPlugins.has(plugin)) {
          __DEV__ && warn(`Plugin has already been applied to target app.`)
        } else if (plugin && isFunction(plugin.install)) {
          installedPlugins.add(plugin)
          plugin.install(app, ...options)
        } else if (isFunction(plugin)) {
          installedPlugins.add(plugin)
          plugin(app, ...options)
        } else if (__DEV__) {
          warn(
            `A plugin must either be a function or an object with an "install" ` +
              `function.`,
          )
        }
        return app
      },

      component(name, component) {
        if (__DEV__) {
          validateComponentName(name, context.config)
        }
        if (!component) {
          return context.components[name]
        }
        if (__DEV__ && context.components[name]) {
          warn(`Component "${name}" has already been registered in target app.`)
        }
        context.components[name] = component
        return app
      },

      directive(name, directive) {
        if (__DEV__) {
          validateDirectiveName(name)
        }

        if (!directive) {
          return context.directives[name]
        }
        if (__DEV__ && context.directives[name]) {
          warn(`Directive "${name}" has already been registered in target app.`)
        }
        context.directives[name] = directive
        return app
      },

      mount(rootContainer, isHydrate, namespace) {
        if (!isMounted) {
          if (__DEV__ && rootContainer.__vue_app__) {
            warn(
              `There is already an app instance mounted on the host container.\n` +
                ` If you want to mount another app on the same host container,` +
                ` you need to unmount the previous app by calling \`app.unmount()\` first.`,
            )
          }
          const instance = mount(app, rootContainer, isHydrate, namespace)

          isMounted = true
          app._container = rootContainer
          rootContainer.__vue_app__ = app

          return getPublicInstance(instance)
        } else if (__DEV__) {
          warn(
            `App has already been mounted.\n` +
              `If you want to remount the same app, move your app creation logic ` +
              `into a factory function and create fresh app instances for each ` +
              `mount - e.g. \`const createMyApp = () => createApp(App)\``,
          )
        }
      },

      onUnmount(cleanupFn) {
        if (__DEV__ && typeof cleanupFn !== 'function') {
          warn(
            `Expected function as first argument to app.onUnmount(), ` +
              `but got ${typeof cleanupFn}`,
          )
        }
        pluginCleanupFns.push(cleanupFn)
      },

      unmount() {
        if (isMounted) {
          callWithAsyncErrorHandling(
            pluginCleanupFns,
            app._instance,
            ErrorCodes.APP_UNMOUNT_CLEANUP,
          )
          unmount(app)
          if (app._container) {
            delete app._container.__vue_app__
          }
        } else if (__DEV__) {
          warn(`Cannot unmount an app that is not mounted.`)
        }
      },

      provide(key, value) {
        if (__DEV__ && key in context.provides) {
          if (hasOwn(context.provides, key)) {
            warn(
              `App already provides property with key "${String(key)}". ` +
                `It will be overwritten with the new value.`,
            )
          } else {
            warn(
              `App already provides property with key "${String(key)}" inherited from its parent element. ` +
                `It will be overwritten with the new value.`,
            )
          }
        }

        context.provides[key] = value

        return app
      },

      runWithContext(fn) {
        const lastApp = currentApp
        currentApp = app
        try {
          return fn()
        } finally {
          currentApp = lastApp
        }
      },
    })

    return app
  }
}

export let currentApp = null

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
