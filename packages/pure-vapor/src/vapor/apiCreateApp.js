import { getGlobalThis } from '@vue/shared'
import {
  createComponent,
  getExposed,
  mountComponent,
  unmountComponent,
} from './component.js'
import { createAppAPI, normalizeContainer } from '../internal/app.js'
import { flushOnAppMount } from '../internal/scheduler.js'
import { initFeatureFlags } from '../internal/featureFlags.js'
import { warn } from '../internal/warning.js'
import { optimizePropertyLookup } from './dom/prop.js'
import { runWithDomOps } from './dom/domOps.js'

let _createApp

const mountApp = (app, container) => {
  optimizePropertyLookup()

  if (container.nodeType === 1) {
    if (__DEV__ && container.childNodes.length) {
      warn('mount target container is not empty and will be cleared.')
    }
    container.textContent = ''
  }

  const instance =
    app._ceComponent ||
    createComponent(
      app._component,
      app._props,
      null,
      false,
      false,
      app._context,
    )
  mountComponent(instance, container)
  flushOnAppMount()

  return instance
}

const unmountApp = app => {
  unmountComponent(app._instance, app._container)
}

function prepareApp() {
  if (__ESM_BUNDLER__ && !__TEST__) {
    initFeatureFlags()
  }

  const target = getGlobalThis()
  target.__VUE__ = true
}

function postPrepareApp(app) {
  app.vapor = true
  const mount = app.mount
  app.mount = (container, ...args) => {
    container = normalizeContainer(container)
    let proxy
    runWithDomOps(() => {
      proxy = mount(container, ...args)
    })
    if (container instanceof Element) {
      container.removeAttribute('v-cloak')
      container.setAttribute('data-v-app', '')
    }
    return proxy
  }
}

export function createVaporApp(comp, props) {
  prepareApp()
  if (!_createApp) {
    _createApp = createAppAPI(mountApp, unmountApp, getExposed)
  }
  const app = _createApp(comp, props)
  postPrepareApp(app)
  return app
}
