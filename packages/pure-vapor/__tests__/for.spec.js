/**
 * @vitest-environment jsdom
 */
import { ref } from '@vue/reactivity'
import { createFor, createIf, renderEffect } from '../src/index.js'
import { flushAll, makeRender } from './_utils.js'

const define = makeRender()

describe('createFor', () => {
  test('array source', async () => {
    const list = ref([{ name: '1' }, { name: '2' }, { name: '3' }])
    function reverse() {
      list.value = list.value.reverse()
    }

    const { host } = await define(() => {
      const n1 = createFor(
        () => list.value,
        (item, key) => {
          const span = document.createElement('li')
          renderEffect(() => {
            span.innerHTML = `${key.value}. ${item.value.name}`
          })
          return span
        },
        item => item.name,
      )
      return n1
    }).render()

    expect(host.innerHTML).toBe(
      '<li>0. 1</li><li>1. 2</li><li>2. 3</li><!--for-->',
    )

    list.value.push({ name: '4' })
    await flushAll()
    expect(host.innerHTML).toBe(
      '<li>0. 1</li><li>1. 2</li><li>2. 3</li><li>3. 4</li><!--for-->',
    )

    reverse()
    await flushAll()
    expect(host.innerHTML).toBe(
      '<li>0. 4</li><li>1. 3</li><li>2. 2</li><li>3. 1</li><!--for-->',
    )

    reverse()
    await flushAll()
    expect(host.innerHTML).toBe(
      '<li>0. 1</li><li>1. 2</li><li>2. 3</li><li>3. 4</li><!--for-->',
    )

    list.value[0].name = 'a'
    await flushAll()
    expect(host.innerHTML).toBe(
      '<li>0. a</li><li>1. 2</li><li>2. 3</li><li>3. 4</li><!--for-->',
    )

    list.value.splice(1, 1)
    await flushAll()
    expect(host.innerHTML).toBe(
      '<li>0. a</li><li>1. 3</li><li>2. 4</li><!--for-->',
    )

    list.value = []
    await flushAll()
    expect(host.innerHTML).toBe('<!--for-->')
  })

  test('nested in createIf', async () => {
    const show = ref(true)
    const list = ref([1, 2, 3])
    const calls = []

    await define(() => {
      return createIf(
        () => show.value,
        () =>
          createFor(
            () => list.value,
            item => {
              const span = document.createElement('span')
              renderEffect(() => {
                calls.push(`render ${item.value}`)
                span.textContent = `${item.value}`
              })
              return span
            },
          ),
      )
    }).render()

    expect(calls).toEqual(['render 1', 'render 2', 'render 3'])

    show.value = false
    await flushAll()
    list.value[0] = 10
    await flushAll()

    expect(calls).toEqual(['render 1', 'render 2', 'render 3'])
  })
})
