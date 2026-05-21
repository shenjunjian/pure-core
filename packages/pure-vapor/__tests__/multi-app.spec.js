/**
 * @vitest-environment jsdom
 */
import { BindingTypes } from '@vue/compiler-dom'
import { ref } from '@vue/reactivity'
import { createVaporApp, inject, nextTick } from '../src/index.js'
import { compileToPureVaporRender, flushAllApps } from './_utils.js'

function makeMsgApp(msg) {
  const render = compileToPureVaporRender(`<div>{{ msg }}</div>`, {
    bindingMetadata: {
      msg: BindingTypes.SETUP_REF,
    },
  })
  return {
    __vapor: true,
    setup() {
      return { msg }
    },
    render,
  }
}

describe('multi-app isolation', () => {
  let root1
  let root2
  let app1
  let app2
  let msg1
  let msg2

  beforeEach(() => {
    root1 = document.createElement('div')
    root2 = document.createElement('div')
    root1.id = 'app1'
    root2.id = 'app2'
    document.body.appendChild(root1)
    document.body.appendChild(root2)

    msg1 = ref('app1')
    msg2 = ref('app2')
    app1 = createVaporApp(makeMsgApp(msg1))
    app2 = createVaporApp(makeMsgApp(msg2))
    app1.mount(root1)
    app2.mount(root2)
  })

  afterEach(async () => {
    app1.unmount()
    app2.unmount()
    root1.remove()
    root2.remove()
    await flushAllApps()
  })

  test('independent refs update separate containers on document.body', async () => {
    await flushAllApps()
    expect(root1.textContent).toBe('app1')
    expect(root2.textContent).toBe('app2')

    msg1.value = 'updated1'
    await flushAllApps()
    expect(root1.textContent).toBe('updated1')
    expect(root2.textContent).toBe('app2')

    msg2.value = 'updated2'
    await flushAllApps()
    expect(root1.textContent).toBe('updated1')
    expect(root2.textContent).toBe('updated2')
  })

  test('alternate nextTick callbacks do not cross apps', async () => {
    await flushAllApps()
    const order = []

    msg1.value = 'tick1'
    const p1 = nextTick(() => {
      order.push('app1')
      expect(root1.textContent).toBe('tick1')
    })

    msg2.value = 'tick2'
    const p2 = nextTick(() => {
      order.push('app2')
      expect(root2.textContent).toBe('tick2')
    })

    await flushAllApps()
    await Promise.all([p1, p2])
    expect(order).toEqual(['app1', 'app2'])
  })

  test('runWithContext + inject reads current app provides only', () => {
    const KEY = Symbol('multi-app')
    app1.provide(KEY, 'from-app1')
    app2.provide(KEY, 'from-app2')

    app1.runWithContext(() => {
      expect(inject(KEY)).toBe('from-app1')
    })
    app2.runWithContext(() => {
      expect(inject(KEY)).toBe('from-app2')
    })

    app1.runWithContext(() => {
      app2.runWithContext(() => {
        expect(inject(KEY)).toBe('from-app2')
      })
      expect(inject(KEY)).toBe('from-app1')
    })
  })

  test('single flush cycle applies DOM updates to both apps', async () => {
    await flushAllApps()
    msg1.value = 'alpha'
    msg2.value = 'beta'
    await flushAllApps()
    expect(root1.textContent).toBe('alpha')
    expect(root2.textContent).toBe('beta')
  })
})
