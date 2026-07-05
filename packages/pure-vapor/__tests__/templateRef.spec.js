/**
 * @vitest-environment jsdom
 */
import {
  createDynamicComponent,
  createTemplateRefSetter,
  defineVaporComponent,
  nextTick,
  ref,
  renderEffect,
  setStaticTemplateRef,
  setTemplateRefBinding,
  template,
} from '../src/index.js'
import { makeRender } from './_utils.js'

const define = makeRender()

describe('api: template ref', () => {
  test('string ref mount', () => {
    const t0 = template('<div ref="refKey"></div>')
    const el = ref(null)
    const { render } = define({
      setup() {
        return { refKey: el }
      },
      render() {
        const n0 = t0()
        createTemplateRefSetter()(n0, 'refKey')
        return n0
      },
    })

    const { host } = render()
    expect(el.value).toBe(host.children[0])
  })

  test('static string ref helper mount', () => {
    const t0 = template('<div ref="refKey"></div>')
    const el = ref(null)
    const { render } = define({
      setup() {
        return { refKey: el }
      },
      render() {
        const n0 = t0()
        setStaticTemplateRef(n0, 'refKey')
        return n0
      },
    })

    const { host } = render()
    expect(el.value).toBe(host.children[0])
  })

  test('string ref update', async () => {
    const t0 = template('<div></div>')
    const fooEl = ref(null)
    const barEl = ref(null)
    const refKey = ref('foo')

    const { render } = define({
      setup() {
        return { foo: fooEl, bar: barEl }
      },
      render() {
        const n0 = t0()
        const setRef = createTemplateRefSetter()
        renderEffect(() => {
          setRef(n0, refKey.value)
        })
        return n0
      },
    })
    const { host } = render()
    expect(fooEl.value).toBe(host.children[0])
    expect(barEl.value).toBe(null)

    refKey.value = 'bar'
    await nextTick()
    expect(barEl.value).toBe(host.children[0])
    expect(fooEl.value).toBe(null)
  })

  test('string ref binding update', async () => {
    const t0 = template('<div></div>')
    const fooEl = ref(null)
    const barEl = ref(null)
    const refKey = ref('foo')

    const { render } = define({
      setup() {
        return { foo: fooEl, bar: barEl }
      },
      render() {
        const n0 = t0()
        setTemplateRefBinding(n0, () => refKey.value)
        return n0
      },
    })
    const { host } = render()
    expect(fooEl.value).toBe(host.children[0])
    expect(barEl.value).toBe(null)

    refKey.value = 'bar'
    await nextTick()
    expect(barEl.value).toBe(host.children[0])
    expect(fooEl.value).toBe(null)
  })

  test('dynamic component ref binding keeps a stable update hook', async () => {
    const Child = defineVaporComponent({
      setup() {
        return template('<div>child</div>')()
      },
    })
    const fooEl = ref(null)
    const barEl = ref(null)
    const refKey = ref('foo')
    let frag

    const { render } = define({
      setup() {
        return { foo: fooEl, bar: barEl }
      },
      render() {
        const n0 = createDynamicComponent(() => Child)
        frag = n0
        setTemplateRefBinding(n0, () => refKey.value)
        return n0
      },
    })
    render()

    const updateHook = frag.onUpdated[0]
    expect(frag.onUpdated).toHaveLength(1)

    refKey.value = 'bar'
    await nextTick()

    expect(frag.onUpdated).toHaveLength(1)
    expect(frag.onUpdated[0]).toBe(updateHook)
    expect(fooEl.value).toBe(null)
    expect(barEl.value).not.toBe(null)
  })
})
