/**
 * @vitest-environment jsdom
 */
import { describe, expect, test } from 'vitest'
import '../src/internal/hmr.js'

describe('dev HMR runtime', () => {
  test('exposes __VUE_HMR_RUNTIME__ on global', () => {
    const runtime = globalThis.__VUE_HMR_RUNTIME__
    expect(runtime).toBeDefined()
    expect(runtime.createRecord).toBeTypeOf('function')
    expect(runtime.rerender).toBeTypeOf('function')
    expect(runtime.reload).toBeTypeOf('function')
  })

  test('createRecord dedupes by id', () => {
    const { createRecord } = globalThis.__VUE_HMR_RUNTIME__
    expect(createRecord('pure-vapor-hmr-test', {})).toBe(true)
    expect(createRecord('pure-vapor-hmr-test', {})).toBe(false)
  })
})
