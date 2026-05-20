/**
 * @vitest-environment jsdom
 */
import { ref } from '@vue/reactivity'
import { onUpdated, renderEffect, template } from '../src/index.js'
import { RenderEffect } from '../src/vapor/renderEffect.js'
import { flushAll, makeRender } from './_utils.js'

const define = makeRender()

function createDemo(setupFn, renderFn) {
  return define({
    setup: () => {
      const returned = setupFn()
      Object.defineProperty(returned, '__isScriptSetup', {
        enumerable: false,
        value: true,
      })
      return returned
    },
    render: ctx => {
      const t0 = template('<div></div>')
      renderFn(ctx)
      return t0()
    },
  })
}

describe('renderEffect', () => {
  test('initializes noLifecycle effect with raw effect function', () => {
    let calls = 0
    const fn = () => {
      calls++
    }
    const effect = new RenderEffect(fn, true)

    expect(effect.fn).toBe(fn)
    expect(effect.updateJob).toBe(undefined)

    effect.run()
    expect(calls).toBe(1)
  })

  test('creates update lifecycle job lazily', async () => {
    const effect = new RenderEffect(() => {})
    expect(effect.updateJob).toBe(undefined)

    const effects = []
    const calls = []
    const { instance } = await createDemo(
      () => {
        const source = ref(0)
        const update = () => source.value++
        onUpdated(() => calls.push(`updated ${source.value}`))
        return { source, update }
      },
      ctx => {
        const eff = new RenderEffect(() => {
          calls.push(`render ${ctx.source}`)
        })
        effects.push(eff)
        eff.run()
      },
    ).render()

    expect(effects[0].updateJob).toBe(undefined)
    expect(calls).toEqual(['render 0'])

    const { update } = instance.setupState
    update()
    await flushAll()

    expect(effects[0].updateJob).toBeDefined()
    expect(calls).toEqual(['render 0', 'render 1', 'updated 1'])
  })
})
