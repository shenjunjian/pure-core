/**
 * @vitest-environment jsdom
 */
import { ref, shallowRef } from '@vue/reactivity'
import {
  VaporKeepAlive,
  VaporTeleport,
  createComponent,
  nextTick,
  template,
} from '../../src/index.js'
import { makeRender } from '../_utils.js'

const define = makeRender()

describe('renderer: VaporTeleport', () => {
  describe('eager mode', () => {
    runSharedTests(false)
  })

  describe('defer mode', () => {
    runSharedTests(true)

    test('should be able to target content appearing later than the teleport with defer', () => {
      const root = document.createElement('div')
      document.body.appendChild(root)

      const { mount } = define({
        setup() {
          const n1 = createComponent(
            VaporTeleport,
            {
              to: () => '#target',
              defer: () => true,
            },
            {
              default: () => template('<div>teleported</div>')(),
            },
          )
          const n2 = template('<div id=target></div>')()
          return [n1, n2]
        },
      }).create()
      mount(root)

      expect(root.innerHTML).toBe(
        '<!--teleport start--><!--teleport end--><div id="target"><div>teleported</div></div>',
      )
    })
  })
})

function runSharedTests(defer) {
  const createComponentWithDefer = defer
    ? (component, rawProps, ...args) => {
        if (component === VaporTeleport) {
          rawProps.defer = () => true
        }
        return createComponent(component, rawProps, ...args)
      }
    : createComponent

  test('should work', () => {
    const target = document.createElement('div')
    const root = document.createElement('div')

    const { mount } = define({
      setup() {
        const n0 = createComponentWithDefer(
          VaporTeleport,
          { to: () => target },
          { default: () => template('<div>teleported</div>')() },
        )
        const n1 = template('<div>root</div>')()
        return [n0, n1]
      },
    }).create()
    mount(root)

    expect(root.innerHTML).toBe(
      '<!--teleport start--><!--teleport end--><div>root</div>',
    )
    expect(target.innerHTML).toBe('<div>teleported</div>')
  })

  test('should treat function rawSlots as default slot', () => {
    const target = document.createElement('div')
    const root = document.createElement('div')

    const { mount } = define({
      setup() {
        const n0 = createComponentWithDefer(
          VaporTeleport,
          { to: () => target },
          () => template('<div>teleported</div>')(),
        )
        const n1 = template('<div>root</div>')()
        return [n0, n1]
      },
    }).create()
    mount(root)

    expect(root.innerHTML).toBe(
      '<!--teleport start--><!--teleport end--><div>root</div>',
    )
    expect(target.innerHTML).toBe('<div>teleported</div>')
  })

  test('should handle missing slots without crashing', () => {
    const target = document.createElement('div')
    const root = document.createElement('div')

    const { mount } = define({
      setup() {
        const n0 = createComponentWithDefer(VaporTeleport, { to: () => target })
        const n1 = template('<div>root</div>')()
        return [n0, n1]
      },
    }).create()
    mount(root)

    expect(root.innerHTML).toBe(
      '<!--teleport start--><!--teleport end--><div>root</div>',
    )
    expect(target.innerHTML).toBe('')
  })

  test('should update target', async () => {
    const targetA = document.createElement('div')
    const targetB = document.createElement('div')
    const target = ref(targetA)
    const root = document.createElement('div')

    const { mount } = define({
      setup() {
        const n0 = createComponentWithDefer(
          VaporTeleport,
          { to: () => target.value },
          { default: () => template('<div>teleported</div>')() },
        )
        const n1 = template('<div>root</div>')()
        return [n0, n1]
      },
    }).create()
    mount(root)

    expect(targetA.innerHTML).toBe('<div>teleported</div>')
    expect(targetB.innerHTML).toBe('')

    target.value = targetB
    await nextTick()

    expect(targetA.innerHTML).toBe('')
    expect(targetB.innerHTML).toBe('<div>teleported</div>')
  })

  test('should update children', async () => {
    const target = document.createElement('div')
    const root = document.createElement('div')
    const children = shallowRef([template('<div>teleported</div>')()])

    const { mount } = define({
      setup() {
        const n0 = createComponentWithDefer(
          VaporTeleport,
          { to: () => target },
          { default: () => children.value },
        )
        const n1 = template('<div>root</div>')()
        return [n0, n1]
      },
    }).create()
    mount(root)

    expect(target.innerHTML).toBe('<div>teleported</div>')

    children.value = [template('')()]
    await nextTick()
    expect(target.innerHTML).toBe('')

    children.value = [template('teleported')()]
    await nextTick()
    expect(target.innerHTML).toBe('teleported')
  })

  test('disabled', async () => {
    const target = document.createElement('div')
    const disabled = ref(true)
    const root = document.createElement('div')

    const { mount } = define({
      setup() {
        const n0 = createComponentWithDefer(
          VaporTeleport,
          {
            to: () => target,
            disabled: () => disabled.value,
          },
          { default: () => template('<div>teleported</div>')() },
        )
        return n0
      },
    }).create()
    mount(root)

    expect(root.innerHTML).toContain('teleported')
    expect(target.innerHTML).toBe('')

    disabled.value = false
    await nextTick()

    expect(root.innerHTML).not.toContain('teleported')
    expect(target.innerHTML).toBe('<div>teleported</div>')
  })
}
