/**
 * @vitest-environment jsdom
 */
import { ref } from '@vue/reactivity'
import { createIf, insert, renderEffect, template } from '../src/index.js'
import { setElementText } from '../src/vapor/dom/prop.js'
import { flushAll } from './_utils.js'

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
})
