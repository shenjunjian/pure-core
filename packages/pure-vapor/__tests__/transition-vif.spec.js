/**
 * @vitest-environment jsdom
 */
import { ref } from '@vue/reactivity'
import { BindingTypes } from '@vue/compiler-dom'
import { VaporBlockShape, VaporIfFlags } from '@vue/shared'
import {
  VaporTransition,
  createComponent,
  createIf,
  createVaporApp,
  insert,
  template,
} from '../src/index.js'
import {
  compileToPureVaporRender,
  flushAll,
  ifFlags,
  makeRender,
} from './_utils.js'

const define = makeRender()
const singleRootNoScopeIfElse =
  VaporBlockShape.SINGLE_ROOT |
  (VaporBlockShape.SINGLE_ROOT << 2) |
  VaporIfFlags.TRUE_NO_SCOPE |
  VaporIfFlags.FALSE_NO_SCOPE

describe('Transition + v-if', () => {
  test('createIf toggles without transition', async () => {
    const show = ref(true)
    const root = template('<div></div>')()
    insert(
      createIf(
        () => show.value,
        () => template('<div>x</div>')(),
        null,
        129,
      ),
      root,
    )
    await flushAll()
    expect(root.textContent).toBe('x')
    show.value = false
    await flushAll()
    expect(root.textContent).toBe('')
  })

  test('toggles slot content when default slot is passed as a function', async () => {
    const render = compileToPureVaporRender(
      `<div class="wrap"><transition :css="false"><div v-if="toggle" class="test">content</div></transition></div>`,
      {
        bindingMetadata: { toggle: BindingTypes.SETUP_REF },
      },
    )

    const toggle = ref(true)
    const Comp = {
      __vapor: true,
      setup() {
        return { toggle }
      },
      render,
    }

    const root = document.createElement('div')
    createVaporApp(Comp).mount(root)
    await flushAll()

    expect(root.innerHTML).toContain('class="test"')

    toggle.value = false
    await flushAll()
    expect(root.innerHTML).not.toContain('class="test"')

    toggle.value = true
    await flushAll()
    expect(root.innerHTML).toContain('class="test"')
  })

  test('should preserve no-scope pending branch during out-in transition', async () => {
    const show = ref(true)
    const onLeave = vi.fn((_, done) => setTimeout(done, 0))
    const t0 = template('<div>foo</div>')
    const t1 = template('<p>bar</p>')
    let frag

    const { host } = define(() =>
      createComponent(
        VaporTransition,
        { mode: () => 'out-in', onLeave: () => onLeave },
        {
          default: () =>
            (frag = createIf(
              () => show.value,
              () => t0(),
              () => t1(),
              ifFlags(singleRootNoScopeIfElse, false, 0),
            )),
        },
        true,
      ),
    ).render()

    expect(host.innerHTML).toBe('<div>foo</div><!--if-->')
    expect(frag.scope).toBeUndefined()

    show.value = false
    await flushAll()
    expect(host.textContent).toContain('foo')
    expect(host.textContent).not.toContain('bar')
    expect(onLeave).toHaveBeenCalledTimes(1)

    await new Promise(r => setTimeout(r, 0))
    await flushAll()
    expect(host.innerHTML).toContain('bar')
    expect(host.innerHTML).not.toContain('foo')
    expect(frag.scope).toBeUndefined()
  })
})
