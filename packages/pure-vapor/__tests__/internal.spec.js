import { describe, expect, it, vi } from 'vitest'
import { effect, ref } from '@vue/reactivity'
import { flushDomJobs } from '../src/internal/domJobQueue.js'
import {
  LifecycleHooks,
  currentInstance,
  nextTick,
  onMounted,
  queueJob,
  setCurrentInstance,
} from '../src/internal/index.js'

async function flushAll() {
  await Promise.resolve()
  flushDomJobs()
}

describe('pure-vapor internal', () => {
  it('queueJob + nextTick flush', async () => {
    const fn = vi.fn()
    queueJob(fn)
    const p = nextTick()
    await flushAll()
    await p
    expect(fn).toHaveBeenCalledTimes(1)
  })

  it('onMounted registers hook on active instance', () => {
    const instance = { scope: undefined }
    const hook = vi.fn()
    const prev = setCurrentInstance(instance)
    try {
      onMounted(hook)
    } finally {
      setCurrentInstance(...prev)
    }
    expect(instance[LifecycleHooks.MOUNTED]).toHaveLength(1)
    instance[LifecycleHooks.MOUNTED][0]()
    expect(hook).toHaveBeenCalledTimes(1)
  })

  it('setCurrentInstance restores previous', () => {
    const a = { uid: 1, scope: undefined }
    const b = { uid: 2, scope: undefined }
    const prevA = setCurrentInstance(a)
    expect(currentInstance).toBe(a)
    const prevB = setCurrentInstance(b)
    expect(currentInstance).toBe(b)
    setCurrentInstance(...prevB)
    expect(currentInstance).toBe(a)
    setCurrentInstance(...prevA)
    expect(currentInstance).toBe(null)
  })

  it('reactive update queues job via scheduler', async () => {
    const count = ref(0)
    const runs = []
    effect(() => {
      count.value
      queueJob(() => runs.push('job'))
    })
    const before = runs.length
    count.value++
    const p = nextTick()
    await flushAll()
    await p
    expect(runs.length).toBeGreaterThan(before)
  })
})
