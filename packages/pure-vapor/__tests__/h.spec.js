/**
 * @vitest-environment jsdom
 */
import { ref } from '@vue/reactivity'
import { Fragment, defineVaporComponent, h, nextTick } from '../src/index.js'
import { flushAll, makeRender } from './_utils.js'

const define = makeRender()

describe('h()', () => {
  test('creates an element', () => {
    const { host } = define(() => h('div')).render()
    expect(host.innerHTML).toBe('<div></div>')
  })

  test('element with static props', () => {
    const { host } = define(() => h('div', { id: 'x', class: 'foo' })).render()
    expect(host.innerHTML).toBe('<div id="x" class="foo"></div>')
  })

  test('element with text children (omit props)', () => {
    const { host } = define(() => h('div', 'hello')).render()
    expect(host.innerHTML).toBe('<div>hello</div>')
  })

  test('element with nested children', () => {
    const { host } = define(() =>
      h('div', null, [h('span', null, 'a'), h('span', null, 'b')]),
    ).render()
    expect(host.innerHTML).toBe('<div><span>a</span><span>b</span></div>')
  })

  test('reactive prop via getter', async () => {
    const cls = ref('a')
    const { host } = define(() => h('div', { class: () => cls.value })).render()
    expect(host.innerHTML).toBe('<div class="a"></div>')

    cls.value = 'b'
    await nextTick()
    expect(host.innerHTML).toBe('<div class="b"></div>')
  })

  test('reactive prop via ref', async () => {
    const id = ref('one')
    const { host } = define(() => h('div', { id })).render()
    expect(host.innerHTML).toBe('<div id="one"></div>')

    id.value = 'two'
    await nextTick()
    expect(host.innerHTML).toBe('<div id="two"></div>')
  })

  test('reactive text children via getter', async () => {
    const msg = ref('hi')
    const { host } = define(() => h('div', null, () => msg.value)).render()
    expect(host.textContent).toBe('hi')

    msg.value = 'bye'
    await flushAll()
    expect(host.textContent).toBe('bye')
  })

  test('reactive text children via ref', async () => {
    const msg = ref('hi')
    const { host } = define(() => h('div', null, msg)).render()
    expect(host.textContent).toBe('hi')

    msg.value = 'bye'
    await flushAll()
    expect(host.textContent).toBe('bye')
  })

  test('vapor component with props and default slot', async () => {
    const Child = defineVaporComponent({
      props: ['label'],
      setup(props, { slots }) {
        return h('div', null, [
          h('span', null, () => props.label),
          slots.default ? slots.default() : null,
        ])
      },
    })

    const msg = ref('x')
    const { host } = define(() =>
      h(Child, { label: () => msg.value }, () => h('i', null, 'slot')),
    ).render()

    expect(host.innerHTML).toContain('x')
    expect(host.innerHTML).toContain('<i>slot</i>')

    msg.value = 'y'
    await flushAll()
    expect(host.innerHTML).toContain('y')
  })

  test('named slots object', () => {
    const Comp = defineVaporComponent({
      setup(_, { slots }) {
        return h('div', null, [
          slots.header ? slots.header() : null,
          slots.default ? slots.default() : null,
        ])
      },
    })

    const { host } = define(() =>
      h(Comp, null, {
        header: () => h('h1', null, 'title'),
        default: () => h('p', null, 'body'),
      }),
    ).render()

    expect(host.innerHTML).toContain('<h1>title</h1>')
    expect(host.innerHTML).toContain('<p>body</p>')
  })

  test('Fragment multi-root', () => {
    const { host } = define(() =>
      h(Fragment, null, [h('span', null, 'a'), h('span', null, 'b')]),
    ).render()
    expect(host.innerHTML).toBe('<span>a</span><span>b</span>')
  })

  test('Fragment with reactive children', async () => {
    const msg = ref('a')
    const { host } = define(() =>
      h(Fragment, null, () => [h('span', null, msg.value)]),
    ).render()
    expect(host.textContent).toBe('a')

    msg.value = 'b'
    await flushAll()
    expect(host.textContent).toBe('b')
  })

  test('event handler', () => {
    const calls = []
    const { host } = define(() =>
      h('button', {
        onClick: () => {
          calls.push(1)
        },
      }),
    ).render()

    host.querySelector('button').click()
    expect(calls).toEqual([1])
  })

  test('dynamic type via ref', async () => {
    const tag = ref('div')
    const { host } = define(() => h(tag, { id: 'x' }, 'n')).render()
    expect(host.innerHTML).toMatch(/<div id="x">/)

    tag.value = 'section'
    await flushAll()
    expect(host.innerHTML).toMatch(/<section id="x">/)
  })

  test('warns on non-vapor options component', () => {
    const Bad = {
      setup() {
        return h('div')
      },
    }
    define(() => h(Bad)).render()
    expect('without __vapor').toHaveBeenWarned()
  })
})
