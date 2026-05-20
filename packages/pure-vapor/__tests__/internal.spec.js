import { describe, expect, it, vi } from 'vitest'
import { effect, ref } from '@vue/reactivity'
import {
  LifecycleHooks,
  callWithErrorHandling,
  currentInstance,
  injectHook,
  nextTick,
  onMounted,
  queueJob,
  setCurrentInstance,
} from '../src/internal/index.js'
import { ErrorCodes } from '../src/internal/errorHandling.js'

describe('pure-vapor internal', () => {
  it('queueJob + nextTick flush', async () => {
    const fn = vi.fn()
    queueJob(fn)
    await nextTick()
    expect(fn).toHaveBeenCalledTimes(1)
  })

  it('injectHook registers lifecycle on instance', () => {
    const instance = { [LifecycleHooks.MOUNTED]: null, scope: undefined }
    const hook = vi.fn()
    const prev = setCurrentInstance(instance)
    try {
      onMounted(hook)
    } finally {
      setCurrentInstance(...prev)
    }
    expect(instance.m).toHaveLength(1)
    instance.m[0]()
    expect(hook).toHaveBeenCalledTimes(1)
  })

  it('callWithErrorHandling swallows handled errors in prod path', () => {
    const spy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    callWithErrorHandling(
      () => {
        throw new Error('test')
      },
      null,
      ErrorCodes.SETUP_FUNCTION,
    )
    if (__DEV__) {
      expect(spy).toHaveBeenCalled()
    }
    spy.mockRestore()
  })

  it('setCurrentInstance restores previous', () => {
    const a = { uid: 1, scope: undefined }
    const b = { uid: 2, scope: undefined }
    const prev = setCurrentInstance(a)
    setCurrentInstance(b)
    expect(currentInstance).toBe(b)
    setCurrentInstance(...prev)
    expect(currentInstance).toBe(a)
    setCurrentInstance(null)
  })

  it('render effect can queue via scheduler', async () => {
    const count = ref(0)
    const runs = []
    effect(() => {
      count.value
      queueJob(() => runs.push('job'))
    })
    count.value++
    await nextTick()
    expect(runs).toEqual(['job'])
  })
})
