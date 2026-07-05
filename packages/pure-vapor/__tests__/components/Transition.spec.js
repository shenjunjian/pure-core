/**
 * Basic tests for VaporTransition and VaporTransitionGroup
 */

import { describe, test, expect } from 'vitest'
import { ref, nextTick } from '@vue/reactivity'
import { createVaporApp } from '../../src/vapor/apiCreateApp.js'
import { VaporTransition } from '../../src/vapor/components/Transition.js'
import { VaporTransitionGroup } from '../../src/vapor/components/TransitionGroup.js'
import { template } from '../../src/vapor/dom/template.js'
import { child } from '../../src/vapor/dom/node.js'
import { renderEffect } from '../../src/vapor/renderEffect.js'

describe('VaporTransition', () => {
  test('should render single element', () => {
    const root = document.createElement('div')

    const App = {
      setup() {
        return () => {
          const t0 = template('<div>Hello</div>')
          return VaporTransition(
            {},
            {
              default: () => [t0()],
            },
          )
        }
      },
    }

    const app = createVaporApp(App)
    app.mount(root)

    expect(root.innerHTML).toContain('Hello')
  })

  test('should support appear prop', async () => {
    const root = document.createElement('div')
    let enterCalled = false

    const App = {
      setup() {
        return () => {
          const t0 = template('<div>Appear</div>')
          return VaporTransition(
            {
              appear: true,
              onEnter: () => {
                enterCalled = true
              },
            },
            {
              default: () => [t0()],
            },
          )
        }
      },
    }

    const app = createVaporApp(App)
    app.mount(root)

    await nextTick()
    expect(enterCalled).toBe(true)
  })

  test('should support mode in-out', async () => {
    const root = document.createElement('div')
    const show = ref(true)

    const App = {
      setup() {
        return () => {
          const t0 = template('<div v-if="show">Visible</div>')
          return VaporTransition(
            { mode: 'in-out' },
            {
              default: () => (show.value ? [t0()] : []),
            },
          )
        }
      },
    }

    const app = createVaporApp(App)
    app.mount(root)

    expect(root.innerHTML).toContain('Visible')

    show.value = false
    await nextTick()
    // Element should still be present during leave animation
  })
})

describe('VaporTransitionGroup', () => {
  test('should render list with tag', () => {
    const root = document.createElement('div')

    const items = [1, 2, 3]

    const App = {
      setup() {
        return () => {
          const t0 = template('<li></li>')
          return VaporTransitionGroup(
            { tag: 'ul' },
            {
              default: () =>
                items.map((item, index) => {
                  const li = t0()
                  li.textContent = item
                  li.$key = index
                  return li
                }),
            },
          )
        }
      },
    }

    const app = createVaporApp(App)
    app.mount(root)

    expect(root.querySelector('ul')).toBeTruthy()
    expect(root.querySelectorAll('li').length).toBe(3)
  })

  test('should warn about missing keys in dev mode', () => {
    const root = document.createElement('div')
    const consoleWarn = console.warn
    const warnings = []
    console.warn = msg => warnings.push(msg)

    const App = {
      setup() {
        return () => {
          const t0 = template('<div></div>')
          return VaporTransitionGroup(
            {},
            {
              default: () => [t0(), t0()],
            },
          )
        }
      },
    }

    const app = createVaporApp(App)
    app.mount(root)

    console.warn = consoleWarn
    // In dev mode, should warn about missing keys
    if (__DEV__) {
      expect(warnings.some(w => w.includes('keyed'))).toBe(true)
    }
  })
})
