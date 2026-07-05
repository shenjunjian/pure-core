/**
 * @vitest-environment jsdom
 */
import { compile as compileVapor } from '@vue/compiler-vapor'
import { compileScript, parse } from '@vue/compiler-sfc'
import * as reactivity from '@vue/reactivity'
import { VaporIfFlags } from '@vue/shared'
import * as pureVapor from '../src/index.js'
import { createVaporApp, nextTick } from '../src/index.js'

export { pureVapor }

const Vue = { ...reactivity, ...pureVapor }

export function ifFlags(blockShape, once = false, index) {
  return (
    blockShape |
    (once ? VaporIfFlags.ONCE : 0) |
    (index === undefined ? 0 : (index + 1) << VaporIfFlags.INDEX_SHIFT)
  )
}

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

export function compile(
  sfc,
  data,
  components = {},
  { vapor = true, ssr = false } = {},
) {
  if (!sfc.includes(`<script`)) {
    sfc =
      `<script vapor>const data = _data; const components = _components;</script>` +
      sfc
  }
  const descriptor = parse(sfc).descriptor

  const script = compileScript(descriptor, {
    id: 'x',
    isProd: true,
    inlineTemplate: true,
    genDefaultAs: '__sfc__',
    vapor,
    templateOptions: { ssr },
  })

  const code =
    script.content
      .replace(/\bimport {/g, 'const {')
      .replace(/ as _/g, ': _')
      .replace(/} from ['"]vue['"]/g, `} = Vue`)
      .replace(/} from ['"]pure-vapor['"]/g, `} = Vue`) + '\nreturn __sfc__'

  return new Function('Vue', '_data', '_components', code)(
    Vue,
    data,
    components,
  )
}
