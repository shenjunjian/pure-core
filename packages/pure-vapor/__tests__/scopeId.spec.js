/**
 * @vitest-environment jsdom
 */
import { ref } from '@vue/reactivity'
import { BindingTypes } from '@vue/compiler-dom'
import { VaporDynamicComponentFlags, VaporSlotFlags } from '@vue/shared'
import {
  VaporTeleport,
  createComponent,
  createDynamicComponent,
  createFor,
  createIf,
  createSlot,
  defineVaporComponent,
  nextTick,
  setInsertionState,
  template,
} from '../src/index.js'
import { compile, compileToPureVaporRender, makeRender } from './_utils.js'

const define = makeRender()
const slottedScopeProbeConnections =
  (globalThis.__slottedScopeProbeConnections ||= [])

function defineSlottedScopeProbe() {
  if (!customElements.get('slotted-scope-probe')) {
    customElements.define(
      'slotted-scope-probe',
      class extends HTMLElement {
        connectedCallback() {
          slottedScopeProbeConnections.push(this.hasAttribute('child-s'))
        }
      },
    )
  }
}

describe('scopeId', () => {
  test('should attach scopeId to child component', () => {
    const Child = defineVaporComponent({
      __scopeId: 'child',
      setup() {
        return template('<div child></div>', 1)()
      },
    })

    const { html } = define({
      __scopeId: 'parent',
      setup() {
        return createComponent(Child)
      },
    }).render()
    expect(html()).toBe(`<div child="" parent=""></div>`)
  })

  test('should attach scopeId to updated dynamic child component root', async () => {
    const showAlt = ref(false)
    const Child = defineVaporComponent({
      __scopeId: 'child',
      render: compileToPureVaporRender(
        `<section v-if="showAlt">alt</section><div v-else>base</div>`,
        {
          bindingMetadata: {
            showAlt: BindingTypes.SETUP_REF,
          },
          scopeId: 'child',
        },
      ),
      setup() {
        return { showAlt }
      },
    })

    const { html } = define({
      __scopeId: 'parent',
      setup() {
        return createComponent(Child)
      },
    }).render()

    expect(html()).toBe(`<div child="" parent="">base</div><!--if-->`)

    showAlt.value = true
    await nextTick()

    expect(html()).toBe(`<section child="" parent="">alt</section><!--if-->`)
  })

  test('should attach scopeId to child component with insertion state', () => {
    const Child = defineVaporComponent({
      __scopeId: 'child',
      setup() {
        return template('<div child></div>', 1)()
      },
    })

    const { html } = define({
      __scopeId: 'parent',
      setup() {
        const t0 = template('<div parent></div>', 1)
        const n1 = t0()
        setInsertionState(n1)
        createComponent(Child)
        return n1
      },
    }).render()
    expect(html()).toBe(`<div parent=""><div child="" parent=""></div></div>`)
  })

  test('should attach scopeId to nested child component', () => {
    const Child = defineVaporComponent({
      __scopeId: 'child',
      setup() {
        return template('<div child></div>', 1)()
      },
    })

    const Parent = defineVaporComponent({
      __scopeId: 'parent',
      setup() {
        return createComponent(Child)
      },
    })

    const { html } = define({
      __scopeId: 'app',
      setup() {
        return createComponent(Parent)
      },
    }).render()
    expect(html()).toBe(`<div child="" parent="" app=""></div>`)
  })

  test('should not attach scopeId to nested multiple root components', () => {
    const Child = defineVaporComponent({
      __scopeId: 'child',
      setup() {
        return template('<div child></div>', 1)()
      },
    })

    const Parent = defineVaporComponent({
      __scopeId: 'parent',
      setup() {
        const n0 = template('<div parent></div>')()
        const n1 = createComponent(Child)
        return [n0, n1]
      },
    })

    const { html } = define({
      __scopeId: 'app',
      setup() {
        return createComponent(Parent)
      },
    }).render()
    expect(html()).toBe(`<div parent=""></div><div child="" parent=""></div>`)
  })

  test('should attach scopeId to nested child component with insertion state', () => {
    const Child = defineVaporComponent({
      __scopeId: 'child',
      setup() {
        return template('<div child></div>', 1)()
      },
    })

    const Parent = defineVaporComponent({
      __scopeId: 'parent',
      setup() {
        return createComponent(Child)
      },
    })

    const { html } = define({
      __scopeId: 'app',
      setup() {
        const t0 = template('<div app></div>', 1)
        const n1 = t0()
        setInsertionState(n1)
        createComponent(Parent)
        return n1
      },
    }).render()
    expect(html()).toBe(
      `<div app=""><div child="" parent="" app=""></div></div>`,
    )
  })

  test('should attach scopeId to dynamic component', () => {
    const { html } = define({
      __scopeId: 'parent',
      setup() {
        return createDynamicComponent(() => 'button')
      },
    }).render()
    expect(html()).toBe(`<button parent=""></button><!--dynamic-component-->`)
  })

  test('should attach scopeId to dynamic component with insertion state', () => {
    const { html } = define({
      __scopeId: 'parent',
      setup() {
        const t0 = template('<div parent></div>', 1)
        const n1 = t0()
        setInsertionState(n1)
        createDynamicComponent(() => 'button')
        return n1
      },
    }).render()
    expect(html()).toBe(
      `<div parent=""><button parent=""></button><!--dynamic-component--></div>`,
    )
  })

  test('should attach scopeId to nested dynamic component', () => {
    const Comp = defineVaporComponent({
      __scopeId: 'child',
      setup() {
        return createDynamicComponent(
          () => 'button',
          null,
          null,
          VaporDynamicComponentFlags.SINGLE_ROOT,
        )
      },
    })
    const { html } = define({
      __scopeId: 'parent',
      setup() {
        return createComponent(Comp, null, null, true)
      },
    }).render()
    expect(html()).toBe(
      `<button child="" parent=""></button><!--dynamic-component-->`,
    )
  })

  test('should attach scopeId to nested dynamic component with insertion state', () => {
    const Comp = defineVaporComponent({
      __scopeId: 'child',
      setup() {
        return createDynamicComponent(
          () => 'button',
          null,
          null,
          VaporDynamicComponentFlags.SINGLE_ROOT,
        )
      },
    })
    const { html } = define({
      __scopeId: 'parent',
      setup() {
        const t0 = template('<div parent></div>', 1)
        const n1 = t0()
        setInsertionState(n1)
        createComponent(Comp, null, null, true)
        return n1
      },
    }).render()
    expect(html()).toBe(
      `<div parent=""><button child="" parent=""></button><!--dynamic-component--></div>`,
    )
  })

  test('should work on slots', () => {
    const Child = defineVaporComponent({
      __scopeId: 'child',
      setup() {
        const n1 = template('<div child></div>', 1)()
        setInsertionState(n1)
        createSlot('default', null)
        return n1
      },
    })

    const Child2 = defineVaporComponent({
      __scopeId: 'child2',
      setup() {
        return template('<span child2></span>', 1)()
      },
    })

    const { html } = define({
      __scopeId: 'parent',
      setup() {
        const n2 = createComponent(
          Child,
          null,
          {
            default: () => {
              const n0 = template('<div parent></div>')()
              const n1 = createComponent(Child2)
              return [n0, n1]
            },
          },
          true,
        )
        return n2
      },
    }).render()

    expect(html()).toBe(
      `<div child="" parent="">` +
        `<div parent="" child-s=""></div>` +
        `<span child2="" child-s="" parent=""></span>` +
        `<!--slot-->` +
        `</div>`,
    )
  })

  test(':slotted on forwarded slots', async () => {
    const Wrapper = defineVaporComponent({
      __scopeId: 'wrapper',
      setup() {
        const n1 = template('<div wrapper></div>', 1)()
        setInsertionState(n1)
        createSlot('default', null, undefined, VaporSlotFlags.NO_SLOTTED)
        return n1
      },
    })

    const Slotted = defineVaporComponent({
      __scopeId: 'slotted',
      setup() {
        const n1 = createComponent(
          Wrapper,
          null,
          {
            default: () => {
              const n0 = createSlot('default', null)
              return n0
            },
          },
          true,
        )
        return n1
      },
    })

    const { html } = define({
      __scopeId: 'root',
      setup() {
        const n2 = createComponent(
          Slotted,
          null,
          {
            default: () => {
              return template('<div root></div>')()
            },
          },
          true,
        )
        return n2
      },
    }).render()

    expect(html()).toBe(
      `<div wrapper="" slotted="" root="">` +
        `<div root="" slotted-s=""></div>` +
        `<!--slot--><!--slot-->` +
        `</div>`,
    )
  })

  test(':slotted on dynamic slot outlet update', async () => {
    const data = ref({ slotName: 'one' })
    const Child = compile(
      `<template><slot :name="data.slotName" /></template>`,
      data,
    )
    Child.__scopeId = 'child'

    const Parent = compile(
      `<template>
        <components.Child>
          <template #one><div>one</div></template>
          <template #two><section>two</section></template>
        </components.Child>
      </template>`,
      data,
      { Child },
    )

    const { html } = define(Parent).render()

    expect(html()).toBe(`<div child-s="">one</div><!--slot-->`)

    data.value = { slotName: 'two' }
    await nextTick()

    expect(html()).toBe(`<section child-s="">two</section><!--slot-->`)
  })

  test(':slotted on v-for content added after mount', async () => {
    const count = ref(0)
    const Child = compile(`<template><slot /></template>`, count)
    Child.__scopeId = 'child'

    const Parent = compile(
      `<template>
        <components.Child>
          <div v-for="i in data">item</div>
        </components.Child>
      </template>`,
      count,
      { Child },
    )

    const { html } = define(Parent).render()

    expect(html()).toBe(`<!--for--><!--slot-->`)

    count.value++
    await nextTick()

    expect(html()).toBe(`<div child-s="">item</div><!--for--><!--slot-->`)

    count.value++
    await nextTick()

    expect(html()).toBe(
      `<div child-s="">item</div><div child-s="">item</div><!--for--><!--slot-->`,
    )
  })

  test(':slotted on v-for content applies scope id before insertion', async () => {
    defineSlottedScopeProbe()
    slottedScopeProbeConnections.length = 0

    const count = ref(0)
    const Child = defineVaporComponent({
      __scopeId: 'child',
      setup() {
        return createSlot('default')
      },
    })

    const { html } = define({
      setup() {
        return createComponent(
          Child,
          null,
          {
            default: () =>
              createFor(
                () => count.value,
                () =>
                  template(
                    '<slotted-scope-probe>item</slotted-scope-probe>',
                    1,
                  )(),
              ),
          },
          true,
        )
      },
    }).render()

    count.value++
    await nextTick()

    expect(slottedScopeProbeConnections).toEqual([true])
    expect(html()).toBe(
      `<slotted-scope-probe child-s="">item</slotted-scope-probe><!--for--><!--slot-->`,
    )
  })

  test(':slotted on v-for content inside v-if added after mount', async () => {
    const data = ref({ show: false, count: 1 })
    const Child = compile(`<template><slot /></template>`, data)
    Child.__scopeId = 'child'

    const Parent = compile(
      `<template>
        <components.Child>
          <template v-if="data.show">
            <div v-for="i in data.count">item</div>
          </template>
        </components.Child>
      </template>`,
      data,
      { Child },
    )

    const { html } = define(Parent).render()

    expect(html()).toBe(`<!--if--><!--slot-->`)

    data.value = { show: true, count: 1 }
    await nextTick()

    expect(html()).toBe(
      `<div child-s="">item</div><!--for--><!--if--><!--slot-->`,
    )

    data.value = { show: true, count: 2 }
    await nextTick()

    expect(html()).toBe(
      `<div child-s="">item</div><div child-s="">item</div><!--for--><!--if--><!--slot-->`,
    )
  })

  test(':slotted on teleported content added after mount', async () => {
    const target = document.createElement('div')
    document.body.appendChild(target)
    const show = ref(false)

    try {
      const Child = defineVaporComponent({
        __scopeId: 'child',
        setup() {
          return createSlot('default')
        },
      })

      const { html } = define({
        setup() {
          return createComponent(
            Child,
            null,
            {
              default: () =>
                createComponent(
                  VaporTeleport,
                  { to: () => target },
                  {
                    default: () =>
                      createIf(
                        () => show.value,
                        () => template('<div>item</div>')(),
                      ),
                  },
                ),
            },
            true,
          )
        },
      }).render()

      expect(html()).toBe(`<!--teleport start--><!--teleport end--><!--slot-->`)
      expect(target.innerHTML).toBe(`<!--if-->`)

      show.value = true
      await nextTick()

      expect(target.innerHTML).toBe(`<div child-s="">item</div><!--if-->`)
    } finally {
      target.remove()
    }
  })

  test(':slotted on initial teleported content', () => {
    const target = document.createElement('div')
    document.body.appendChild(target)

    try {
      const Child = defineVaporComponent({
        __scopeId: 'child',
        setup() {
          return createSlot('default')
        },
      })

      const { html } = define({
        setup() {
          return createComponent(
            Child,
            null,
            {
              default: () =>
                createComponent(
                  VaporTeleport,
                  { to: () => target },
                  {
                    default: () => template('<div>item</div>')(),
                  },
                ),
            },
            true,
          )
        },
      }).render()

      expect(html()).toBe(`<!--teleport start--><!--teleport end--><!--slot-->`)
      expect(target.innerHTML).toBe(`<div child-s="">item</div>`)
    } finally {
      target.remove()
    }
  })

  test('nested components with slots', async () => {
    const Child = defineVaporComponent({
      setup() {
        const n0 = template('<div>')()
        setInsertionState(n0, null, 0)
        createSlot('default')
        return n0
      },
    })
    const Parent = defineVaporComponent({
      __scopeId: 'data-v-parent',
      setup() {
        const n3 = createComponent(
          Child,
          null,
          {
            default: () => {
              const n2 = createComponent(
                Child,
                null,
                {
                  default: () => {
                    const n1 = createComponent(
                      Child,
                      null,
                      {
                        default: () => {
                          const t0 = template('test')()
                          return t0
                        },
                      },
                      true,
                    )
                    return n1
                  },
                },
                true,
              )
              return n2
            },
          },
          true,
        )
        return n3
      },
    })

    const { host } = define({
      __scopeId: 'app',
      setup() {
        return createComponent(Parent)
      },
    }).render()

    expect(host.innerHTML).toBe(
      `<div data-v-parent="" app="">` +
        `<div data-v-parent="">` +
        `<div data-v-parent="">test<!--slot-->` +
        `</div><!--slot-->` +
        `</div><!--slot-->` +
        `</div>`,
    )
  })

  test('nested components in vFor with slots', async () => {
    const Parent = defineVaporComponent({
      setup() {
        const n1 = template('<div>', 1)()
        setInsertionState(n1, null, 0)
        createSlot('default', null)
        return n1
      },
    })

    const Child = defineVaporComponent({
      setup() {
        const n1 = template('<div>', 1)()
        setInsertionState(n1, null, 0)
        createSlot('default', null)
        return n1
      },
    })

    const count = ref(0)
    const { html } = define({
      __scopeId: 'app',
      setup() {
        const n4 = createComponent(
          Parent,
          null,
          {
            default: () => {
              const n0 = createFor(
                () => count.value,
                _for_item0 => {
                  const n3 = createComponent(
                    Child,
                    { class: () => 'test' },
                    {
                      default: () => {
                        const n2 = template('<div> red ')()
                        return n2
                      },
                    },
                  )
                  return n3
                },
                item => item,
                2,
              )
              return n0
            },
          },
          true,
        )
        return n4
      },
    }).render()

    expect(html()).toBe(`<div app=""><!--for--><!--slot--></div>`)

    count.value++
    await nextTick()
    expect(html()).toBe(
      `<div app="">` +
        `<div class="test" app="">` +
        `<div> red </div><!--slot-->` +
        `</div><!--for-->` +
        `<!--slot--></div>`,
    )
  })
})
