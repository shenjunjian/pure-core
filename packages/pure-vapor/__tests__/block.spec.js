/**
 * @vitest-environment jsdom
 */
import { insert, normalizeBlock, prepend, remove } from '../src/vapor/block.js'
import { VaporFragment } from '../src/vapor/fragment.js'
import { flushAll } from './_utils.js'

const node1 = document.createTextNode('node1')
const node2 = document.createTextNode('node2')
const node3 = document.createTextNode('node3')
const anchor = document.createTextNode('anchor')

describe('block + dom queue', () => {
  test('normalizeBlock', () => {
    expect(normalizeBlock([node1, node2, node3])).toEqual([node1, node2, node3])
    expect(normalizeBlock([node1, [node2, [node3]]])).toEqual([
      node1,
      node2,
      node3,
    ])
    const frag = new VaporFragment(node2)
    frag.anchor = anchor
    expect(normalizeBlock([node1, frag, [node3]])).toEqual([
      node1,
      node2,
      anchor,
      node3,
    ])
  })

  test('insert', async () => {
    const container = document.createElement('div')
    insert([anchor], container)
    insert([node1], container)
    insert([node2], container, anchor)
    insert([], container, node3)
    await flushAll()
    expect(Array.from(container.childNodes)).toEqual([node2, anchor, node1])
  })

  test('prepend', async () => {
    const container = document.createElement('div')
    prepend(container, [node1], node2)
    prepend(container, new VaporFragment(node3))
    await flushAll()
    expect(Array.from(container.childNodes)).toEqual([node3, node1, node2])
  })

  test('remove', async () => {
    const container = document.createElement('div')
    container.append(node1, node2, node3)
    const frag = new VaporFragment(node3)
    remove([node1], container)
    remove(frag, container)
    await flushAll()
    expect(Array.from(container.childNodes)).toEqual([node2])
  })
})
