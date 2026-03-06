import {
  type VaporComponent,
  type VaporComponentInstance,
  createComponent,
  getExposed,
  mountComponent,
  unmountComponent,
} from './component'
import {
  type App,
  type AppMountFn,
  type AppUnmountFn,
  type CreateAppFunction,
  createAppAPI,
  flushOnAppMount,
  initFeatureFlags,
  normalizeContainer,
  setDevtoolsHook,
  warn,
} from '@vue/pure-runtime-dom'
import type { RawProps } from './componentProps'
import { getGlobalThis } from '@vue/shared'
import { optimizePropertyLookup } from './dom/prop'
import { setIsHydratingEnabled, withHydration } from './dom/hydration'

let _createApp: CreateAppFunction<ParentNode, VaporComponent>

// #createVaporApp-10
const mountApp: AppMountFn<ParentNode> = (app, container) => {
  // #createVaporApp-11
  optimizePropertyLookup()

  // clear content before mounting
  if (container.nodeType === 1 /* Node.ELEMENT_NODE */) {
    if (__DEV__ && container.childNodes.length) {
      warn('mount target container is not empty and will be cleared.')
    }
    container.textContent = ''
  }

  const instance =
    (app._ceComponent as VaporComponentInstance) ||
    // #createVaporApp-12
    createComponent(
      app._component,
      app._props as RawProps,
      null,
      false,
      false,
      app._context,
    )
  // #createVaporApp-13
  mountComponent(instance, container)
  // #createVaporApp-14
  flushOnAppMount()

  return instance!
}

let _hydrateApp: CreateAppFunction<ParentNode, VaporComponent>

const hydrateApp: AppMountFn<ParentNode> = (app, container) => {
  optimizePropertyLookup()

  let instance: VaporComponentInstance
  withHydration(container, () => {
    instance =
      (app._ceComponent as VaporComponentInstance) ||
      createComponent(
        app._component,
        app._props as RawProps,
        null,
        false,
        false,
        app._context,
      )
    mountComponent(instance, container)
    flushOnAppMount()
  })

  return instance!
}

// #createVaporApp-15
const unmountApp: AppUnmountFn = app => {
  // #createVaporApp-16
  unmountComponent(app._instance as VaporComponentInstance, app._container)
}

// #createVaporApp-6
function prepareApp() {
  // compile-time feature flags check
  if (__ESM_BUNDLER__ && !__TEST__) {
    // #createVaporApp-7
    initFeatureFlags()
  }

  // #createVaporApp-8
  const target = getGlobalThis()
  target.__VUE__ = true
  if (__DEV__ || __FEATURE_PROD_DEVTOOLS__) {
    // #createVaporApp-9
    setDevtoolsHook(target.__VUE_DEVTOOLS_GLOBAL_HOOK__, target)
  }
}

// #createVaporApp-17
function postPrepareApp(app: App) {
  app.vapor = true
  const mount = app.mount
  app.mount = (container, ...args: any[]) => {
    // #createVaporApp-18
    container = normalizeContainer(container) as ParentNode
    const proxy = mount(container, ...args)
    if (container instanceof Element) {
      container.removeAttribute('v-cloak')
      container.setAttribute('data-v-app', '')
    }
    return proxy
  }
}

// #createVaporApp-1
export const createVaporApp: CreateAppFunction<ParentNode, VaporComponent> = (
  comp,
  props,
) => {
  // #createVaporApp-2
  prepareApp()
  // #createVaporApp-3
  if (!_createApp) _createApp = createAppAPI(mountApp, unmountApp, getExposed)
  // #createVaporApp-4
  const app = _createApp(comp, props)
  // #createVaporApp-5
  postPrepareApp(app)
  return app
}

export const createVaporSSRApp: CreateAppFunction<
  ParentNode,
  VaporComponent
> = (comp, props) => {
  setIsHydratingEnabled(true)
  prepareApp()
  if (!_hydrateApp)
    _hydrateApp = createAppAPI(hydrateApp, unmountApp, getExposed)
  const app = _hydrateApp(comp, props)
  postPrepareApp(app)
  return app
}
