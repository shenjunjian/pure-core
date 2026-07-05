/**
 * @vitest-environment jsdom
 */
import { ref } from '@vue/reactivity'
import { VaporBlockShape, VaporIfFlags } from '@vue/shared'
import {
  VaporKeepAlive,
  child,
  createComponent,
  createDynamicComponent,
  createIf,
  createTemplateRefSetter,
  defineVaporComponent,
  nextTick,
  onActivated,
  onBeforeMount,
  onDeactivated,
  onMounted,
  onUnmounted,
  renderEffect,
  setBlockKey,
  setText,
  template,
} from '../../src/index.js'
import { ifFlags, makeRender } from '../_utils.js'

const define = makeRender()
const singleRootIfElse =
  VaporBlockShape.SINGLE_ROOT | (VaporBlockShape.SINGLE_ROOT << 2)

describe('VaporKeepAlive', () => {
  let one
  let two
  let views
  let root

  let oneHooks = {}
  let twoHooks = {}

  beforeEach(() => {
    root = document.createElement('div')
    oneHooks = {
      beforeMount: vi.fn(),
      mounted: vi.fn(),
      activated: vi.fn(),
      deactivated: vi.fn(),
      unmounted: vi.fn(),
    }
    one = defineVaporComponent({
      name: 'one',
      setup(_, { expose }) {
        onBeforeMount(() => oneHooks.beforeMount())
        onMounted(() => oneHooks.mounted())
        onActivated(() => oneHooks.activated())
        onDeactivated(() => oneHooks.deactivated())
        onUnmounted(() => oneHooks.unmounted())

        const msg = ref('one')
        expose({ setMsg: m => (msg.value = m) })

        const n0 = template(`<div> </div>`)()
        const x0 = child(n0)
        renderEffect(() => setText(x0, msg.value))
        return n0
      },
    })
    twoHooks = {
      beforeMount: vi.fn(),
      mounted: vi.fn(),
      activated: vi.fn(),
      deactivated: vi.fn(),
      unmounted: vi.fn(),
    }
    two = defineVaporComponent({
      name: 'two',
      setup() {
        onBeforeMount(() => twoHooks.beforeMount())
        onMounted(() => twoHooks.mounted())
        onActivated(() => twoHooks.activated())
        onDeactivated(() => twoHooks.deactivated())
        onUnmounted(() => twoHooks.unmounted())

        const msg = ref('two')
        const n0 = template(`<div> </div>`)()
        const x0 = child(n0)
        renderEffect(() => setText(x0, msg.value))
        return n0
      },
    })
    views = { one, two }
  })

  function assertHookCalls(hooks, callCounts) {
    expect([
      hooks.beforeMount.mock.calls.length,
      hooks.mounted.mock.calls.length,
      hooks.activated.mock.calls.length,
      hooks.deactivated.mock.calls.length,
      hooks.unmounted.mock.calls.length,
    ]).toEqual(callCounts)
  }

  test('should preserve state', async () => {
    const viewRef = ref('one')
    const instanceRef = ref(null)

    const { mount } = define({
      setup() {
        const setTemplateRef = createTemplateRefSetter()
        const n4 = createComponent(VaporKeepAlive, null, {
          default: () => {
            const n0 = createDynamicComponent(() => views[viewRef.value])
            setTemplateRef(n0, instanceRef)
            return n0
          },
        })
        return n4
      },
    }).create()

    mount(root)
    expect(root.innerHTML).toBe(`<div>one</div><!--dynamic-component-->`)

    instanceRef.value.setMsg('changed')
    await nextTick()
    expect(root.innerHTML).toBe(`<div>changed</div><!--dynamic-component-->`)

    viewRef.value = 'two'
    await nextTick()
    expect(root.innerHTML).toBe(`<div>two</div><!--dynamic-component-->`)

    viewRef.value = 'one'
    await nextTick()
    expect(root.innerHTML).toBe(`<div>changed</div><!--dynamic-component-->`)
  })

  test('should not use wrapper key as child cache key', async () => {
    const viewRef = ref('one')
    let cache

    const { mount } = define({
      setup() {
        const n0 = createComponent(VaporKeepAlive, null, {
          default: () => createDynamicComponent(() => views[viewRef.value]),
        })
        setBlockKey(n0, 'wrapper')
        cache = n0.__v_cache
        return n0
      },
    }).create()

    mount(root)
    await nextTick()
    expect(cache.has(one)).toBe(true)
    expect(cache.has('wrapper')).toBe(false)
    expect(oneHooks.beforeMount).toHaveBeenCalledTimes(1)

    viewRef.value = 'two'
    await nextTick()
    expect(cache.has(one)).toBe(true)
    expect(cache.has(two)).toBe(true)
    expect(cache.has('wrapper')).toBe(false)

    viewRef.value = 'one'
    await nextTick()
    expect(oneHooks.beforeMount).toHaveBeenCalledTimes(1)
  })

  test('should cache same component across branches', async () => {
    const toggle = ref(true)
    const instanceA = ref(null)
    const instanceB = ref(null)

    const { html } = define({
      setup() {
        const setRefA = createTemplateRefSetter()
        const setRefB = createTemplateRefSetter()
        return createComponent(VaporKeepAlive, null, {
          default: () =>
            createIf(
              () => toggle.value,
              () => {
                const n0 = createComponent(one)
                setRefA(n0, instanceA)
                return n0
              },
              () => {
                const n1 = createComponent(one)
                setRefB(n1, instanceB)
                return n1
              },
              ifFlags(singleRootIfElse, false, 0),
            ),
        })
      },
    }).render()

    expect(html()).toBe(`<div>one</div><!--if-->`)

    instanceA.value.setMsg('A')
    await nextTick()
    expect(html()).toBe(`<div>A</div><!--if-->`)

    toggle.value = false
    await nextTick()
    expect(html()).toBe(`<div>one</div><!--if-->`)

    instanceB.value.setMsg('B')
    await nextTick()
    expect(html()).toBe(`<div>B</div><!--if-->`)

    toggle.value = true
    await nextTick()
    expect(html()).toBe(`<div>A</div><!--if-->`)
  })

  test('should call correct lifecycle hooks', async () => {
    const toggle = ref(true)
    const viewRef = ref('one')

    const { mount } = define({
      setup() {
        return createIf(
          () => toggle.value,
          () =>
            createComponent(VaporKeepAlive, null, {
              default: () => createDynamicComponent(() => views[viewRef.value]),
            }),
        )
      },
    }).create()
    mount(root)
    expect(root.innerHTML).toBe(
      `<div>one</div><!--dynamic-component--><!--if-->`,
    )
    assertHookCalls(oneHooks, [1, 1, 1, 0, 0])
    assertHookCalls(twoHooks, [0, 0, 0, 0, 0])

    viewRef.value = 'two'
    await nextTick()
    assertHookCalls(oneHooks, [1, 1, 1, 1, 0])
    assertHookCalls(twoHooks, [1, 1, 1, 0, 0])

    viewRef.value = 'one'
    await nextTick()
    expect(root.innerHTML).toBe(
      `<div>one</div><!--dynamic-component--><!--if-->`,
    )
    assertHookCalls(oneHooks, [1, 1, 2, 1, 0])
    assertHookCalls(twoHooks, [1, 1, 1, 1, 0])

    viewRef.value = 'two'
    await nextTick()
    expect(root.innerHTML).toBe(
      `<div>two</div><!--dynamic-component--><!--if-->`,
    )
    assertHookCalls(oneHooks, [1, 1, 2, 2, 0])
    assertHookCalls(twoHooks, [1, 1, 2, 1, 0])

    toggle.value = false
    await nextTick()
    expect(root.innerHTML).toBe(`<!--if-->`)
    assertHookCalls(oneHooks, [1, 1, 2, 2, 1])
    assertHookCalls(twoHooks, [1, 1, 2, 2, 1])
  })

  test('should stop branch scope when cache entry is pruned', async () => {
    const One = defineVaporComponent({
      name: 'One',
      setup() {
        return template('<div>one</div>')()
      },
    })

    const Two = defineVaporComponent({
      name: 'Two',
      setup() {
        return template('<div>two</div>')()
      },
    })

    const include = ref('One,Two')
    const toggle = ref(true)
    const { html, instance } = define({
      setup() {
        return createComponent(
          VaporKeepAlive,
          { include: () => include.value },
          {
            default: () =>
              createIf(
                () => toggle.value,
                () => createComponent(One),
                () => createComponent(Two),
              ),
          },
        )
      },
    }).render()

    const keepAliveInstance = instance.block
    const keptAliveScopes = keepAliveInstance.__v_keptAliveScopes

    expect(html()).toBe('<div>one</div><!--if-->')

    toggle.value = false
    await nextTick()
    expect(html()).toBe('<div>two</div><!--if-->')
    expect(keptAliveScopes.size).toBe(2)

    include.value = 'Two'
    await nextTick()
    expect(keptAliveScopes.size).toBe(0)
  })
})
