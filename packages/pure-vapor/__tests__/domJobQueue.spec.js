import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import {
  DomOpType,
  flushDomJobs,
  getPendingDomOpCount,
  queueDomOp,
  runWithDomOps,
  runWithDomOpsSync,
  scheduleDomFlush,
} from '../src/internal/domJobQueue.js'
import {
  domAppendChild,
  domInsert,
  domRemove,
  domSetAttr,
  domSetText,
} from '../src/vapor/dom/domOps.js'
import { nextTick, queueJob } from '../src/internal/scheduler.js'

function createMockParent() {
  const children = []
  return {
    children,
    firstChild: null,
    insertBefore(node, anchor) {
      const idx = anchor ? children.indexOf(anchor) : children.length
      const at = idx < 0 ? children.length : idx
      const existing = children.indexOf(node)
      if (existing >= 0) children.splice(existing, 1)
      children.splice(at, 0, node)
      this.firstChild = children[0] || null
    },
    appendChild(child) {
      if (!children.includes(child)) children.push(child)
      this.firstChild = children[0] || null
    },
    removeChild(child) {
      const idx = children.indexOf(child)
      if (idx >= 0) children.splice(idx, 1)
      this.firstChild = children[0] || null
    },
    contains(child) {
      return children.includes(child)
    },
  }
}

function createMockNode(text = '') {
  return { textContent: text }
}

describe('domJobQueue', () => {
  let rafQueue

  beforeEach(() => {
    rafQueue = []
    vi.stubGlobal('requestAnimationFrame', cb => {
      rafQueue.push(cb)
      return rafQueue.length
    })
    vi.stubGlobal('cancelAnimationFrame', () => {})
  })

  afterEach(() => {
    flushDomJobs()
    vi.unstubAllGlobals()
  })

  function flushRaf() {
    const cbs = rafQueue.splice(0)
    for (let i = 0; i < cbs.length; i++) {
      cbs[i]()
    }
  }

  it('queues ops without touching DOM until flush', () => {
    const parent = createMockParent()
    const child = createMockNode()
    const insertSpy = vi.spyOn(parent, 'insertBefore')

    runWithDomOps(() => {
      domInsert(parent, child)
      domSetText(child, 'hi')
    })

    expect(insertSpy).not.toHaveBeenCalled()
    expect(getPendingDomOpCount()).toBe(2)
    expect(child.textContent).toBe('')

    flushRaf()
    expect(insertSpy).toHaveBeenCalled()
    expect(child.textContent).toBe('hi')
    expect(getPendingDomOpCount()).toBe(0)
    insertSpy.mockRestore()
  })

  it('coalesces multiple scheduleDomFlush into one rAF', () => {
    const node = createMockNode()
    queueDomOp(DomOpType.SET_TEXT, { node, text: 'a' })
    scheduleDomFlush()
    scheduleDomFlush()
    scheduleDomFlush()
    expect(rafQueue).toHaveLength(1)
    flushRaf()
    expect(getPendingDomOpCount()).toBe(0)
    expect(node.textContent).toBe('a')
  })

  it('plays ops in enqueue order', () => {
    const parent = createMockParent()
    const a = createMockNode()
    a.id = 'a'
    const b = createMockNode()
    b.id = 'b'

    runWithDomOpsSync(() => {
      domAppendChild(parent, a)
      domAppendChild(parent, b)
    })

    expect(parent.children[0].id).toBe('a')
    expect(parent.children[1].id).toBe('b')
  })

  it('domSetAttr queues remove when value is null', () => {
    const el = {
      attrs: { 'data-x': '1' },
      setAttribute(name, value) {
        this.attrs[name] = value
      },
      removeAttribute(name) {
        delete this.attrs[name]
      },
      hasAttribute(name) {
        return name in this.attrs
      },
    }

    runWithDomOpsSync(() => {
      domSetAttr(el, 'data-x', null)
    })

    expect(el.hasAttribute('data-x')).toBe(false)
  })

  it('flushDomJobs clears list and runs nextTick callbacks after DOM', async () => {
    const order = []
    const parent = createMockParent()
    const child = createMockNode()

    queueDomOp(DomOpType.APPEND_CHILD, { parent, child })
    const p = nextTick(() => {
      order.push('nextTick')
      expect(parent.contains(child)).toBe(true)
    })

    await Promise.resolve()
    order.push('microtask')
    flushDomJobs()
    await p
    expect(order).toEqual(['microtask', 'nextTick'])
  })

  it('queueJob flush schedules DOM flush; nextTick runs after playback', async () => {
    const order = []
    const parent = createMockParent()
    const child = createMockNode()
    parent.appendChild(child)

    queueJob(() => {
      runWithDomOps(() => {
        domRemove(parent, child)
      })
      order.push('job')
    })

    const p = nextTick(() => {
      order.push('nextTick')
      expect(parent.contains(child)).toBe(false)
    })

    await Promise.resolve()
    flushRaf()
    await p
    expect(order).toEqual(['job', 'nextTick'])
  })
})
