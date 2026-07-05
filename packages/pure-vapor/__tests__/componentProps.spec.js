/**
 * @vitest-environment jsdom
 */
import { ref } from '@vue/reactivity'
import {
  createComponent,
  defineVaporComponent,
  inject,
  nextTick,
  provide,
  renderEffect,
  template,
  toRefs,
  watch,
} from '../src/index.js'
import { resolveDynamicProps } from '../src/vapor/componentProps.js'
import { setElementText } from '../src/vapor/dom/prop.js'
import { makeRender } from './_utils.js'

const define = makeRender()

describe('component: props', () => {
  test('stateful', () => {
    let props
    let attrs

    const { render } = define({
      props: ['fooBar', 'barBaz'],
      setup(_props, { attrs: _attrs }) {
        props = _props
        attrs = _attrs
        return []
      },
    })

    render({ fooBar: () => 1, bar: () => 2 })
    expect(props).toEqual({ fooBar: 1 })
    expect(attrs).toEqual({ bar: 2 })

    render({ 'foo-bar': () => 2, bar: () => 3, baz: () => 4 })
    expect(props).toEqual({ fooBar: 2 })
    expect(attrs).toEqual({ bar: 3, baz: 4 })

    render({ 'foo-bar': () => 3, bar: () => 3, baz: () => 4, barBaz: () => 5 })
    expect(props).toEqual({ fooBar: 3, barBaz: 5 })
    expect(attrs).toEqual({ bar: 3, baz: 4 })

    render({ qux: () => 5 })
    expect(props).toEqual({})
    expect(attrs).toEqual({ qux: 5 })
  })

  test('stateful with setup', () => {
    let props
    let attrs

    const { render } = define({
      props: ['foo'],
      setup(_props, { attrs: _attrs }) {
        props = _props
        attrs = _attrs
        return []
      },
    })

    render({ foo: () => 1, bar: () => 2 })
    expect(props).toEqual({ foo: 1 })
    expect(attrs).toEqual({ bar: 2 })

    render({ foo: () => 2, bar: () => 3, baz: () => 4 })
    expect(props).toEqual({ foo: 2 })
    expect(attrs).toEqual({ bar: 3, baz: 4 })

    render({ qux: () => 5 })
    expect(props).toEqual({})
    expect(attrs).toEqual({ qux: 5 })
  })

  test('functional with declaration', () => {
    let props
    let attrs

    const { component: Comp, render } = define((_props, { attrs: _attrs }) => {
      props = _props
      attrs = _attrs
      return []
    })
    Comp.props = ['foo']

    render({ foo: () => 1, bar: () => 2 })
    expect(props).toEqual({ foo: 1 })
    expect(attrs).toEqual({ bar: 2 })

    render({ foo: () => 2, bar: () => 3, baz: () => 4 })
    expect(props).toEqual({ foo: 2 })
    expect(attrs).toEqual({ bar: 3, baz: 4 })

    render({ qux: () => 5 })
    expect(props).toEqual({})
    expect(attrs).toEqual({ qux: 5 })
  })

  test('functional without declaration', () => {
    let props
    let attrs

    const { render } = define((_props, { attrs: _attrs }) => {
      props = _props
      attrs = _attrs
      return []
    })

    render({ foo: () => 1 })
    expect(props).toEqual({ foo: 1 })
    expect(attrs).toEqual({ foo: 1 })
    expect(props).toBe(attrs)

    render({ bar: () => 2 })
    expect(props).toEqual({ bar: 2 })
    expect(attrs).toEqual({ bar: 2 })
    expect(props).toBe(attrs)
  })

  test('functional defineVaporComponent without declaration', () => {
    let props
    let attrs

    const { render } = define(
      defineVaporComponent((_props, { attrs: _attrs }) => {
        props = _props
        attrs = _attrs
        return []
      }),
    )

    render({ foo: () => 1 })
    expect(props).toEqual({})
    expect(attrs).toEqual({ foo: 1 })

    render({ bar: () => 2 })
    expect(props).toEqual({})
    expect(attrs).toEqual({ bar: 2 })
  })

  test('boolean casting', () => {
    let props
    const { render } = define({
      props: {
        foo: Boolean,
        bar: Boolean,
        baz: Boolean,
        qux: Boolean,
      },
      setup(_props) {
        props = _props
        return []
      },
    })

    render({
      bar: () => '',
      baz: () => 'baz',
      qux: () => 'ok',
    })

    expect(props.foo).toBe(false)
    expect(props.bar).toBe(true)
    expect(props.baz).toBe(true)
    expect(props.qux).toBe('ok')
    expect('type check failed for prop "qux"').toHaveBeenWarned()
  })

  test('default value', () => {
    let props
    const defaultFn = vi.fn(() => ({ a: 1 }))
    const defaultBaz = vi.fn(() => ({ b: 1 }))

    const { render } = define({
      props: {
        foo: {
          default: 1,
        },
        bar: {
          default: defaultFn,
        },
        baz: {
          type: Function,
          default: defaultBaz,
        },
      },
      setup(_props) {
        props = _props
        return []
      },
    })

    render({ foo: () => 2 })
    expect(props.foo).toBe(2)
    expect(props.bar).toEqual({ a: 1 })
    expect(props.baz).toEqual(defaultBaz)
    expect(defaultFn).toHaveBeenCalledTimes(1)
    expect(defaultBaz).toHaveBeenCalledTimes(0)

    render({ foo: () => 3 })

    expect(props.foo).toBe(3)
    expect(props.bar).toEqual({ a: 1 })

    render({ bar: () => ({ b: 2 }) })
    expect(props.foo).toBe(1)
    expect(props.bar).toEqual({ b: 2 })

    render({
      foo: () => 3,
      bar: () => ({ b: 3 }),
    })
    expect(props.foo).toBe(3)
    expect(props.bar).toEqual({ b: 3 })

    render({ bar: () => ({ b: 4 }) })
    expect(props.foo).toBe(1)
    expect(props.bar).toEqual({ b: 4 })
  })

  test('using inject in default value factory', () => {
    let props

    const Child = defineVaporComponent({
      props: {
        test: {
          default: () => inject('test', 'default'),
        },
      },
      setup(_props) {
        props = _props
        return []
      },
    })

    const { render } = define({
      setup() {
        provide('test', 'injected')
        return createComponent(Child)
      },
    })

    render()

    expect(props.test).toBe('injected')
  })

  test('optimized props updates', async () => {
    const t0 = template('<div>')
    const { component: Child } = define({
      props: ['foo'],
      setup(props) {
        const n0 = t0()
        renderEffect(() => setElementText(n0, props.foo))
        return n0
      },
    })

    const foo = ref(1)
    const id = ref('a')
    const { host } = define({
      setup() {
        return { foo, id }
      },
      render(_ctx) {
        return createComponent(
          Child,
          {
            foo: () => _ctx.foo,
            id: () => _ctx.id,
          },
          null,
          true,
        )
      },
    }).render()
    expect(host.innerHTML).toBe('<div id="a">1</div>')

    foo.value++
    await nextTick()
    expect(host.innerHTML).toBe('<div id="a">2</div>')

    id.value = 'b'
    await nextTick()
    expect(host.innerHTML).toBe('<div id="b">2</div>')
  })

  describe('validator', () => {
    test('validator should be called with two arguments', () => {
      const mockFn = vi.fn((...args) => true)
      const props = {
        foo: () => 1,
        bar: () => 2,
      }

      const t0 = template('<div/>')
      define({
        props: {
          foo: {
            type: Number,
            validator: (value, props) => mockFn(value, props),
          },
          bar: {
            type: Number,
          },
        },
        setup() {
          return t0()
        },
      }).render(props)

      expect(mockFn).toHaveBeenCalledWith(1, { foo: 1, bar: 2 })
    })

    test('validator should not be able to mutate other props', async () => {
      const mockFn = vi.fn((...args) => true)
      define({
        props: {
          foo: {
            type: Number,
            validator: (value, props) => !!(props.bar = 1),
          },
          bar: {
            type: Number,
            validator: value => mockFn(value),
          },
        },
        setup() {
          const t0 = template('<div/>')
          const n0 = t0()
          return n0
        },
      }).render({
        foo() {
          return 1
        },
        bar() {
          return 2
        },
      })

      expect(
        `Set operation on key "bar" failed: target is readonly.`,
      ).toHaveBeenWarnedLast()
      expect(mockFn).toHaveBeenCalledWith(2)
    })
  })

  test('warn props mutation', () => {
    let props
    const { render } = define({
      props: ['foo'],
      setup(_props) {
        props = _props
        return []
      },
    })
    render({ foo: () => 1 })
    expect(props.foo).toBe(1)

    props.foo = 2
    expect(`Attempt to mutate prop "foo" failed`).toHaveBeenWarned()
  })

  test('warn absent required props', () => {
    define({
      props: {
        bool: { type: Boolean, required: true },
        str: { type: String, required: true },
        num: { type: Number, required: true },
      },
      setup() {
        return []
      },
    }).render()
    expect(`Missing required prop: "bool"`).toHaveBeenWarned()
    expect(`Missing required prop: "str"`).toHaveBeenWarned()
    expect(`Missing required prop: "num"`).toHaveBeenWarned()
  })

  test('should not warn required props using kebab-case', async () => {
    define({
      props: {
        fooBar: { type: String, required: true },
      },
      setup() {
        return []
      },
    }).render({
      ['foo-bar']: () => 'hello',
    })
    expect(`Missing required prop: "fooBar"`).not.toHaveBeenWarned()
  })

  test('props type support BigInt', () => {
    const t0 = template('<div>')
    const { host } = define({
      props: {
        foo: BigInt,
      },
      setup(props) {
        const n0 = t0()
        renderEffect(() => setElementText(n0, props.foo))
        return n0
      },
    }).render({
      foo: () =>
        BigInt(BigInt(100000111)) + BigInt(2000000000) * BigInt(30000000),
    })
    expect(host.innerHTML).toBe('<div>60000000100000111</div>')
  })

  test('should cache the value returned from the default factory to avoid unnecessary watcher trigger', async () => {
    let count = 0

    const { render, html } = define({
      props: {
        foo: {
          type: Object,
          default: () => ({ val: 1 }),
        },
        bar: Number,
      },
      setup(props) {
        watch(
          () => props.foo,
          () => {
            count++
          },
        )
        const t0 = template('<h1></h1>')
        const n0 = t0()
        renderEffect(() => {
          setElementText(n0, String(props.foo.val) + String(props.bar))
        })
        return n0
      },
    })

    const foo = ref()
    const bar = ref(0)
    render({ foo: () => foo.value, bar: () => bar.value })
    expect(html()).toBe(`<h1>10</h1>`)
    expect(count).toBe(0)

    bar.value++
    await nextTick()
    expect(html()).toBe(`<h1>11</h1>`)
    expect(count).toBe(0)
  })

  test('declared prop key should be present even if not passed', async () => {
    let initialKeys = []
    const changeSpy = vi.fn()
    const passFoo = ref(false)

    const Comp = {
      props: {
        foo: String,
      },
      setup(props) {
        initialKeys = Object.keys(props)
        const { foo } = toRefs(props)
        watch(foo, changeSpy)
        return []
      },
    }

    define(() =>
      createComponent(Comp, {
        $: [() => (passFoo.value ? { foo: 'ok' } : {})],
      }),
    ).render()

    expect(initialKeys).toMatchObject(['foo'])
    passFoo.value = true
    await nextTick()
    expect(changeSpy).toHaveBeenCalledTimes(1)
  })

  test('should not warn invalid watch source when directly watching props', async () => {
    const changeSpy = vi.fn()
    const { render, html } = define({
      props: {
        foo: {
          type: String,
        },
      },
      setup(props) {
        watch(props, changeSpy)
        const t0 = template('<h1></h1>')
        const n0 = t0()
        renderEffect(() => {
          setElementText(n0, String(props.foo))
        })
        return n0
      },
    })

    const foo = ref('foo')
    render({ foo: () => foo.value })
    expect(html()).toBe(`<h1>foo</h1>`)
    expect('Invalid watch source').not.toHaveBeenWarned()

    foo.value = 'bar'
    await nextTick()
    expect(html()).toBe(`<h1>bar</h1>`)
    expect(changeSpy).toHaveBeenCalledTimes(1)
  })

  test('support null in required + multiple-type declarations', () => {
    const { render } = define({
      props: {
        foo: { type: [Function, null], required: true },
      },
      setup() {
        return []
      },
    })

    expect(() => {
      render({ foo: () => () => {} })
    }).not.toThrow()

    expect(() => {
      render({ foo: () => null })
    }).not.toThrow()
  })

  test('handling attr with undefined value', () => {
    const { render, host } = define({
      inheritAttrs: false,
      setup(_, { attrs }) {
        const t0 = template('<div></div>')
        const n0 = t0()
        renderEffect(() =>
          setElementText(n0, JSON.stringify(attrs) + Object.keys(attrs)),
        )
        return n0
      },
    })

    const attrs = { foo: () => undefined }
    render(attrs)

    expect(host.innerHTML).toBe(
      `<div>${JSON.stringify(attrs) + Object.keys(attrs)}</div>`,
    )
  })

  test('should not mutate original props long-form definition object', () => {
    const props = {
      msg: {
        type: String,
      },
    }
    define({ props, setup: () => [] }).render({ msg: () => 'test' })

    expect(Object.keys(props.msg).length).toBe(1)
  })

  test('should warn against reserved prop names', () => {
    const { render } = define({
      props: {
        $foo: String,
      },
      setup: () => [],
    })

    render({ msg: () => 'test' })
    expect(`Invalid prop name: "$foo"`).toHaveBeenWarned()
  })

  test('v-once preserves function-valued props', () => {
    const cb = vi.fn(() => 'called')
    const resolved = []
    const Child = defineVaporComponent({
      props: ['cb'],
      setup(props) {
        resolved.push(props.cb)
        return []
      },
    })

    define({
      setup() {
        return [
          createComponent(Child, { cb: () => cb }, null, true, true),
          createComponent(Child, { $: [{ cb: () => cb }] }, null, true, true),
        ]
      },
    }).render()

    expect(resolved[0]).toBe(cb)
    expect(resolved[1]).toBe(cb)
    expect(cb).not.toHaveBeenCalled()
  })

  describe('dynamic props source caching', () => {
    test('v-bind object should be cached when child accesses multiple props', () => {
      let sourceCallCount = 0
      const obj = ref({ foo: 1, bar: 2, baz: 3 })

      const t0 = template('<div></div>')
      const Child = defineVaporComponent({
        props: ['foo', 'bar', 'baz'],
        setup(props) {
          const n0 = t0()
          renderEffect(() => {
            setElementText(n0, `${props.foo}-${props.bar}-${props.baz}`)
          })
          return n0
        },
      })

      const { host } = define({
        setup() {
          return createComponent(Child, {
            $: [
              () => {
                sourceCallCount++
                return obj.value
              },
            ],
          })
        },
      }).render()

      expect(host.innerHTML).toBe('<div>1-2-3</div>')
      expect(sourceCallCount).toBe(1)
    })

    test('v-bind object should update when source changes', async () => {
      let sourceCallCount = 0
      const obj = ref({ foo: 1, bar: 2 })

      const t0 = template('<div></div>')
      const Child = defineVaporComponent({
        props: ['foo', 'bar'],
        setup(props) {
          const n0 = t0()
          renderEffect(() => {
            setElementText(n0, `${props.foo}-${props.bar}`)
          })
          return n0
        },
      })

      const { host } = define({
        setup() {
          return createComponent(Child, {
            $: [
              () => {
                sourceCallCount++
                return obj.value
              },
            ],
          })
        },
      }).render()

      expect(host.innerHTML).toBe('<div>1-2</div>')
      expect(sourceCallCount).toBe(1)

      obj.value = { foo: 10, bar: 20 }
      await nextTick()

      expect(host.innerHTML).toBe('<div>10-20</div>')
      expect(sourceCallCount).toBe(2)
    })

    test('v-bind object should not update child when resolved values are unchanged', async () => {
      let childRenderCount = 0
      const activeId = ref(0)

      const t0 = template('<div></div>', 1)
      const Child = defineVaporComponent({
        props: ['active', 'tone'],
        setup(props) {
          const n0 = t0()
          renderEffect(() => {
            childRenderCount++
            setElementText(n0, `${props.active}-${props.tone}`)
          })
          return n0
        },
      })

      const { host } = define({
        setup() {
          return createComponent(Child, {
            $: [
              () => {
                const active = activeId.value === 1
                return {
                  active,
                  tone: 'stable',
                  class: active ? 'active' : 'inactive',
                }
              },
            ],
          })
        },
      }).render()

      expect(host.innerHTML).toBe('<div class="inactive">false-stable</div>')
      expect(childRenderCount).toBe(1)

      activeId.value = 2
      await nextTick()

      expect(host.innerHTML).toBe('<div class="inactive">false-stable</div>')
      expect(childRenderCount).toBe(1)
    })

    test('v-bind object should be cached when child accesses multiple attrs', () => {
      let sourceCallCount = 0
      const obj = ref({ foo: 1, bar: 2, baz: 3 })

      const t0 = template('<div></div>')
      const Child = defineVaporComponent({
        setup(_, { attrs }) {
          const n0 = t0()
          renderEffect(() => {
            setElementText(n0, `${attrs.foo}-${attrs.bar}-${attrs.baz}`)
          })
          return n0
        },
      })

      const { host } = define({
        setup() {
          return createComponent(Child, {
            $: [
              () => {
                sourceCallCount++
                return obj.value
              },
            ],
          })
        },
      }).render()

      expect(host.innerHTML).toBe('<div foo="1" bar="2" baz="3">1-2-3</div>')
      expect(sourceCallCount).toBe(1)
    })

    test('mixed static and dynamic props', async () => {
      let sourceCallCount = 0
      const obj = ref({ foo: 1 })

      const t0 = template('<div></div>')
      const Child = defineVaporComponent({
        props: ['id', 'foo', 'class'],
        setup(props) {
          const n0 = t0()
          renderEffect(() => {
            setElementText(n0, `${props.id}-${props.foo}-${props.class}`)
          })
          return n0
        },
      })

      const { host } = define({
        setup() {
          return createComponent(Child, {
            id: 'static',
            $: [
              () => {
                sourceCallCount++
                return obj.value
              },
              { class: 'bar' },
            ],
          })
        },
      }).render()

      expect(host.innerHTML).toBe('<div>static-1-bar</div>')
      expect(sourceCallCount).toBe(1)

      obj.value = { foo: 2 }
      await nextTick()

      expect(host.innerHTML).toBe('<div>static-2-bar</div>')
      expect(sourceCallCount).toBe(2)
    })

    test('static object source direct values are exposed as attrs', () => {
      const t0 = template('<div></div>')
      const Child = defineVaporComponent({
        setup(_, { attrs }) {
          const n0 = t0()
          renderEffect(() => {
            setElementText(n0, `${attrs.id}-${attrs.class}`)
          })
          return n0
        },
      })

      const { host } = define({
        setup() {
          return createComponent(Child, {
            $: [{ id: 'foo', class: 'bar' }],
          })
        },
      }).render()

      expect(host.innerHTML).toBe('<div id="foo" class="bar">foo-bar</div>')
    })

    test('resolveDynamicProps supports direct values in static object sources', () => {
      expect(
        resolveDynamicProps({
          id: 'foo',
          class: 'base',
          $: [() => ({ class: 'dynamic' }), { class: 'bar', title: 'baz' }],
        }),
      ).toEqual({
        id: 'foo',
        class: ['base', 'dynamic', 'bar'],
        title: 'baz',
      })
    })
  })
})
