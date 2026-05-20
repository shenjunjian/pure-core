/**
 * @vitest-environment jsdom
 */
import { BindingTypes } from '@vue/compiler-dom'
import { compile } from '@vue/compiler-vapor'
import { ref } from '@vue/reactivity'
import { createVaporApp } from '../src/index.js'
import { compileToPureVaporRender, flushAll } from './_utils.js'

describe('compiler-vapor → pure-vapor', () => {
  test('generated imports use runtimeModuleName pure-vapor', () => {
    const { code } = compile(`<div v-if="ok">{{ msg }}</div>`, {
      mode: 'module',
      prefixIdentifiers: true,
      runtimeModuleName: 'pure-vapor',
      bindingMetadata: {
        ok: BindingTypes.SETUP_CONST,
        msg: BindingTypes.SETUP_REF,
      },
    })

    expect(code).toMatchSnapshot()
    expect(code).toContain("from 'pure-vapor'")
    expect(code).not.toMatch(/from ['"]vue['"]/)
  })

  test('smoke mount compiled render with createVaporApp', async () => {
    const render = compileToPureVaporRender(
      `<div v-if="show"><span>{{ msg }}</span></div>`,
      {
        bindingMetadata: {
          show: BindingTypes.SETUP_REF,
          msg: BindingTypes.SETUP_REF,
        },
      },
    )

    const show = ref(true)
    const msg = ref('hello')

    const Comp = {
      __vapor: true,
      setup() {
        return { show, msg }
      },
      render,
    }

    const root = document.createElement('div')
    createVaporApp(Comp).mount(root)
    await flushAll()
    expect(root.textContent).toBe('hello')

    show.value = false
    await flushAll()
    expect(root.textContent).toBe('')

    show.value = true
    msg.value = 'world'
    await flushAll()
    expect(root.textContent).toBe('world')
  })
})
