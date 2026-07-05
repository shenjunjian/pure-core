/**
 * @vitest-environment jsdom
 */
import {
  createComponent,
  defineVaporComponent,
  setBlockKey,
  template,
} from '../../src/index.js'
import { resolveTransitionBlock } from '../../src/vapor/components/Transition.js'
import { makeRender } from '../_utils.js'

const define = makeRender()

describe('Transition', () => {
  test('prefers explicit component key over uid when resolving child', () => {
    const Child = defineVaporComponent({
      setup() {
        return template(`<div>child</div>`)()
      },
    })

    let child
    define({
      setup() {
        child = createComponent(Child)
        setBlockKey(child, 'foo')
        return child
      },
    }).render()

    child.block.$key = undefined

    const resolved = resolveTransitionBlock(child)
    expect(resolved.$key).toBe('foo')
  })

  test('keeps unkeyed child key undefined', () => {
    const Child = defineVaporComponent({
      setup() {
        return template(`<div>child</div>`)()
      },
    })

    let child
    define({
      setup() {
        child = createComponent(Child)
        return child
      },
    }).render()

    child.block.$key = undefined

    const resolved = resolveTransitionBlock(child)
    expect(resolved.$key).toBeUndefined()
  })

  test('VaporTransition and VaporTransitionGroup are exported', async () => {
    const mod = await import('../../src/index.js')
    expect(mod.VaporTransition).toBeTypeOf('function')
    expect(mod.VaporTransitionGroup).toBeTruthy()
    expect(mod.VaporTransition.__vapor).toBe(true)
    expect(mod.VaporTransitionGroup.__vapor).toBe(true)
  })
})
