/**
 * @vitest-environment jsdom
 */
import { ref } from '@vue/reactivity'
import { VaporBlockShape, VaporIfFlags } from '@vue/shared'
import {
  VaporKeepAlive,
  VaporTransition,
  createComponent,
  createIf,
  defineVaporComponent,
  insert,
  renderEffect,
  template,
} from '../src/index.js'
import { setElementText } from '../src/vapor/dom/prop.js'
import { flushAll, ifFlags, makeRender } from './_utils.js'

const define = makeRender()
const singleRootIfElse =
  VaporBlockShape.SINGLE_ROOT | (VaporBlockShape.SINGLE_ROOT << 2)
const singleRootNoScopeIfElse =
  singleRootIfElse | VaporIfFlags.TRUE_NO_SCOPE | VaporIfFlags.FALSE_NO_SCOPE

describe('createIf', () => {
  test('basic', async () => {
    const count = ref(0)
    const t0 = template('<div></div>')
    const t1 = template('<p></p>')
    const t2 = template('<p>zero</p>')

    const n0 = t0()
    insert(
      createIf(
        () => count.value,
        () => {
          const n2 = t1()
          renderEffect(() => {
            setElementText(n2, count.value)
          })
          return n2
        },
        () => t2(),
      ),
      n0,
    )

    await flushAll()
    const container = n0
    expect(container.textContent).toBe('zero')

    count.value = 1
    await flushAll()
    expect(container.textContent).toBe('1')

    count.value = 0
    await flushAll()
    expect(container.textContent).toBe('zero')
  })

  test('should skip no-scope static branch under KeepAlive', async () => {
    const show = ref(false)
    const childSetup = vi.fn()
    const t0 = template('<p>static</p>')
    const t1 = template('<div>child</div>')
    const Child = defineVaporComponent({
      name: 'Child',
      setup() {
        childSetup()
        return t1()
      },
    })
    let frag
    const flags = ifFlags(
      singleRootIfElse | VaporIfFlags.FALSE_NO_SCOPE,
      false,
      0,
    )

    const { host } = define(() =>
      createComponent(VaporKeepAlive, null, {
        default: () =>
          (frag = createIf(
            () => show.value,
            () => createComponent(Child),
            () => t0(),
            flags,
          )),
      }),
    ).render()

    expect(host.innerHTML).toBe('<p>static</p><!--if-->')
    expect(frag.scope).toBeUndefined()

    show.value = true
    await flushAll()
    expect(host.innerHTML).toBe('<div>child</div><!--if-->')
    expect(frag.scope).toBeDefined()
    expect(childSetup).toHaveBeenCalledTimes(1)
    const componentScope = frag.scope

    show.value = false
    await flushAll()
    expect(host.innerHTML).toBe('<p>static</p><!--if-->')
    expect(frag.scope).toBeUndefined()

    show.value = true
    await flushAll()
    expect(host.innerHTML).toBe('<div>child</div><!--if-->')
    expect(frag.scope).toBe(componentScope)
    expect(childSetup).toHaveBeenCalledTimes(1)
  })

  test('should not set branch block key without Transition or KeepAlive', async () => {
    const show = ref(true)
    const t0 = template('<div>foo</div>')
    const t1 = template('<div>bar</div>')
    let branch

    const { host } = define(() =>
      createIf(
        () => show.value,
        () => (branch = t0()),
        () => (branch = t1()),
        ifFlags(singleRootIfElse, false, 0),
      ),
    ).render()

    expect(host.innerHTML).toBe('<div>foo</div><!--if-->')
    expect(branch.$key).toBeUndefined()

    show.value = false
    await flushAll()

    expect(host.innerHTML).toBe('<div>bar</div><!--if-->')
    expect(branch.$key).toBeUndefined()
  })

  test('should set branch block key inside Transition', () => {
    const show = ref(true)
    const t0 = template('<div>foo</div>')
    const t1 = template('<div>bar</div>')
    let branch

    define(() =>
      createComponent(
        VaporTransition,
        null,
        {
          default: () =>
            createIf(
              () => show.value,
              () => (branch = t0()),
              () => (branch = t1()),
              ifFlags(singleRootIfElse, false, 0),
            ),
        },
        true,
      ),
    ).render()

    expect(branch.$key).toBe(0)
  })
})
