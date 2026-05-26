/**
 * @vitest-environment jsdom
 */
import { compile as compileVapor } from '@vue/compiler-vapor'
import * as pureVapor from '../src/index.js'
import { createVaporApp, nextTick } from '../src/index.js'

export { pureVapor }

export function flushAll() {
  return nextTick()
}

export function makeRender(
  initHost = () => {
    const host = document.createElement('div')
    host.setAttribute('id', 'host')
    document.body.appendChild(host)
    return host
  },
) {
  let host

  function resetHost() {
    return (host = initHost())
  }

  beforeEach(() => {
    resetHost()
  })

  afterEach(() => {
    host.remove()
  })

  function define(comp) {
    const component = comp
    component.__vapor = true
    let instance
    let app

    function render(props, container = host) {
      create(props)
      return mount(container)
    }

    function create(props) {
      if (app) {
        app.unmount()
      }
      app = createVaporApp(component, props)
      return res()
    }

    function mount(container = host) {
      app.mount(container)
      instance = app._instance
      return res()
    }

    function html() {
      return host.innerHTML
    }

    const res = () => ({
      component,
      host,
      get instance() {
        return instance
      },
      app,
      create,
      mount,
      render,
      resetHost,
      html,
    })

    return res()
  }

  return define
}

export function compileToPureVaporRender(template, options = {}) {
  const { code } = compileVapor(template, {
    mode: 'module',
    prefixIdentifiers: true,
    runtimeModuleName: 'pure-vapor',
    hmr: false,
    ...options,
  })

  const transformed = code
    .replace(/\bimport {/g, 'const {')
    .replace(/ as _/g, ': _')
    .replace(/} from ['"]pure-vapor['"];/g, '} = Vue;')
    .replace(/export function render/, 'function render')

  return new Function('Vue', `${transformed}\nreturn render`)(pureVapor)
}
