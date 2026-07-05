/**
 * @vitest-environment jsdom
 */
import {
  createComponent,
  createIf,
  createSlot,
  defineVaporComponent,
  getCurrentInstance,
  insert,
  nextTick,
  prepend,
  ref,
  renderEffect,
  template,
} from '../src/index.js'
import { isValidBlock, isValidSlot } from '../src/vapor/block.js'
import { VaporBlockShape, VaporIfFlags, VaporSlotFlags } from '@vue/shared'
import { SlotFragment } from '../src/vapor/fragment.js'
import {
  markSlotResolutionDirty,
  recheckSlotResolution,
} from '../src/vapor/slotFragment.js'
import { makeRender } from './_utils.js'

const define = makeRender()
const slotRootIfShape = VaporBlockShape.SINGLE_ROOT | VaporIfFlags.SLOT_ROOT
const nonStableSlot = { _: VaporSlotFlags.NON_STABLE }

function renderWithSlots(slots) {
  let instance
  const Comp = defineVaporComponent({
    setup() {
      const t0 = template('<div></div>')
      const n0 = t0()
      instance = getCurrentInstance()
      return n0
    },
  })

  define({
    render() {
      return createComponent(Comp, {}, slots)
    },
  }).render()

  return instance
}

function createTestSlotResolutionState(options) {
  let state
  const boundary = {
    parent: null,
    getFallback: () => options.fallback,
    run: (fn, scope) => (scope ? scope.run(fn) : fn()),
    markDirty: force => markSlotResolutionDirty(state, force),
  }
  state = {
    boundary,
    activeFallback: null,
    pendingRecheck: false,
    pendingRecheckForce: false,
    isRenderingFallback: false,
    getContent: () => options.content || [],
    getParentNode: () => options.parentNode || null,
    getAnchor: () => options.anchor || null,
    isBusy: options.isBusy || (() => false),
    isDisposed: options.isDisposed || (() => false),
    isContentValid:
      options.isContentValid || (() => isValidSlot(options.content || [])),
    syncNodes: () => {},
    notifyExposedValidityChange: vi.fn(),
  }
  return state
}

describe('component: slots', () => {
  test('initSlots: instance.slots should be set correctly', () => {
    const { slots } = renderWithSlots({
      default: () => template('<span></span>')(),
    })

    expect(slots.default()).toMatchObject(document.createElement('span'))
  })

  describe('slot fallback boundary', () => {
    test('slot fragment insert uses active fallback output', () => {
      const container = document.createElement('div')
      const frag = new SlotFragment()

      frag.updateSlot(undefined, () => document.createTextNode('fallback'))

      insert(frag, container)

      expect(container.innerHTML).toBe('fallback<!--slot-->')
    })

    test('slot fragment validity uses active fallback output', () => {
      const frag = new SlotFragment()

      frag.updateSlot(undefined, () => document.createTextNode('fallback'))

      expect(isValidBlock(frag)).toBe(true)
    })

    test('recheckSlotResolution switches from invalid content to fallback', () => {
      const container = document.createElement('div')
      const anchor = document.createComment('slot')
      container.appendChild(anchor)
      const content = []
      const state = createTestSlotResolutionState({
        content,
        parentNode: container,
        anchor,
        fallback: () => document.createTextNode('fallback'),
        isContentValid: () => false,
      })

      recheckSlotResolution(state)

      expect(state.activeFallback).not.toBe(null)
      expect(container.textContent).toBe('fallback')
    })

    test('recheckSlotResolution restores content when it becomes valid again', () => {
      const container = document.createElement('div')
      const anchor = document.createComment('slot')
      container.appendChild(anchor)
      let contentValid = false
      const contentNode = document.createTextNode('content')
      const state = createTestSlotResolutionState({
        content: contentNode,
        parentNode: container,
        anchor,
        fallback: () => document.createTextNode('fallback'),
        isContentValid: () => contentValid,
      })

      recheckSlotResolution(state)
      expect(container.textContent).toBe('fallback')

      contentValid = true
      recheckSlotResolution(state)
      expect(state.activeFallback).toBe(null)
      expect(container.textContent).toBe('content')
    })
  })

  describe('createSlot', () => {
    test('slot should be rendered correctly', () => {
      const Comp = defineVaporComponent(() => {
        const n0 = template('<div>')()
        insert(createSlot('header'), n0)
        return n0
      })

      const { host } = define(() =>
        createComponent(Comp, null, {
          header: () => template('header')(),
        }),
      ).render()

      expect(host.innerHTML).toBe('<div>header<!--slot--></div>')
    })

    test('slot fallback should be rendered when slot is missing', () => {
      const Comp = defineVaporComponent(() =>
        createSlot('default', null, () => template('fallback')()),
      )

      const { host } = define(() => createComponent(Comp)).render()

      expect(host.innerHTML).toBe('fallback<!--slot-->')
    })

    test('slot fallback switches when non-stable slot content becomes invalid', async () => {
      const show = ref(true)
      const Comp = defineVaporComponent(() =>
        createSlot('default', null, () => template('fallback')()),
      )

      const { host } = define(() =>
        createComponent(Comp, null, {
          default: Object.assign(
            () =>
              createIf(
                () => show.value,
                () => template('content')(),
                undefined,
                slotRootIfShape,
              ),
            nonStableSlot,
          ),
        }),
      ).render()

      expect(host.innerHTML).toBe('content<!--if--><!--slot-->')

      show.value = false
      await nextTick()

      expect(host.innerHTML).toBe('fallback<!--slot-->')
    })

    test('dynamic slot name', async () => {
      const val = ref('header')

      const Comp = defineVaporComponent(() => {
        const n0 = template('<div></div>')()
        prepend(
          n0,
          createSlot(() => val.value),
        )
        return n0
      })

      const { host } = define(() =>
        createComponent(Comp, null, {
          header: () => template('header')(),
          footer: () => template('footer')(),
        }),
      ).render()

      expect(host.innerHTML).toBe('<div>header<!--slot--></div>')

      val.value = 'footer'
      await nextTick()
      expect(host.innerHTML).toBe('<div>footer<!--slot--></div>')
    })
  })
})
