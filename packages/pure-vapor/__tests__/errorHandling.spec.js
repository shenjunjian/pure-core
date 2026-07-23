/**
 * @vitest-environment jsdom
 */
import { ref } from '@vue/reactivity'
import { describe, expect, test, vi } from 'vitest'
import {
  createComponent,
  createIf,
  defineVaporComponent,
  nextTick,
  onErrorCaptured,
  template,
} from '../src/index.js'
import { makeRender } from './_utils.js'

const define = makeRender()

describe('error handling', () => {
  test('component can be updated and unmounted after setup error in production', async () => {
    __DEV__ = false
    try {
      const err = new Error('foo')
      const fn = vi.fn()
      const toggle = ref(true)

      const Child = defineVaporComponent({
        setup() {
          throw err
        },
      })

      const Comp = {
        setup() {
          onErrorCaptured(e => {
            fn(e)
            return false
          })
          return createIf(
            () => toggle.value,
            () => createComponent(Child),
            () => template('<div>fallback</div>')(),
          )
        },
      }

      const { app, html } = define(Comp).render()
      expect(fn).toHaveBeenCalledWith(err)

      toggle.value = false
      await nextTick()
      expect(html()).toContain('fallback')

      expect(() => app.unmount()).not.toThrow()
    } finally {
      __DEV__ = true
    }
  })
})
