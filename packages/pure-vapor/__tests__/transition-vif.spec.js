/**
 * @vitest-environment jsdom
 */
import { ref } from '@vue/reactivity'
import { BindingTypes } from '@vue/compiler-dom'
import { createIf, createVaporApp, insert, template } from '../src/index.js'
import { compileToPureVaporRender, flushAll } from './_utils.js'

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
})
