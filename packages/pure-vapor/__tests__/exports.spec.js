import * as pureVapor from '../src/index.js'

/** Symbols vapor apps / compiler-vapor typically import from vue */
const REQUIRED_EXPORTS = [
  'ref',
  'reactive',
  'computed',
  'watch',
  'watchEffect',
  'nextTick',
  'createVaporApp',
  'defineVaporComponent',
  'renderEffect',
  'template',
  'createIf',
  'createFor',
  'insert',
  'setText',
  'setProp',
  'createComponent',
  'setStaticTemplateRef',
  'setTemplateRefBinding',
  'provide',
  'inject',
  'getCurrentInstance',
  'VaporTeleport',
  'VaporKeepAlive',
  'VaporTransition',
  'VaporTransitionGroup',
  'applyVShow',
  'withVaporDirectives',
  'useVaporCssVars',
  'createApp',
  'defineComponent',
  'vaporInteropPlugin',
]

/** Excluded per pure-vapor export contract (index-with-vapor minus table) */
const EXCLUDED_EXPORTS = [
  'compile',
  'h',
  'createVNode',
  'createApp', // VDOM — pure-vapor aliases createVaporApp instead; listed separately below
  'createSSRApp',
  'createVaporSSRApp',
  'Suspense',
  'hydrate',
  'Teleport',
  'KeepAlive',
  'Transition',
  'defineCustomElement',
  'devtools',
  'setDevtoolsHook',
]

describe('pure-vapor public exports', () => {
  test('required symbols are exported', () => {
    for (let i = 0; i < REQUIRED_EXPORTS.length; i++) {
      const name = REQUIRED_EXPORTS[i]
      expect(pureVapor[name], name).toBeDefined()
    }
  })

  test('VDOM / SSR / interop / Transition symbols are not exported', () => {
    const excluded = EXCLUDED_EXPORTS.filter(name => name !== 'createApp')
    for (let i = 0; i < excluded.length; i++) {
      const name = excluded[i]
      expect(pureVapor[name], name).toBeUndefined()
    }
  })

  test('createApp is a migration alias for createVaporApp', () => {
    expect(pureVapor.createApp).toBe(pureVapor.createVaporApp)
  })

  test('vaporInteropPlugin is a no-op stub that returns the app', () => {
    const app = {}
    expect(pureVapor.vaporInteropPlugin(app)).toBe(app)
  })

  test('version is exported', () => {
    expect(typeof pureVapor.version).toBe('string')
    expect(pureVapor.version.length).toBeGreaterThan(0)
  })

  test('reactivity and shared helpers are re-exported', () => {
    expect(pureVapor.effect).toBeTypeOf('function')
    expect(pureVapor.camelize('foo-bar')).toBe('fooBar')
    expect(pureVapor.toDisplayString(1)).toBe('1')
  })
})
