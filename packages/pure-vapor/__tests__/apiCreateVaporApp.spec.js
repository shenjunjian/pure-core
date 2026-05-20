/**
 * @vitest-environment jsdom
 */
import {
  createComponent,
  createTextNode,
  createVaporApp,
  defineVaporComponent,
  inject,
  provide,
} from '../src/index.js'
import { flushAll, makeRender } from './_utils.js'

const define = makeRender()

describe('api: createVaporApp', () => {
  test('mount', async () => {
    const Comp = defineVaporComponent({
      props: {
        count: { default: 0 },
      },
      setup(props) {
        return createTextNode(String(props.count))
      },
    })

    const root1 = document.createElement('div')
    createVaporApp(Comp).mount(root1)
    await flushAll()
    expect(root1.innerHTML).toBe('0')

    createVaporApp(Comp).mount(root1)
    await flushAll()
    expect('mount target container is not empty').toHaveBeenWarned()
    expect(
      'There is already an app instance mounted on the host container',
    ).toHaveBeenWarned()

    const root2 = document.createElement('div')
    const app2 = createVaporApp(Comp, { count: () => 1 })
    app2.mount(root2)
    await flushAll()
    expect(root2.innerHTML).toBe('1')

    const root3 = document.createElement('div')
    app2.mount(root3)
    await flushAll()
    expect(root3.innerHTML).toBe('')
    expect('already been mounted').toHaveBeenWarned()
  })

  test('unmount', async () => {
    const Comp = defineVaporComponent({
      props: {
        count: { default: 0 },
      },
      setup(props) {
        return createTextNode(String(props.count))
      },
    })

    const root = document.createElement('div')
    const app = createVaporApp(Comp)

    app.unmount()
    expect('that is not mounted').toHaveBeenWarned()

    app.mount(root)
    await flushAll()

    app.unmount()
    await flushAll()
    expect(root.innerHTML).toBe('')
  })

  test('provide', async () => {
    const Child = defineVaporComponent({
      setup() {
        const foo = inject('foo')
        const bar = inject('bar')
        try {
          inject('__proto__')
        } catch (e) {}
        return createTextNode(`${foo},${bar}`)
      },
    })

    const Root = define({
      setup() {
        provide('foo', 3)
        return createComponent(Child)
      },
    })

    const { app, mount, create, html } = Root.create()
    app.provide('foo', 1)
    app.provide('bar', 2)
    await mount()
    expect(html()).toBe('3,2')
    expect('[Vue warn]: injection "__proto__" not found.').toHaveBeenWarned()

    const { app: app2 } = create()
    app2.provide('bar', 1)
    app2.provide('bar', 2)
    expect('App already provides property with key "bar".').toHaveBeenWarned()
  })
})
